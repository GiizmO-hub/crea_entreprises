/*
  # Fix: Ajout colonne mode_paiement si manquante
  
  Cette migration corrige l'erreur "column mode_paiement or relation abonnements does not exist"
  
  Elle :
  1. Crée la table abonnements si elle n'existe pas
  2. Ajoute la colonne mode_paiement si elle manque
  3. Crée la table abonnement_options si elle n'existe pas
*/

-- 1. Créer la table abonnements si elle n'existe pas
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

-- 2. Ajouter la colonne mode_paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'mode_paiement'
  ) THEN
    ALTER TABLE abonnements 
    ADD COLUMN mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));
    
    RAISE NOTICE 'Colonne mode_paiement ajoutée à la table abonnements';
  ELSE
    RAISE NOTICE 'Colonne mode_paiement existe déjà';
  END IF;
END $$;

-- 3. Créer les index si ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_abonnements_entreprise_id ON abonnements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_plan_id ON abonnements(plan_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_statut ON abonnements(statut);

-- 4. Activer RLS si ce n'est pas déjà fait
ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

-- 5. Créer les politiques RLS si elles n'existent pas
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

-- 6. Créer la table abonnement_options si elle n'existe pas
CREATE TABLE IF NOT EXISTS abonnement_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id uuid REFERENCES abonnements(id) ON DELETE CASCADE NOT NULL,
  option_id uuid REFERENCES options_supplementaires(id) ON DELETE RESTRICT NOT NULL,
  date_activation date DEFAULT CURRENT_DATE,
  date_desactivation date,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(abonnement_id, option_id)
);

-- 7. Créer les index pour abonnement_options
CREATE INDEX IF NOT EXISTS idx_abonnement_options_abonnement_id ON abonnement_options(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_abonnement_options_option_id ON abonnement_options(option_id);

-- 8. Activer RLS pour abonnement_options
ALTER TABLE abonnement_options ENABLE ROW LEVEL SECURITY;

-- 9. Créer les politiques RLS pour abonnement_options
DROP POLICY IF EXISTS "Users can view abonnement_options of their entreprises" ON abonnement_options;
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

DROP POLICY IF EXISTS "Users can manage abonnement_options of their entreprises" ON abonnement_options;
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM abonnements
      JOIN entreprises ON entreprises.id = abonnements.entreprise_id
      WHERE abonnements.id = abonnement_options.abonnement_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- 10. Ajouter le trigger updated_at si nécessaire
DROP TRIGGER IF EXISTS update_abonnements_updated_at ON abonnements;
CREATE TRIGGER update_abonnements_updated_at 
  BEFORE UPDATE ON abonnements
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Migration terminée: Table abonnements et colonne mode_paiement vérifiées/créées';
END $$;

