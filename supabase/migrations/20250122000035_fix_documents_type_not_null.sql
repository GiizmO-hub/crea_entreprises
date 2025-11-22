/*
  # Correction de la colonne type dans documents
  L'erreur indique qu'une colonne "type" existe avec une contrainte NOT NULL
  Il faut soit la supprimer si elle existe, soit la gérer correctement
*/

-- Vérifier et corriger la situation de la colonne "type"
DO $$
BEGIN
  -- Si la colonne "type" existe (et pas type_fichier), on la renomme
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    -- Renommer type en type_fichier
    ALTER TABLE documents RENAME COLUMN type TO type_fichier;
    RAISE NOTICE 'Colonne "type" renommée en "type_fichier"';
  END IF;

  -- Si les deux colonnes existent, migrer les données et supprimer type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    -- Migrer les données de type vers type_fichier si type_fichier est NULL
    UPDATE documents 
    SET type_fichier = COALESCE(type_fichier, type, 'autre')
    WHERE type_fichier IS NULL;
    
    -- Supprimer la colonne type
    ALTER TABLE documents DROP COLUMN type;
    RAISE NOTICE 'Colonne "type" supprimée, données migrées vers "type_fichier"';
  END IF;

  -- Si la colonne "type" existe toujours, la rendre nullable ou ajouter valeur par défaut
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) THEN
    BEGIN
      -- Essayer de rendre nullable
      ALTER TABLE documents ALTER COLUMN type DROP NOT NULL;
      ALTER TABLE documents ALTER COLUMN type SET DEFAULT 'autre';
      UPDATE documents SET type = COALESCE(type, 'autre') WHERE type IS NULL;
      RAISE NOTICE 'Colonne "type" rendue nullable avec valeur par défaut';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Impossible de modifier la colonne "type": %', SQLERRM;
    END;
  END IF;

  -- S'assurer que type_fichier existe avec une valeur par défaut
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
  END IF;

  -- Mettre à jour les valeurs NULL
  UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
  
  -- S'assurer que type_fichier est NOT NULL avec valeur par défaut
  BEGIN
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET DEFAULT 'autre';
  EXCEPTION WHEN OTHERS THEN
    -- Si erreur, mettre à jour les NULL d'abord
    UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET DEFAULT 'autre';
  END;
END $$;

-- Ajouter la contrainte CHECK si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND constraint_name = 'documents_type_fichier_check'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_fichier_check;
    ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
    CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));
  END IF;
END $$;

-- Vérifier et afficher toutes les colonnes de la table documents
DO $$
DECLARE
  col_record RECORD;
  col_list text := '';
BEGIN
  FOR col_record IN
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents'
    ORDER BY ordinal_position
  LOOP
    col_list := col_list || col_record.column_name || ' (' || col_record.data_type || ', nullable: ' || col_record.is_nullable || '), ';
  END LOOP;
  
  RAISE NOTICE 'Colonnes de la table documents: %', col_list;
END $$;

