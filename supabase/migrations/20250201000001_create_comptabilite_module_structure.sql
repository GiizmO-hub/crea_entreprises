/*
  # Module Comptabilité Automatisée - Structure Complète
  
  Ce module est le MODULE PHARE de l'application, 100% automatisé :
  - Plan comptable français (PCG) intégré
  - Écritures comptables automatiques depuis factures/paiements
  - Génération automatique de fiches de paie
  - Bilans et comptes de résultat automatiques
  - Déclarations fiscales automatiques (TVA, URSSAF, etc.)
  - Journaux comptables (Achats, Ventes, Banque, OD)
  - Tableaux de bord comptables avec indicateurs clés
*/

-- 1. PLAN COMPTABLE FRANÇAIS (PCG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_comptable'
  ) THEN
    CREATE TABLE plan_comptable (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE,
      numero_compte text NOT NULL, -- Ex: "411000", "512000"
      libelle text NOT NULL,
      type_compte text NOT NULL CHECK (type_compte IN ('actif', 'passif', 'charge', 'produit', 'tresorerie')),
      classe_compte integer NOT NULL CHECK (classe_compte BETWEEN 1 AND 7), -- Classes PCG
      sous_classe text, -- Sous-classe si applicable
      compte_parent text, -- Numéro du compte parent (pour hiérarchie)
      est_compte_principal boolean DEFAULT false, -- Compte principal du PCG
      est_personnalise boolean DEFAULT false, -- Compte ajouté par l'entreprise
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(entreprise_id, numero_compte)
    );
    -- Index pour plan comptable
    CREATE INDEX IF NOT EXISTS idx_plan_comptable_entreprise ON plan_comptable(entreprise_id);
    CREATE INDEX IF NOT EXISTS idx_plan_comptable_numero ON plan_comptable(numero_compte);
    CREATE INDEX IF NOT EXISTS idx_plan_comptable_type ON plan_comptable(type_compte);
    CREATE INDEX IF NOT EXISTS idx_plan_comptable_classe ON plan_comptable(classe_compte);
  END IF;
END $$;

-- 2. JOURNAUX COMPTABLES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'journaux_comptables'
  ) THEN
    CREATE TABLE journaux_comptables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      code_journal text NOT NULL, -- Ex: "AC" (Achats), "VT" (Ventes), "BN" (Banque), "OD" (Opérations Diverses)
      libelle text NOT NULL,
      type_journal text NOT NULL CHECK (type_journal IN ('achats', 'ventes', 'banque', 'caisse', 'od', 'general')),
      est_automatique boolean DEFAULT true, -- Journal géré automatiquement
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(entreprise_id, code_journal)
    );
  END IF;
END $$;

