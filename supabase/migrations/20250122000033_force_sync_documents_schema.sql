/*
  # Force la synchronisation complète du schéma documents
  Cette migration vérifie et ajoute TOUTES les colonnes manquantes
  et force la synchronisation du cache Supabase
*/

-- 1. S'assurer que la table existe avec toutes les colonnes
DO $$
BEGIN
  -- Vérifier si la table existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    -- Créer la table complète
    CREATE TABLE documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
      nom text NOT NULL,
      description text,
      categorie text NOT NULL DEFAULT 'autre',
      type_fichier text NOT NULL DEFAULT 'autre',
      taille numeric DEFAULT 0,
      chemin_fichier text NOT NULL,
      tags text[] DEFAULT '{}',
      date_document date DEFAULT CURRENT_DATE,
      date_expiration date,
      statut text NOT NULL DEFAULT 'actif',
      created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    RAISE NOTICE 'Table documents créée';
  ELSE
    RAISE NOTICE 'Table documents existe déjà, vérification des colonnes...';
    
    -- Forcer l'ajout de chaque colonne manquante
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'description'
    ) THEN
      ALTER TABLE documents ADD COLUMN description text;
      RAISE NOTICE 'Colonne description ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'categorie'
    ) THEN
      ALTER TABLE documents ADD COLUMN categorie text NOT NULL DEFAULT 'autre';
      RAISE NOTICE 'Colonne categorie ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'type_fichier'
    ) THEN
      ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
      RAISE NOTICE 'Colonne type_fichier ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'taille'
    ) THEN
      ALTER TABLE documents ADD COLUMN taille numeric DEFAULT 0;
      RAISE NOTICE 'Colonne taille ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'chemin_fichier'
    ) THEN
      ALTER TABLE documents ADD COLUMN chemin_fichier text NOT NULL DEFAULT '';
      -- Mettre à jour les lignes existantes
      UPDATE documents SET chemin_fichier = '' WHERE chemin_fichier IS NULL;
      RAISE NOTICE 'Colonne chemin_fichier ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'tags'
    ) THEN
      ALTER TABLE documents ADD COLUMN tags text[] DEFAULT '{}';
      RAISE NOTICE 'Colonne tags ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'date_document'
    ) THEN
      ALTER TABLE documents ADD COLUMN date_document date DEFAULT CURRENT_DATE;
      RAISE NOTICE 'Colonne date_document ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'date_expiration'
    ) THEN
      ALTER TABLE documents ADD COLUMN date_expiration date;
      RAISE NOTICE 'Colonne date_expiration ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'statut'
    ) THEN
      ALTER TABLE documents ADD COLUMN statut text NOT NULL DEFAULT 'actif';
      RAISE NOTICE 'Colonne statut ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE documents ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
      RAISE NOTICE 'Colonne created_by ajoutée';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE documents ADD COLUMN updated_at timestamptz DEFAULT now();
      RAISE NOTICE 'Colonne updated_at ajoutée';
    END IF;
  END IF;
END $$;

-- 2. S'assurer que toutes les colonnes ont les bonnes contraintes
DO $$
BEGIN
  -- Rendre chemin_fichier NOT NULL si ce n'est pas déjà fait
  BEGIN
    ALTER TABLE documents ALTER COLUMN chemin_fichier SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Si erreur, essayer avec une valeur par défaut d'abord
    UPDATE documents SET chemin_fichier = '' WHERE chemin_fichier IS NULL;
    ALTER TABLE documents ALTER COLUMN chemin_fichier SET NOT NULL;
  END;
  
  -- Rendre categorie NOT NULL si ce n'est pas déjà fait
  BEGIN
    ALTER TABLE documents ALTER COLUMN categorie SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET categorie = 'autre' WHERE categorie IS NULL;
    ALTER TABLE documents ALTER COLUMN categorie SET NOT NULL;
  END;
  
  -- Rendre type_fichier NOT NULL si ce n'est pas déjà fait
  BEGIN
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET type_fichier = 'autre' WHERE type_fichier IS NULL;
    ALTER TABLE documents ALTER COLUMN type_fichier SET NOT NULL;
  END;
  
  -- Rendre statut NOT NULL si ce n'est pas déjà fait
  BEGIN
    ALTER TABLE documents ALTER COLUMN statut SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    UPDATE documents SET statut = 'actif' WHERE statut IS NULL;
    ALTER TABLE documents ALTER COLUMN statut SET NOT NULL;
  END;
END $$;

-- 3. Supprimer et recréer toutes les contraintes CHECK
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_categorie_check;
ALTER TABLE documents ADD CONSTRAINT documents_categorie_check 
  CHECK (categorie IN ('facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_fichier_check;
ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
  CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_statut_check;
ALTER TABLE documents ADD CONSTRAINT documents_statut_check 
  CHECK (statut IN ('actif', 'archive', 'expire'));

-- 4. Forcer la synchronisation en faisant une requête qui liste toutes les colonnes
DO $$
DECLARE
  col_record RECORD;
  col_list text;
BEGIN
  -- Lister toutes les colonnes pour forcer la synchronisation
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documents';
  
  RAISE NOTICE 'Colonnes de la table documents: %', col_list;
END $$;

-- 5. Recréer tous les index
DROP INDEX IF EXISTS idx_documents_entreprise_id;
CREATE INDEX IF NOT EXISTS idx_documents_entreprise_id ON documents(entreprise_id);

DROP INDEX IF EXISTS idx_documents_categorie;
CREATE INDEX IF NOT EXISTS idx_documents_categorie ON documents(categorie);

DROP INDEX IF EXISTS idx_documents_statut;
CREATE INDEX IF NOT EXISTS idx_documents_statut ON documents(statut);

DROP INDEX IF EXISTS idx_documents_date_document;
CREATE INDEX IF NOT EXISTS idx_documents_date_document ON documents(date_document);

DROP INDEX IF EXISTS idx_documents_tags;
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- 6. Activer RLS et recréer toutes les politiques
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Users can view documents of their entreprises" ON documents;
DROP POLICY IF EXISTS "Users can insert documents for their entreprises" ON documents;
DROP POLICY IF EXISTS "Users can update documents of their entreprises" ON documents;
DROP POLICY IF EXISTS "Users can delete documents of their entreprises" ON documents;

-- Recréer les politiques
CREATE POLICY "Users can view documents of their entreprises"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents for their entreprises"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update documents of their entreprises"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents of their entreprises"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- 7. Recréer la fonction et le trigger
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- 8. Commentaire final
COMMENT ON TABLE documents IS 'Table pour gérer tous les documents de l''entreprise avec toutes les colonnes nécessaires';




