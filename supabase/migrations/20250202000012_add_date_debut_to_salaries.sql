/*
  # Ajouter date_debut à la table salaries
  
  Cette migration ajoute la colonne date_debut à la table salaries
  pour indiquer la date de début du salaire.
*/

-- Ajouter la colonne date_debut si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'salaries'
    AND column_name = 'date_debut'
  ) THEN
    ALTER TABLE salaries
    ADD COLUMN date_debut date;
    
    COMMENT ON COLUMN salaries.date_debut IS 'Date de début du salaire';
    
    -- Si date_embauche existe, copier les valeurs
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'salaries'
      AND column_name = 'date_embauche'
    ) THEN
      UPDATE salaries
      SET date_debut = date_embauche
      WHERE date_debut IS NULL AND date_embauche IS NOT NULL;
    END IF;
    
    RAISE NOTICE '✅ Colonne date_debut ajoutée à la table salaries';
  ELSE
    RAISE NOTICE '⚠️ La colonne date_debut existe déjà dans salaries';
  END IF;
END $$;