-- 3. ÉCRITURES COMPTABLES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ecritures_comptables'
  ) THEN
    CREATE TABLE ecritures_comptables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      journal_id uuid NOT NULL, -- Référence vers journaux_comptables(id) - contrainte ajoutée après
      numero_piece text NOT NULL, -- Numéro de pièce comptable
      date_ecriture date NOT NULL,
      date_valeur date, -- Date de valeur (pour banque)
      libelle text NOT NULL,
      compte_debit text NOT NULL,
      compte_credit text NOT NULL,
      montant numeric(15, 2) NOT NULL CHECK (montant > 0),
      type_ecriture text NOT NULL CHECK (type_ecriture IN ('automatique', 'manuelle', 'importee')),
      source_type text, -- 'facture', 'paiement', 'fiche_paie', 'declaration', 'manuelle'
      source_id uuid, -- ID de la source (facture_id, paiement_id, etc.)
      facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
      paiement_id uuid REFERENCES paiements(id) ON DELETE SET NULL,
      collaborateur_id uuid, -- Référence vers collaborateurs_entreprise(id) si la table existe
      est_lettree boolean DEFAULT false, -- Écriture lettrée (pour rapprochement)
      est_rapprochee boolean DEFAULT false, -- Écriture rapprochée bancaire
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      created_by uuid REFERENCES auth.users(id)
    );
    -- Index pour écritures
    CREATE INDEX IF NOT EXISTS idx_ecritures_entreprise ON ecritures_comptables(entreprise_id);
    CREATE INDEX IF NOT EXISTS idx_ecritures_journal ON ecritures_comptables(journal_id);
    CREATE INDEX IF NOT EXISTS idx_ecritures_date ON ecritures_comptables(date_ecriture);
    CREATE INDEX IF NOT EXISTS idx_ecritures_type ON ecritures_comptables(type_ecriture);
    CREATE INDEX IF NOT EXISTS idx_ecritures_source ON ecritures_comptables(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_ecritures_facture ON ecritures_comptables(facture_id);
    CREATE INDEX IF NOT EXISTS idx_ecritures_paiement ON ecritures_comptables(paiement_id);
    
    -- Ajouter la contrainte de clé étrangère pour journal_id après création de journaux_comptables
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'journaux_comptables'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'ecritures_comptables' 
      AND constraint_name LIKE '%journal%'
    ) THEN
      ALTER TABLE ecritures_comptables 
      ADD CONSTRAINT fk_ecritures_journal 
      FOREIGN KEY (journal_id) 
      REFERENCES journaux_comptables(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 4. FICHES DE PAIE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie'
  ) THEN
    CREATE TABLE fiches_paie (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      collaborateur_id uuid, -- Référence vers collaborateurs_entreprise(id) si la table existe
      periode text NOT NULL, -- Format: "YYYY-MM" (ex: "2025-01")
      date_paiement date NOT NULL,
      salaire_brut numeric(10, 2) NOT NULL,
      salaire_net numeric(10, 2) NOT NULL,
      heures_travaillees numeric(6, 2) DEFAULT 0,
      heures_supplementaires numeric(6, 2) DEFAULT 0,
      cotisations_salariales numeric(10, 2) DEFAULT 0,
      cotisations_patronales numeric(10, 2) DEFAULT 0,
      net_a_payer numeric(10, 2) NOT NULL,
      details_cotisations jsonb DEFAULT '{}'::jsonb, -- Détails des cotisations
      details_heures jsonb DEFAULT '{}'::jsonb, -- Détails des heures
      prime_anciennete numeric(10, 2) DEFAULT 0,
      prime_performance numeric(10, 2) DEFAULT 0,
      autres_primes numeric(10, 2) DEFAULT 0,
      retenues numeric(10, 2) DEFAULT 0,
      statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'validee', 'payee', 'annulee')),
      est_automatique boolean DEFAULT true, -- Générée automatiquement
      ecriture_comptable_id uuid, -- Référence vers ecritures_comptables(id) - ajoutée après création
      pdf_url text, -- URL du PDF généré
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      created_by uuid REFERENCES auth.users(id)
    );
  ELSE
    -- Si la table existe, ajouter les colonnes manquantes si elles n'existent pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'collaborateur_id'
    ) THEN
      ALTER TABLE fiches_paie ADD COLUMN collaborateur_id uuid;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'ecriture_comptable_id'
    ) THEN
      ALTER TABLE fiches_paie ADD COLUMN ecriture_comptable_id uuid;
    END IF;
  END IF;
END $$;

