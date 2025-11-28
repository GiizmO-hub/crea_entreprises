/*
  # Structure de base de données pour les modules par métier
  
  1. Extension de la table modules_activation pour inclure les métiers
  2. Création de la table modules_metier pour catégoriser par secteur d'activité
  3. Création de la table abonnements_modules pour lier modules et abonnements
  4. Organisation progressive des modules par ordre de priorité
  
  IMPORTANT : Pas de modules de comptabilité complète pour l'instant (à créer plus tard avec spécifications)
*/

-- 1. Ajouter colonnes métier à modules_activation si elles n'existent pas
DO $$
BEGIN
  -- Ajouter colonne secteur_activite si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'secteur_activite'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN secteur_activite text;
  END IF;

  -- Ajouter colonne priorite si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN priorite integer DEFAULT 999;
  END IF;

  -- Ajouter colonne icone si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'icone'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN icone text;
  END IF;

  -- Ajouter colonne route si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'route'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN route text;
  END IF;

  -- Ajouter colonne module_parent si elle n'existe pas (pour modules dépendants)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'module_parent'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN module_parent text;
  END IF;

  -- Ajouter colonne prix_optionnel si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'prix_optionnel'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN prix_optionnel numeric(10, 2) DEFAULT 0;
  END IF;

  -- Ajouter colonne est_cree si elle n'existe pas (pour savoir si le module est déjà créé/implémenté)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules_activation' AND column_name = 'est_cree'
  ) THEN
    ALTER TABLE modules_activation ADD COLUMN est_cree boolean DEFAULT false;
  END IF;
END $$;

-- 2. Créer table modules_metier pour catégoriser par secteur d'activité
CREATE TABLE IF NOT EXISTS modules_metier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL REFERENCES modules_activation(module_code) ON DELETE CASCADE,
  secteur_activite text NOT NULL CHECK (secteur_activite IN (
    'btp_construction',
    'services_conseil',
    'commerce_retail',
    'industrie_production',
    'sante_medical',
    'formation_education',
    'transport_logistique',
    'hotellerie_restauration',
    'immobilier',
    'finance_comptabilite', -- Réservé pour plus tard
    'ressources_humaines',
    'marketing_commercial',
    'transversal' -- Modules utilisables par tous les secteurs
  )),
  priorite integer DEFAULT 999, -- Priorité dans ce secteur
  est_essentiel boolean DEFAULT false, -- Module essentiel pour ce secteur
  created_at timestamptz DEFAULT now(),
  UNIQUE(module_code, secteur_activite)
);

-- Index pour améliorer les recherches
CREATE INDEX IF NOT EXISTS idx_modules_metier_secteur ON modules_metier(secteur_activite);
CREATE INDEX IF NOT EXISTS idx_modules_metier_priorite ON modules_metier(priorite);
CREATE INDEX IF NOT EXISTS idx_modules_metier_essentiel ON modules_metier(est_essentiel);

-- 3. Créer table abonnements_modules pour lier modules et abonnements
CREATE TABLE IF NOT EXISTS abonnements_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id uuid REFERENCES abonnements(id) ON DELETE CASCADE,
  module_code text NOT NULL REFERENCES modules_activation(module_code) ON DELETE CASCADE,
  inclus boolean DEFAULT false, -- Si inclus dans l'abonnement par défaut
  prix_optionnel numeric(10, 2) DEFAULT 0, -- Prix si module optionnel pour cet abonnement
  created_at timestamptz DEFAULT now(),
  UNIQUE(abonnement_id, module_code)
);

-- Index pour améliorer les recherches
CREATE INDEX IF NOT EXISTS idx_abonnements_modules_abonnement ON abonnements_modules(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_modules_module ON abonnements_modules(module_code);

-- 4. Activer RLS sur les nouvelles tables
ALTER TABLE modules_metier ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonnements_modules ENABLE ROW LEVEL SECURITY;

-- RLS pour modules_metier : Lecture pour tous, modification pour super admin
CREATE POLICY "Tous peuvent voir modules_metier"
  ON modules_metier FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin peut gérer modules_metier"
  ON modules_metier FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- RLS pour abonnements_modules : Lecture pour tous, modification pour super admin
CREATE POLICY "Tous peuvent voir abonnements_modules"
  ON abonnements_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin peut gérer abonnements_modules"
  ON abonnements_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 5. Créer fonction pour obtenir les modules par secteur d'activité
CREATE OR REPLACE FUNCTION get_modules_by_secteur(
  p_secteur_activite text
)
RETURNS TABLE (
  module_code text,
  module_nom text,
  module_description text,
  categorie text,
  secteur_activite text,
  priorite integer,
  est_essentiel boolean,
  actif boolean,
  est_cree boolean,
  prix_optionnel numeric,
  icone text,
  route text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.module_code,
    m.module_nom,
    m.module_description,
    m.categorie,
    mm.secteur_activite,
    mm.priorite,
    mm.est_essentiel,
    m.actif,
    m.est_cree,
    m.prix_optionnel,
    m.icone,
    m.route
  FROM modules_activation m
  JOIN modules_metier mm ON mm.module_code = m.module_code
  WHERE mm.secteur_activite = p_secteur_activite
  OR mm.secteur_activite = 'transversal'
  ORDER BY mm.priorite ASC, m.module_nom ASC;
END;
$$;

-- 6. Créer fonction pour obtenir les modules d'un abonnement
CREATE OR REPLACE FUNCTION get_modules_by_abonnement(
  p_abonnement_id uuid
)
RETURNS TABLE (
  module_code text,
  module_nom text,
  module_description text,
  categorie text,
  inclus boolean,
  prix_optionnel numeric,
  actif boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.module_code,
    m.module_nom,
    m.module_description,
    m.categorie,
    am.inclus,
    COALESCE(am.prix_optionnel, m.prix_optionnel, 0) as prix_optionnel,
    m.actif
  FROM modules_activation m
  LEFT JOIN abonnements_modules am ON am.module_code = m.module_code AND am.abonnement_id = p_abonnement_id
  WHERE m.categorie = 'core' OR am.abonnement_id IS NOT NULL
  ORDER BY m.categorie, m.module_nom;
END;
$$;

-- 7. Commentaires pour documentation
COMMENT ON TABLE modules_metier IS 'Catégorisation des modules par secteur d''activité';
COMMENT ON TABLE abonnements_modules IS 'Liaison entre abonnements et modules avec prix optionnel';
COMMENT ON COLUMN modules_activation.secteur_activite IS 'Secteur d''activité principal du module';
COMMENT ON COLUMN modules_activation.priorite IS 'Priorité d''affichage/implémentation (1 = priorité haute)';
COMMENT ON COLUMN modules_activation.est_cree IS 'Indique si le module est déjà créé/implémenté dans le code';
COMMENT ON COLUMN modules_metier.est_essentiel IS 'Module essentiel pour ce secteur (toujours visible même si désactivé globalement)';




