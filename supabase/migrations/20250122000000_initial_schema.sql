/*
  # Crea+Entreprises - Schema Database Initial
  
  ## Description
  Création du schéma de base de données complet pour l'application SaaS Crea+Entreprises.
  Ce schéma comprend toutes les tables nécessaires pour la gestion d'entreprise complète.
  
  ## Tables Créées
  1. entreprises - Gestion des entreprises
  2. clients - Gestion des clients (CRM)
  3. factures - Gestion des factures
  4. facture_lignes - Lignes de facturation
  5. devis - Gestion des devis
  6. devis_lignes - Lignes de devis
  7. avoirs - Gestion des avoirs
  8. avoir_lignes - Lignes d'avoirs
  9. transactions - Transactions financières
  10. projets - Gestion des projets
  11. salaries - Gestion des salariés
  12. fiches_paie - Fiches de paie
  13. conges - Gestion des congés
  14. fournisseurs - Gestion des fournisseurs
  15. factures_achat - Factures fournisseurs
  16. produits - Catalogue produits
  17. mouvements_stock - Mouvements de stock
  18. documents - Gestion documentaire
  19. notifications - Notifications
  20. messages - Messagerie interne
  21. abonnements - Gestion des abonnements
  22. plans_abonnement - Plans d'abonnement
  23. options_supplementaires - Options supplémentaires
  
  ## Sécurité
  - Row Level Security (RLS) activé sur toutes les tables
  - Politiques restrictives basées sur l'authentification
  - Isolation des données par entreprise
*/

-- ============================================
-- 1. TABLE ENTREPRISES
-- ============================================
CREATE TABLE IF NOT EXISTS entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nom text NOT NULL,
  forme_juridique text NOT NULL,
  siret text UNIQUE,
  rcs text,
  capital numeric DEFAULT 0,
  adresse text,
  code_postal text,
  ville text,
  pays text DEFAULT 'France',
  telephone text,
  email text,
  site_web text,
  date_creation date DEFAULT CURRENT_DATE,
  statut text DEFAULT 'active' CHECK (statut IN ('active', 'suspendue', 'radiee')),
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_entreprises_user_id ON entreprises(user_id);
CREATE INDEX idx_entreprises_statut ON entreprises(statut);

-- RLS pour entreprises
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 2. TABLE CLIENTS (CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  nom text,
  prenom text,
  entreprise_nom text,
  email text,
  telephone text,
  portable text,
  adresse text,
  code_postal text,
  ville text,
  pays text DEFAULT 'France',
  siret text,
  tva_intracommunautaire text,
  statut text DEFAULT 'actif' CHECK (statut IN ('prospect', 'actif', 'inactif')),
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_clients_entreprise_id ON clients(entreprise_id);
CREATE INDEX idx_clients_statut ON clients(statut);
CREATE INDEX idx_clients_email ON clients(email);

-- RLS pour clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients of their entreprises"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert clients in their entreprises"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clients of their entreprises"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clients of their entreprises"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. TABLE FACTURES CLIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  numero text NOT NULL,
  type text DEFAULT 'facture' CHECK (type IN ('facture', 'proforma', 'avoir')),
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'en_attente', 'payee', 'en_retard', 'annulee')),
  notes text,
  conditions_paiement text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, numero)
);

CREATE INDEX idx_factures_entreprise_id ON factures(entreprise_id);
CREATE INDEX idx_factures_client_id ON factures(client_id);
CREATE INDEX idx_factures_statut ON factures(statut);
CREATE INDEX idx_factures_date_emission ON factures(date_emission);

-- RLS pour factures
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view factures of their entreprises"
  ON factures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage factures of their entreprises"
  ON factures FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. TABLE FACTURE_LIGNES
-- ============================================
CREATE TABLE IF NOT EXISTS facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid REFERENCES factures(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire_ht numeric DEFAULT 0,
  taux_tva numeric DEFAULT 20,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_facture_lignes_facture_id ON facture_lignes(facture_id);

-- RLS pour facture_lignes
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view facture_lignes of their entreprises"
  ON facture_lignes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      JOIN entreprises ON entreprises.id = factures.entreprise_id
      WHERE factures.id = facture_lignes.facture_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage facture_lignes of their entreprises"
  ON facture_lignes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      JOIN entreprises ON entreprises.id = factures.entreprise_id
      WHERE factures.id = facture_lignes.facture_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. TABLE DEVIS
-- ============================================
CREATE TABLE IF NOT EXISTS devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  numero text NOT NULL,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_validite date,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse', 'expire')),
  notes text,
  conditions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, numero)
);

