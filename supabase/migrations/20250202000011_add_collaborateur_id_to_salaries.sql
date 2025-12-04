/*
  # Ajouter collaborateur_id à la table salaries
  
  Cette migration ajoute la colonne collaborateur_id à la table salaries
  pour lier directement les salaires aux collaborateurs.
*/

-- Ajouter la colonne collaborateur_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'salaries'
    AND column_name = 'collaborateur_id'
  ) THEN
    ALTER TABLE salaries
    ADD COLUMN collaborateur_id uuid REFERENCES collaborateurs_entreprise(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN salaries.collaborateur_id IS 'ID du collaborateur lié à ce salaire';
    
    -- Créer un index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_salaries_collaborateur_id ON salaries(collaborateur_id);
    
    RAISE NOTICE '✅ Colonne collaborateur_id ajoutée à la table salaries';
  ELSE
    RAISE NOTICE '⚠️ La colonne collaborateur_id existe déjà dans salaries';
  END IF;
END $$;