-- Ajouter la contrainte de clé étrangère pour ecriture_comptable_id si la table ecritures_comptables existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ecritures_comptables'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie' 
    AND column_name = 'ecriture_comptable_id'
  ) THEN
    -- Vérifier si la contrainte existe déjà
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND constraint_name LIKE '%ecriture_comptable%'
    ) THEN
      ALTER TABLE fiches_paie 
      ADD CONSTRAINT fk_fiches_paie_ecriture_comptable 
      FOREIGN KEY (ecriture_comptable_id) 
      REFERENCES ecritures_comptables(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Index pour fiches de paie (créés après la table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_fiches_paie_entreprise ON fiches_paie(entreprise_id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'collaborateur_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_fiches_paie_collaborateur ON fiches_paie(collaborateur_id);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'periode'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_fiches_paie_periode ON fiches_paie(periode);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'statut'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_fiches_paie_statut ON fiches_paie(statut);
    END IF;
  END IF;
END $$;

-- 5. DÉCLARATIONS FISCALES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'declarations_fiscales'
  ) THEN
    CREATE TABLE declarations_fiscales (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      type_declaration text NOT NULL CHECK (type_declaration IN ('tva', 'urssaf', 'cfe', 'is', 'ir', 'autre')),
      periode text NOT NULL, -- Format: "YYYY-MM" ou "YYYY-Q1" ou "YYYY"
      date_echeance date NOT NULL,
      date_depot date, -- Date de dépôt effectif
      montant_due numeric(15, 2) DEFAULT 0,
      montant_paye numeric(15, 2) DEFAULT 0,
      statut text NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'deposee', 'payee', 'en_retard')),
      donnees_declaration jsonb DEFAULT '{}'::jsonb, -- Données de la déclaration
      fichier_declaration text, -- URL du fichier de déclaration
      reference_depot text, -- Référence de dépôt (numéro d'accusé de réception)
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      created_by uuid REFERENCES auth.users(id),
      UNIQUE(entreprise_id, type_declaration, periode)
    );
    -- Index pour déclarations
    CREATE INDEX IF NOT EXISTS idx_declarations_entreprise ON declarations_fiscales(entreprise_id);
    CREATE INDEX IF NOT EXISTS idx_declarations_type ON declarations_fiscales(type_declaration);
    CREATE INDEX IF NOT EXISTS idx_declarations_periode ON declarations_fiscales(periode);
    CREATE INDEX IF NOT EXISTS idx_declarations_statut ON declarations_fiscales(statut);
    CREATE INDEX IF NOT EXISTS idx_declarations_echeance ON declarations_fiscales(date_echeance);
  END IF;
END $$;

-- 6. BILANS ET ÉTATS FINANCIERS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'bilans_comptables'
  ) THEN
    CREATE TABLE bilans_comptables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      type_bilan text NOT NULL CHECK (type_bilan IN ('bilan', 'compte_resultat', 'tableau_flux_tresorerie', 'annexe')),
      exercice text NOT NULL, -- Format: "YYYY" (ex: "2025")
      date_cloture date NOT NULL,
      donnees_bilan jsonb NOT NULL DEFAULT '{}'::jsonb, -- Structure complète du bilan
      total_actif numeric(15, 2),
      total_passif numeric(15, 2),
      resultat_net numeric(15, 2),
      chiffre_affaires numeric(15, 2),
      charges numeric(15, 2),
      produits numeric(15, 2),
      est_provisoire boolean DEFAULT false, -- Bilan provisoire ou définitif
      est_valide boolean DEFAULT false, -- Bilan validé par un expert-comptable
      pdf_url text, -- URL du PDF généré
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      created_by uuid REFERENCES auth.users(id),
      UNIQUE(entreprise_id, type_bilan, exercice)
    );
    -- Index pour bilans
    CREATE INDEX IF NOT EXISTS idx_bilans_entreprise ON bilans_comptables(entreprise_id);
    CREATE INDEX IF NOT EXISTS idx_bilans_type ON bilans_comptables(type_bilan);
    CREATE INDEX IF NOT EXISTS idx_bilans_exercice ON bilans_comptables(exercice);
  END IF;
END $$;

-- 7. PARAMÈTRES COMPTABLES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'parametres_comptables'
  ) THEN
    CREATE TABLE parametres_comptables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      exercice_fiscal text NOT NULL, -- Format: "YYYY" (ex: "2025")
      date_debut_exercice date NOT NULL,
      date_fin_exercice date NOT NULL,
      devise text DEFAULT 'EUR',
      regime_tva text CHECK (regime_tva IN ('franchise', 'simplifie', 'reel_normal')),
      taux_tva_standard numeric(5, 2) DEFAULT 20.00,
      taux_tva_reduit numeric(5, 2) DEFAULT 5.50,
      taux_tva_intermediaire numeric(5, 2) DEFAULT 10.00,
      taux_tva_super_reduit numeric(5, 2) DEFAULT 2.10,
      compte_caisse text, -- Numéro compte caisse
      compte_banque text, -- Numéro compte banque principal
      compte_client text, -- Numéro compte clients (411000)
      compte_fournisseur text, -- Numéro compte fournisseurs (401000)
      compte_tva_collectee text, -- Numéro compte TVA collectée (445710)
      compte_tva_deductible text, -- Numéro compte TVA déductible (445660)
      compte_charges text, -- Numéro compte charges générales
      compte_produits text, -- Numéro compte produits généraux
      auto_ecritures_factures boolean DEFAULT true, -- Écritures automatiques depuis factures
      auto_ecritures_paiements boolean DEFAULT true, -- Écritures automatiques depuis paiements
      auto_fiches_paie boolean DEFAULT true, -- Génération automatique fiches de paie
      auto_declarations boolean DEFAULT true, -- Déclarations automatiques
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(entreprise_id, exercice_fiscal)
    );
    -- Index pour paramètres
    CREATE INDEX IF NOT EXISTS idx_parametres_comptables_entreprise ON parametres_comptables(entreprise_id);
    CREATE INDEX IF NOT EXISTS idx_parametres_comptables_exercice ON parametres_comptables(exercice_fiscal);
  END IF;