CREATE INDEX idx_devis_entreprise_id ON devis(entreprise_id);
CREATE INDEX idx_devis_client_id ON devis(client_id);
CREATE INDEX idx_devis_statut ON devis(statut);

-- RLS pour devis
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view devis of their entreprises"
  ON devis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = devis.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage devis of their entreprises"
  ON devis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = devis.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 6. TABLE DEVIS_LIGNES
-- ============================================
CREATE TABLE IF NOT EXISTS devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid REFERENCES devis(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire_ht numeric DEFAULT 0,
  taux_tva numeric DEFAULT 20,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_devis_lignes_devis_id ON devis_lignes(devis_id);

-- RLS pour devis_lignes
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view devis_lignes of their entreprises"
  ON devis_lignes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devis
      JOIN entreprises ON entreprises.id = devis.entreprise_id
      WHERE devis.id = devis_lignes.devis_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage devis_lignes of their entreprises"
  ON devis_lignes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devis
      JOIN entreprises ON entreprises.id = devis.entreprise_id
      WHERE devis.id = devis_lignes.devis_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. TABLE AVOIRS
-- ============================================
CREATE TABLE IF NOT EXISTS avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  numero text NOT NULL,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  motif text,
  statut text DEFAULT 'valide' CHECK (statut IN ('valide', 'utilise', 'annule')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, numero)
);

CREATE INDEX idx_avoirs_entreprise_id ON avoirs(entreprise_id);
CREATE INDEX idx_avoirs_client_id ON avoirs(client_id);
CREATE INDEX idx_avoirs_facture_id ON avoirs(facture_id);

-- RLS pour avoirs
ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view avoirs of their entreprises"
  ON avoirs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = avoirs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage avoirs of their entreprises"
  ON avoirs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = avoirs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 8. TABLE AVOIR_LIGNES
-- ============================================
CREATE TABLE IF NOT EXISTS avoir_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid REFERENCES avoirs(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire_ht numeric DEFAULT 0,
  taux_tva numeric DEFAULT 20,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_avoir_lignes_avoir_id ON avoir_lignes(avoir_id);

-- RLS pour avoir_lignes
ALTER TABLE avoir_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view avoir_lignes of their entreprises"
  ON avoir_lignes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM avoirs
      JOIN entreprises ON entreprises.id = avoirs.entreprise_id
      WHERE avoirs.id = avoir_lignes.avoir_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage avoir_lignes of their entreprises"
  ON avoir_lignes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM avoirs
      JOIN entreprises ON entreprises.id = avoirs.entreprise_id
      WHERE avoirs.id = avoir_lignes.avoir_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. TABLE TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  categorie text NOT NULL,
  montant numeric NOT NULL,
  date_transaction date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transactions_entreprise_id ON transactions(entreprise_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date_transaction ON transactions(date_transaction);

-- RLS pour transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions of their entreprises"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = transactions.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage transactions of their entreprises"
  ON transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = transactions.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 10. TABLE PROJETS
-- ============================================
CREATE TABLE IF NOT EXISTS projets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  nom text NOT NULL,
  description text,
  date_debut date,
  date_fin date,
  budget_previsionnel numeric DEFAULT 0,
  budget_reel numeric DEFAULT 0,
  statut text DEFAULT 'en_cours' CHECK (statut IN ('planifie', 'en_cours', 'en_pause', 'termine', 'annule')),
  pourcentage_avancement integer DEFAULT 0 CHECK (pourcentage_avancement >= 0 AND pourcentage_avancement <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projets_entreprise_id ON projets(entreprise_id);
CREATE INDEX idx_projets_client_id ON projets(client_id);
CREATE INDEX idx_projets_statut ON projets(statut);

-- RLS pour projets
ALTER TABLE projets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projets of their entreprises"
  ON projets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage projets of their entreprises"
  ON projets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 11. TABLE SALARIES
-- ============================================
CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  email text,
  telephone text,
  date_embauche date,
  date_fin_contrat date,
  poste text,
  salaire_brut numeric DEFAULT 0,
  type_contrat text CHECK (type_contrat IN ('CDI', 'CDD', 'stage', 'interim', 'freelance')),
  statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'conges')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_salaries_entreprise_id ON salaries(entreprise_id);
CREATE INDEX idx_salaries_statut ON salaries(statut);

-- RLS pour salaries
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view salaries of their entreprises"
  ON salaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = salaries.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage salaries of their entreprises"
  ON salaries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = salaries.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 12. TABLE FICHES_PAIE
-- ============================================
CREATE TABLE IF NOT EXISTS fiches_paie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  salary_id uuid REFERENCES salaries(id) ON DELETE CASCADE NOT NULL,
  numero text NOT NULL,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  salaire_brut numeric DEFAULT 0,
  cotisations_sociales numeric DEFAULT 0,
  net_a_payer numeric DEFAULT 0,
  url_pdf text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, salary_id, periode_debut)
);

