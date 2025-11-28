/*
  # Création de la table abonnements
  
  Cette migration crée la table abonnements si elle n'existe pas déjà.
  Elle est nécessaire pour la création d'espaces membres avec abonnements.
*/

-- Créer la table abonnements si elle n'existe pas
CREATE TABLE IF NOT EXISTS abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid NOT NULL REFERENCES plans_abonnement(id),
  statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'annule', 'expire')),
  date_debut date DEFAULT CURRENT_DATE,
  date_fin date,
  date_prochain_paiement date,
  montant_mensuel numeric DEFAULT 0,
  mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_abonnements_entreprise_id ON abonnements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_plan_id ON abonnements(plan_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_statut ON abonnements(statut);

-- Activer RLS
ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour abonnements
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
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

DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
CREATE POLICY "Users can insert abonnements for their entreprises"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;
CREATE POLICY "Users can update abonnements of their entreprises"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete abonnements of their entreprises" ON abonnements;
CREATE POLICY "Users can delete abonnements of their entreprises"
  ON abonnements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Créer la table abonnement_options si elle n'existe pas
CREATE TABLE IF NOT EXISTS abonnement_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id uuid NOT NULL REFERENCES abonnements(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES options_supplementaires(id),
  date_activation date DEFAULT CURRENT_DATE,
  date_desactivation date,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(abonnement_id, option_id)
);

-- Créer les index pour abonnement_options
CREATE INDEX IF NOT EXISTS idx_abonnement_options_abonnement_id ON abonnement_options(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_abonnement_options_option_id ON abonnement_options(option_id);

-- Activer RLS pour abonnement_options
ALTER TABLE abonnement_options ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour abonnement_options
DROP POLICY IF EXISTS "Users can view abonnement_options of their entreprises" ON abonnement_options;
CREATE POLICY "Users can view abonnement_options of their entreprises"
  ON abonnement_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM abonnements a
      JOIN entreprises e ON e.id = a.entreprise_id
      WHERE a.id = abonnement_options.abonnement_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert abonnement_options for their entreprises" ON abonnement_options;
CREATE POLICY "Users can insert abonnement_options for their entreprises"
  ON abonnement_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM abonnements a
      JOIN entreprises e ON e.id = a.entreprise_id
      WHERE a.id = abonnement_options.abonnement_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update abonnement_options of their entreprises" ON abonnement_options;
CREATE POLICY "Users can update abonnement_options of their entreprises"
  ON abonnement_options FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM abonnements a
      JOIN entreprises e ON e.id = a.entreprise_id
      WHERE a.id = abonnement_options.abonnement_id
      AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM abonnements a
      JOIN entreprises e ON e.id = a.entreprise_id
      WHERE a.id = abonnement_options.abonnement_id
      AND e.user_id = auth.uid()
    )
  );

COMMENT ON TABLE abonnements IS 'Table des abonnements des entreprises aux plans d''abonnement';
COMMENT ON TABLE abonnement_options IS 'Table de liaison entre les abonnements et les options supplémentaires souscrites';