END $$;

-- Activer RLS sur toutes les tables (si elles existent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_comptable') THEN
    ALTER TABLE plan_comptable ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journaux_comptables') THEN
    ALTER TABLE journaux_comptables ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ecritures_comptables') THEN
    ALTER TABLE ecritures_comptables ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiches_paie') THEN
    ALTER TABLE fiches_paie ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'declarations_fiscales') THEN
    ALTER TABLE declarations_fiscales ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bilans_comptables') THEN
    ALTER TABLE bilans_comptables ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parametres_comptables') THEN
    ALTER TABLE parametres_comptables ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies (basiques - à affiner selon besoins)
-- Les utilisateurs voient uniquement les données de leur entreprise
DO $$
BEGIN
  -- Policies pour plan_comptable
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_comptable') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON plan_comptable;
    CREATE POLICY "Users see own entreprise data" ON plan_comptable FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON plan_comptable;
    CREATE POLICY "Super admins can manage" ON plan_comptable FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = plan_comptable.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour journaux_comptables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journaux_comptables') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON journaux_comptables;
    CREATE POLICY "Users see own entreprise data" ON journaux_comptables FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON journaux_comptables;
    CREATE POLICY "Super admins can manage" ON journaux_comptables FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = journaux_comptables.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour ecritures_comptables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ecritures_comptables') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON ecritures_comptables;
    CREATE POLICY "Users see own entreprise data" ON ecritures_comptables FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON ecritures_comptables;
    CREATE POLICY "Super admins can manage" ON ecritures_comptables FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = ecritures_comptables.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour fiches_paie
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiches_paie') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON fiches_paie;
    CREATE POLICY "Users see own entreprise data" ON fiches_paie FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON fiches_paie;
    CREATE POLICY "Super admins can manage" ON fiches_paie FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = fiches_paie.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour declarations_fiscales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'declarations_fiscales') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON declarations_fiscales;
    CREATE POLICY "Users see own entreprise data" ON declarations_fiscales FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON declarations_fiscales;
    CREATE POLICY "Super admins can manage" ON declarations_fiscales FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = declarations_fiscales.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour bilans_comptables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bilans_comptables') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON bilans_comptables;
    CREATE POLICY "Users see own entreprise data" ON bilans_comptables FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON bilans_comptables;
    CREATE POLICY "Super admins can manage" ON bilans_comptables FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = bilans_comptables.entreprise_id
          ))
        )
      );
  END IF;

  -- Policies pour parametres_comptables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parametres_comptables') THEN
    DROP POLICY IF EXISTS "Users see own entreprise data" ON parametres_comptables;
    CREATE POLICY "Users see own entreprise data" ON parametres_comptables FOR SELECT
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
          UNION
          SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "Super admins can manage" ON parametres_comptables;
    CREATE POLICY "Super admins can manage" ON parametres_comptables FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND (utilisateurs.role = 'super_admin' OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            JOIN clients c ON c.id = emc.client_id
            JOIN roles r ON r.id = c.role_id
            WHERE emc.user_id = auth.uid()
            AND r.code = 'client_super_admin'
            AND emc.entreprise_id = parametres_comptables.entreprise_id
          ))
        )
      );
  END IF;
END $$;
