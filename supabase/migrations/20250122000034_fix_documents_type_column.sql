/*
  # Correction de la colonne type dans documents
  L'erreur indique qu'une colonne "type" existe avec une contrainte NOT NULL
  mais elle n'est pas dans notre schéma. Il faut soit l'ajouter, soit vérifier
  si c'est "type_fichier" qui est mal nommée.
*/

-- Vérifier si la colonne "type" existe
DO $$
BEGIN
  -- Si la colonne "type" existe, vérifier si c'est la même chose que "type_fichier"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) THEN
    -- Si "type_fichier" n'existe pas, renommer "type" en "type_fichier"
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'documents' 
      AND column_name = 'type_fichier'
    ) THEN
      ALTER TABLE documents RENAME COLUMN type TO type_fichier;
      RAISE NOTICE 'Colonne "type" renommée en "type_fichier"';
    ELSE
      -- Si les deux existent, supprimer "type" et copier les données vers "type_fichier"
      UPDATE documents SET type_fichier = COALESCE(type_fichier, type) WHERE type_fichier IS NULL;
      ALTER TABLE documents DROP COLUMN IF EXISTS type;
      RAISE NOTICE 'Colonne "type" supprimée, données migrées vers "type_fichier"';
    END IF;
  END IF;

  -- S'assurer que "type_fichier" existe et a une valeur par défaut
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
  END IF;

  -- S'assurer que type_fichier n'est jamais NULL
  UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
  ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
  ALTER TABLE documents ALTER COLUMN type_fichier SET DEFAULT 'autre';
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
    ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
    CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));
  END IF;
END $$;

-- Si la colonne "type" existe toujours et cause des problèmes, on peut aussi la rendre nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'type'
  ) THEN
    -- Vérifier si elle est NOT NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'documents' 
      AND column_name = 'type'
      AND is_nullable = 'NO'
    ) THEN
      -- Rendre nullable ou ajouter valeur par défaut
      BEGIN
        ALTER TABLE documents ALTER COLUMN type DROP NOT NULL;
        ALTER TABLE documents ALTER COLUMN type SET DEFAULT 'autre';
        UPDATE documents SET type = 'autre' WHERE type IS NULL;
        RAISE NOTICE 'Colonne "type" rendue nullable avec valeur par défaut';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Impossible de modifier la colonne "type": %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;




