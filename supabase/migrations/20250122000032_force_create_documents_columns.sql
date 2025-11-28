/*
  # Force la création de toutes les colonnes de la table documents
  Cette migration force la création de toutes les colonnes nécessaires
*/

-- Supprimer la table si elle existe (ATTENTION: cela supprimera les données existantes)
-- DROP TABLE IF EXISTS documents CASCADE;

-- Créer la table documents complète
CREATE TABLE IF NOT EXISTS documents (
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

-- Forcer l'ajout de toutes les colonnes une par une (même si elles existent déjà)
DO $$
BEGIN
  -- chemin_fichier (colonne critique)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'chemin_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN chemin_fichier text NOT NULL DEFAULT '';
    -- Mettre à jour les valeurs NULL existantes
    UPDATE documents SET chemin_fichier = '' WHERE chemin_fichier IS NULL;
    -- Rendre NOT NULL si ce n'est pas déjà fait
    ALTER TABLE documents ALTER COLUMN chemin_fichier SET NOT NULL;
  ELSE
    -- S'assurer que la colonne n'est pas NULL
    ALTER TABLE documents ALTER COLUMN chemin_fichier SET NOT NULL;
    -- Mettre à jour les valeurs NULL existantes
    UPDATE documents SET chemin_fichier = COALESCE(chemin_fichier, '') WHERE chemin_fichier IS NULL;
  END IF;

  -- categorie
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'categorie'
  ) THEN
    ALTER TABLE documents ADD COLUMN categorie text NOT NULL DEFAULT 'autre';
  END IF;

  -- type_fichier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'type_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
  END IF;

  -- taille
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'taille'
  ) THEN
    ALTER TABLE documents ADD COLUMN taille numeric DEFAULT 0;
  END IF;

  -- tags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'tags'
  ) THEN
    ALTER TABLE documents ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  -- date_document
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'date_document'
  ) THEN
    ALTER TABLE documents ADD COLUMN date_document date DEFAULT CURRENT_DATE;
  END IF;

  -- date_expiration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'date_expiration'
  ) THEN
    ALTER TABLE documents ADD COLUMN date_expiration date;
  END IF;

  -- statut
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'statut'
  ) THEN
    ALTER TABLE documents ADD COLUMN statut text NOT NULL DEFAULT 'actif';
  END IF;

  -- created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Supprimer et recréer les contraintes CHECK pour être sûr qu'elles existent
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_categorie_check;
ALTER TABLE documents ADD CONSTRAINT documents_categorie_check 
  CHECK (categorie IN ('facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_fichier_check;
ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
  CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_statut_check;
ALTER TABLE documents ADD CONSTRAINT documents_statut_check 
  CHECK (statut IN ('actif', 'archive', 'expire'));

-- Recréer tous les index
DROP INDEX IF EXISTS idx_documents_entreprise_id;
CREATE INDEX idx_documents_entreprise_id ON documents(entreprise_id);

DROP INDEX IF EXISTS idx_documents_categorie;
CREATE INDEX idx_documents_categorie ON documents(categorie);

DROP INDEX IF EXISTS idx_documents_statut;
CREATE INDEX idx_documents_statut ON documents(statut);

DROP INDEX IF EXISTS idx_documents_date_document;
CREATE INDEX idx_documents_date_document ON documents(date_document);

DROP INDEX IF EXISTS idx_documents_tags;
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- Activer RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Supprimer et recréer toutes les politiques RLS
DROP POLICY IF EXISTS "Users can view documents of their entreprises" ON documents;
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

DROP POLICY IF EXISTS "Users can insert documents for their entreprises" ON documents;
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

DROP POLICY IF EXISTS "Users can update documents of their entreprises" ON documents;
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

DROP POLICY IF EXISTS "Users can delete documents of their entreprises" ON documents;
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

-- Recréer le trigger
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Commentaire sur la table
COMMENT ON TABLE documents IS 'Table pour gérer tous les documents de l''entreprise';