CREATE INDEX idx_fiches_paie_entreprise_id ON fiches_paie(entreprise_id);
CREATE INDEX idx_fiches_paie_salary_id ON fiches_paie(salary_id);

-- RLS pour fiches_paie
ALTER TABLE fiches_paie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fiches_paie of their entreprises"
  ON fiches_paie FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = fiches_paie.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage fiches_paie of their entreprises"
  ON fiches_paie FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = fiches_paie.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 13. TABLE CONGES
-- ============================================
CREATE TABLE IF NOT EXISTS conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  salary_id uuid REFERENCES salaries(id) ON DELETE CASCADE NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  type text DEFAULT 'conges_payes' CHECK (type IN ('conges_payes', 'maladie', 'maternite', 'sans_solde', 'autre')),
  nombre_jours integer NOT NULL,
  statut text DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  motif_refus text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conges_entreprise_id ON conges(entreprise_id);
CREATE INDEX idx_conges_salary_id ON conges(salary_id);
CREATE INDEX idx_conges_statut ON conges(statut);

-- RLS pour conges
ALTER TABLE conges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conges of their entreprises"
  ON conges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = conges.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage conges of their entreprises"
  ON conges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = conges.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 14. TABLE FOURNISSEURS
-- ============================================
CREATE TABLE IF NOT EXISTS fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  nom text NOT NULL,
  siret text,
  email text,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  pays text DEFAULT 'France',
  conditions_paiement text,
  statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fournisseurs_entreprise_id ON fournisseurs(entreprise_id);
CREATE INDEX idx_fournisseurs_statut ON fournisseurs(statut);

-- RLS pour fournisseurs
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fournisseurs of their entreprises"
  ON fournisseurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = fournisseurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage fournisseurs of their entreprises"
  ON fournisseurs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = fournisseurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 15. TABLE FACTURES_ACHAT
-- ============================================
CREATE TABLE IF NOT EXISTS factures_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  numero text NOT NULL,
  numero_fournisseur text,
  date_facture date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  montant_ht numeric DEFAULT 0,
  tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  statut text DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'payee', 'en_retard', 'annulee')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, numero)
);

CREATE INDEX idx_factures_achat_entreprise_id ON factures_achat(entreprise_id);
CREATE INDEX idx_factures_achat_fournisseur_id ON factures_achat(fournisseur_id);
CREATE INDEX idx_factures_achat_statut ON factures_achat(statut);

-- RLS pour factures_achat
ALTER TABLE factures_achat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view factures_achat of their entreprises"
  ON factures_achat FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures_achat.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage factures_achat of their entreprises"
  ON factures_achat FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures_achat.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 16. TABLE PRODUITS
-- ============================================
CREATE TABLE IF NOT EXISTS produits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  reference text NOT NULL,
  nom text NOT NULL,
  description text,
  prix_achat numeric DEFAULT 0,
  prix_vente numeric DEFAULT 0,
  stock_actuel numeric DEFAULT 0,
  stock_minimum numeric DEFAULT 0,
  unite text DEFAULT 'unite',
  categorie text,
  tva numeric DEFAULT 20,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, reference)
);

CREATE INDEX idx_produits_entreprise_id ON produits(entreprise_id);
CREATE INDEX idx_produits_categorie ON produits(categorie);
CREATE INDEX idx_produits_actif ON produits(actif);

