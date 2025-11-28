/*
  # Suppression de la colonne "type" de documents si elle existe
  Cette migration supprime complètement la colonne "type" et s'assure
  que seule "type_fichier" existe
*/

-- Supprimer la colonne "type" si elle existe
DO $$
BEGIN
  -- Si la colonne "type" existe, on la supprime
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) THEN
    -- Vérifier si type_fichier existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'documents' 
      AND column_name = 'type_fichier'
    ) THEN
      -- Les deux colonnes existent, migrer les données puis supprimer type
      UPDATE documents 
      SET type_fichier = COALESCE(type_fichier, type, 'autre')
      WHERE type_fichier IS NULL OR type_fichier = '';
      
      -- Supprimer la colonne type
      ALTER TABLE documents DROP COLUMN type;
      RAISE NOTICE 'Colonne "type" supprimée, données migrées vers "type_fichier"';
    ELSE
      -- Seulement type existe, la renommer en type_fichier
      ALTER TABLE documents RENAME COLUMN type TO type_fichier;
      RAISE NOTICE 'Colonne "type" renommée en "type_fichier"';
    END IF;
  END IF;
END $$;

-- S'assurer que type_fichier existe avec toutes les contraintes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
  END IF;
  
  -- Mettre à jour les valeurs NULL
  UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL OR type_fichier = '';
  
  -- S'assurer que type_fichier est NOT NULL
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

-- S'assurer que la contrainte CHECK existe
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_fichier_check;
  
  -- Créer la nouvelle contrainte
  ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
  CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));
END $$;

-- Vérification finale: Lister toutes les colonnes
DO $$
DECLARE
  col_list text := '';
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documents';
  
  RAISE NOTICE 'Colonnes finales de la table documents: %', col_list;
END $$;




