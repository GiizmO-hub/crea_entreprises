/*
  # Ajouter la colonne salaire à collaborateurs_entreprise
  
  PROBLÈME:
  - La fonction create_collaborateur essaie d'insérer dans la colonne "salaire"
  - Mais cette colonne n'existe pas dans la table collaborateurs_entreprise
  - Erreur: column "salaire" of relation "collaborateurs_entreprise" does not exist
  
  SOLUTION:
  - Ajouter la colonne salaire à la table collaborateurs_entreprise
*/

-- Ajouter la colonne salaire si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'salaire'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN salaire numeric(12,2);
    
    COMMENT ON COLUMN collaborateurs_entreprise.salaire IS 'Salaire brut du collaborateur';
    
    RAISE NOTICE '✅ Colonne salaire ajoutée à collaborateurs_entreprise';
  ELSE
    RAISE NOTICE '✅ La colonne salaire existe déjà dans collaborateurs_entreprise';
  END IF;
END $$;

-- Ajouter aussi les autres colonnes qui pourraient manquer
DO $$
BEGIN
  -- Ajouter poste si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'poste'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN poste text;
    RAISE NOTICE '✅ Colonne poste ajoutée';
  END IF;

  -- Ajouter emploi si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'emploi'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN emploi text;
    RAISE NOTICE '✅ Colonne emploi ajoutée';
  END IF;

  -- Ajouter date_entree si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'date_entree'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN date_entree date;
    RAISE NOTICE '✅ Colonne date_entree ajoutée';
  END IF;
END $$;

SELECT '✅ Migration terminée : colonnes ajoutées à collaborateurs_entreprise' as resultat;