-- RLS pour produits
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view produits of their entreprises"
  ON produits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = produits.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage produits of their entreprises"
  ON produits FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = produits.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 17. TABLE MOUVEMENTS_STOCK
-- ============================================
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  produit_id uuid REFERENCES produits(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement')),
  quantite numeric NOT NULL,
  date_mouvement date NOT NULL DEFAULT CURRENT_DATE,
  motif text,
  reference text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_mouvements_stock_entreprise_id ON mouvements_stock(entreprise_id);
CREATE INDEX idx_mouvements_stock_produit_id ON mouvements_stock(produit_id);
CREATE INDEX idx_mouvements_stock_date ON mouvements_stock(date_mouvement);

-- RLS pour mouvements_stock
ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mouvements_stock of their entreprises"
  ON mouvements_stock FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = mouvements_stock.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage mouvements_stock of their entreprises"
  ON mouvements_stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = mouvements_stock.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 18. TABLE DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  nom text NOT NULL,
  type text NOT NULL CHECK (type IN ('facture', 'devis', 'contrat', 'autre')),
  url text NOT NULL,
  taille numeric,
  mime_type text,
  tags text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_documents_entreprise_id ON documents(entreprise_id);
CREATE INDEX idx_documents_type ON documents(type);

-- RLS pour documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of their entreprises"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage documents of their entreprises"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 19. TABLE NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  lue boolean DEFAULT false,
  lien_action text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_entreprise_id ON notifications(entreprise_id);
CREATE INDEX idx_notifications_lue ON notifications(lue);

-- RLS pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 20. TABLE MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destinataire_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sujet text,
  contenu text NOT NULL,
  lu boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_entreprise_id ON messages(entreprise_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_destinataire_id ON messages(destinataire_id);

-- RLS pour messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of their entreprises"
  ON messages FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user_id OR auth.uid() = destinataire_id)
    AND EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = messages.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their entreprises"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = messages.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 21. TABLE PLANS_ABONNEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS plans_abonnement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  description text,
  prix_mensuel numeric NOT NULL DEFAULT 0,
  prix_annuel numeric,
  fonctionnalites jsonb DEFAULT '{}'::jsonb,
  max_entreprises integer DEFAULT 1,
  max_utilisateurs integer DEFAULT 1,
  actif boolean DEFAULT true,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS pour plans_abonnement (public pour tous les utilisateurs authentifiés)
ALTER TABLE plans_abonnement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans visible par tous les utilisateurs authentifiés"
  ON plans_abonnement FOR SELECT
  TO authenticated
  USING (actif = true);

-- ============================================
-- 22. TABLE ABONNEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES plans_abonnement(id) ON DELETE RESTRICT NOT NULL,
  statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'annule', 'expire')),
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_fin date,
  date_prochain_paiement date,
  montant_mensuel numeric NOT NULL DEFAULT 0,
  mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_abonnements_entreprise_id ON abonnements(entreprise_id);
CREATE INDEX idx_abonnements_plan_id ON abonnements(plan_id);
CREATE INDEX idx_abonnements_statut ON abonnements(statut);

-- RLS pour abonnements
ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view abonnements of their entreprises"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage abonnements of their entreprises"
  ON abonnements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- 23. TABLE OPTIONS_SUPPLEMENTAIRES
-- ============================================
CREATE TABLE IF NOT EXISTS options_supplementaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  prix_mensuel numeric DEFAULT 0,
  prix_annuel numeric,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS pour options_supplementaires (public pour tous les utilisateurs authentifiés)
ALTER TABLE options_supplementaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Options visible par tous les utilisateurs authentifiés"
  ON options_supplementaires FOR SELECT
  TO authenticated
  USING (actif = true);

-- ============================================
-- 24. TABLE ABONNEMENT_OPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS abonnement_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id uuid REFERENCES abonnements(id) ON DELETE CASCADE NOT NULL,
  option_id uuid REFERENCES options_supplementaires(id) ON DELETE RESTRICT NOT NULL,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(abonnement_id, option_id)
);

CREATE INDEX idx_abonnement_options_abonnement_id ON abonnement_options(abonnement_id);
CREATE INDEX idx_abonnement_options_option_id ON abonnement_options(option_id);

