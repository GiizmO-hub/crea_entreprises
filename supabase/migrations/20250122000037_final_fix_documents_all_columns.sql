/*
  # Correction finale de la table documents
  Cette migration s'assure que toutes les colonnes sont correctes
  et supprime définitivement la colonne "type" si elle existe
*/

-- 1. Supprimer définitivement la colonne "type" si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) THEN
    -- Vérifier si des données doivent être migrées
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'documents' 
      AND column_name = 'type_fichier'
    ) THEN
      -- Migrer les données de type vers type_fichier
      UPDATE documents 
      SET type_fichier = COALESCE(type_fichier, type, 'autre')
      WHERE type_fichier IS NULL OR type_fichier = '';
      
      -- Supprimer la colonne type
      ALTER TABLE documents DROP COLUMN type CASCADE;
      RAISE NOTICE 'Colonne "type" supprimée définitivement';
    ELSE
      -- Renommer type en type_fichier
      ALTER TABLE documents RENAME COLUMN type TO type_fichier;
      RAISE NOTICE 'Colonne "type" renommée en "type_fichier"';
    END IF;
  ELSE
    RAISE NOTICE 'Colonne "type" n''existe pas, tout est OK';
  END IF;
END $$;

-- 2. S'assurer que toutes les colonnes nécessaires existent
DO $$
BEGIN
  -- S'assurer que url existe (colonne NOT NULL dans le schéma réel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'url'
  ) THEN
    ALTER TABLE documents ADD COLUMN url text NOT NULL DEFAULT '';
    RAISE NOTICE 'Colonne "url" ajoutée';
  END IF;

  -- S'assurer que mime_type existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE documents ADD COLUMN mime_type text;
    RAISE NOTICE 'Colonne "mime_type" ajoutée';
  END IF;

  -- S'assurer que url n'est jamais NULL
  UPDATE documents SET url = COALESCE(url, chemin_fichier, '') WHERE url IS NULL;
  
  BEGIN
    ALTER TABLE documents ALTER COLUMN url SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN url SET DEFAULT '';
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET url = COALESCE(url, chemin_fichier, '') WHERE url IS NULL;
    ALTER TABLE documents ALTER COLUMN url SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN url SET DEFAULT '';
  END;
END $$;

-- 3. S'assurer que type_fichier existe et est NOT NULL
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
  UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
  
  -- S'assurer que type_fichier est NOT NULL
  BEGIN
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET DEFAULT 'autre';
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET DEFAULT 'autre';
  END;
END $$;

-- 4. Lister toutes les colonnes finales pour vérification
DO $$
DECLARE
  col_list text := '';
BEGIN
  SELECT string_agg(column_name || ' (' || data_type || ', nullable: ' || is_nullable || ')', ', ' ORDER BY ordinal_position) 
  INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documents';
  
  RAISE NOTICE 'Colonnes finales de documents: %', col_list;
END $$;