-- RLS pour abonnement_options
ALTER TABLE abonnement_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view abonnement_options of their entreprises"
  ON abonnement_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM abonnements
      JOIN entreprises ON entreprises.id = abonnements.entreprise_id
      WHERE abonnements.id = abonnement_options.abonnement_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage abonnement_options of their entreprises"
  ON abonnement_options FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM abonnements
      JOIN entreprises ON entreprises.id = abonnements.entreprise_id
      WHERE abonnements.id = abonnement_options.abonnement_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS POUR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entreprises_updated_at BEFORE UPDATE ON entreprises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON factures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON devis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_avoirs_updated_at BEFORE UPDATE ON avoirs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projets_updated_at BEFORE UPDATE ON projets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conges_updated_at BEFORE UPDATE ON conges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factures_achat_updated_at BEFORE UPDATE ON factures_achat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produits_updated_at BEFORE UPDATE ON produits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_abonnements_updated_at BEFORE UPDATE ON abonnements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EXTENSIONS REQUISES
-- ============================================
-- Activer l'extension pgcrypto (nécessaire pour crypt et gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- TABLE UTILISATEURS (Gestion des utilisateurs de l'application)
-- ============================================
CREATE TABLE IF NOT EXISTS utilisateurs (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'collaborateur', 'client')) DEFAULT 'client',
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  nom text,
  prenom text,
  telephone text,
  statut text DEFAULT 'active' CHECK (statut IN ('active', 'suspendue')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_entreprise_id ON utilisateurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_statut ON utilisateurs(statut);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs(email);

-- RLS pour utilisateurs
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour utilisateurs
DROP POLICY IF EXISTS "Super admin peut voir tous les utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut voir tous les utilisateurs"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Utilisateurs peuvent voir leurs propres infos" ON utilisateurs;
CREATE POLICY "Utilisateurs peuvent voir leurs propres infos"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Utilisateurs peuvent voir collaborateurs de leur entreprise" ON utilisateurs;
CREATE POLICY "Utilisateurs peuvent voir collaborateurs de leur entreprise"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      WHERE u.id = auth.uid()
      AND u.entreprise_id = utilisateurs.entreprise_id
      AND u.role IN ('admin', 'collaborateur')
    )
  );

DROP POLICY IF EXISTS "Super admin peut créer des utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut créer des utilisateurs"
  ON utilisateurs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin peut modifier tous les utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut modifier tous les utilisateurs"
  ON utilisateurs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_utilisateurs_updated_at BEFORE UPDATE ON utilisateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FONCTIONS RPC POUR GESTION DES UTILISATEURS
-- ============================================

-- Fonction pour promouvoir un utilisateur en super_admin
CREATE OR REPLACE FUNCTION create_super_admin(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users', p_email;
  END IF;

  -- Update the user's metadata to set the role to 'super_admin'
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'super_admin')
  WHERE id = v_user_id;

  -- Insert or update in the public.utilisateurs table
  INSERT INTO public.utilisateurs (id, email, role)
  VALUES (v_user_id, p_email, 'super_admin')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = now();

  RAISE NOTICE 'User % promoted to super_admin and synchronized in public.utilisateurs', p_email;
END;
$$;

-- Fonction pour créer un espace membre à partir d'un client existant
CREATE OR REPLACE FUNCTION create_espace_membre_from_client(
  p_client_id uuid,
  p_entreprise_id uuid,
  p_password text,
  p_plan_id uuid,
  p_options_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
  v_user_id uuid;
  v_abonnement_id uuid;
  v_espace_exists boolean;
  v_password_final text;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel peut créer un espace membre pour ce client
  IF NOT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de créer un espace membre pour ce client';
  END IF;

  -- Récupérer les informations du client
  SELECT email, nom, prenom
  INTO v_client_email, v_client_nom, v_client_prenom
  FROM clients
  WHERE id = p_client_id
  AND entreprise_id = p_entreprise_id;

  IF v_client_email IS NULL OR v_client_email = '' THEN
    RAISE EXCEPTION 'Le client doit avoir un email pour créer un espace membre';
  END IF;

  -- Vérifier si un espace membre existe déjà pour ce client
  SELECT EXISTS(
    SELECT 1 FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
  ) INTO v_espace_exists;

  IF v_espace_exists THEN
    RAISE EXCEPTION 'Un espace membre existe déjà pour ce client avec l''email %', v_client_email;
  END IF;

  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE EXCEPTION 'Le plan d''abonnement sélectionné n''existe pas ou n''est pas actif';
  END IF;

  -- Vérifier que l'email n'existe pas déjà dans auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_client_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec l''email % existe déjà', v_client_email;
  END IF;

  -- Générer un mot de passe si non fourni
  IF p_password IS NULL OR p_password = '' THEN
    v_password_final := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'A1!';
  ELSE
    v_password_final := p_password;
  END IF;

  -- Générer l'UUID pour l'utilisateur
  v_user_id := gen_random_uuid();

  -- Créer l'utilisateur dans auth.users avec extensions.crypt et extensions.gen_salt
  BEGIN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_client_email,
      extensions.crypt(v_password_final, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('role', 'client', 'nom', v_client_nom, 'prenom', v_client_prenom),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      now(),
      now(),
      '', '', '', ''
    );
    
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_client_email;
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', v_client_email;
    END IF;
  END;

  -- Créer l'abonnement
  INSERT INTO abonnements (
    entreprise_id,
    plan_id,
    statut,
    date_debut,
    date_fin,
    date_prochain_paiement,
    montant_mensuel,
    mode_paiement
  )
  SELECT
    p_entreprise_id,
    p_plan_id,
    'actif',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    CURRENT_DATE + INTERVAL '1 month',
    COALESCE(prix_mensuel, 0),
    'mensuel'
  FROM plans_abonnement
  WHERE id = p_plan_id
  RETURNING id INTO v_abonnement_id;

  -- Créer les options souscrites (modules)
  IF array_length(p_options_ids, 1) > 0 THEN
    INSERT INTO abonnement_options (
      abonnement_id,
      option_id,
      date_activation,
      actif
    )
    SELECT
      v_abonnement_id,
      unnest(p_options_ids),
      CURRENT_DATE,
      true
    WHERE EXISTS (
      SELECT 1 FROM options_supplementaires
      WHERE id = ANY(p_options_ids)
      AND actif = true
    );
  END IF;

  -- Créer l'utilisateur dans la table utilisateurs
  INSERT INTO utilisateurs (
    id,
    email,
    role,
    entreprise_id,
    nom,
    prenom,
    statut,
    created_by
  ) VALUES (
    v_user_id,
    v_client_email,
    'client',
    p_entreprise_id,
    v_client_nom,
    v_client_prenom,
    'active',
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    entreprise_id = EXCLUDED.entreprise_id,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    updated_at = NOW();

  -- Retourner les identifiants
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final,
    'message', 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users.'
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de l''espace membre: %', SQLERRM;
END;
$$;

-- Fonction pour récupérer les identifiants d'un client
CREATE OR REPLACE FUNCTION get_client_credentials(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email text;
  v_user_exists boolean;
  v_espace_actif boolean;
BEGIN
  -- Vérifier les permissions
  IF NOT EXISTS (
    SELECT 1 FROM clients c
    JOIN entreprises e ON e.id = c.entreprise_id
    WHERE c.id = p_client_id
    AND e.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit d''accéder aux identifiants de ce client';
  END IF;

  -- Récupérer l'email du client
  SELECT email INTO v_client_email FROM clients WHERE id = p_client_id;

  IF v_client_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client sans email');
  END IF;

  -- Vérifier si un utilisateur existe dans auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = v_client_email) INTO v_user_exists;

  -- Vérifier si l'espace membre est actif
  SELECT EXISTS(
    SELECT 1 FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
    AND statut = 'active'
  ) INTO v_espace_actif;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_client_email,
    'user_exists', v_user_exists,
    'espace_actif', v_espace_actif,
    'message', CASE 
      WHEN v_user_exists AND v_espace_actif THEN 'Espace membre actif'
      WHEN v_user_exists AND NOT v_espace_actif THEN 'Utilisateur créé mais espace inactif'
      ELSE 'Espace membre non créé'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée un espace membre pour un client existant avec un abonnement et des options. Crée l''utilisateur dans auth.users avec cryptage bcrypt et retourne les identifiants (email + password). Nécessite l''extension pgcrypto.';

COMMENT ON FUNCTION get_client_credentials IS 'Récupère les informations d''identification d''un client (email uniquement, pas le mot de passe pour des raisons de sécurité).';


