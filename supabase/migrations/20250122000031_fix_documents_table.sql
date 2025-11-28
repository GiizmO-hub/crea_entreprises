/*
  # Correction de la table documents
  Vérifie et ajoute les colonnes manquantes à la table documents
*/

-- Vérifier si la table existe, sinon la créer
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

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Ajouter categorie si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'categorie'
  ) THEN
    ALTER TABLE documents ADD COLUMN categorie text NOT NULL DEFAULT 'autre';
  END IF;

  -- Ajouter type_fichier si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'type_fichier'
  ) THEN
    ALTER TABLE documents ADD COLUMN type_fichier text NOT NULL DEFAULT 'autre';
  END IF;

  -- Ajouter taille si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'taille'
  ) THEN
    ALTER TABLE documents ADD COLUMN taille numeric DEFAULT 0;
  END IF;

  -- Ajouter tags si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'tags'
  ) THEN
    ALTER TABLE documents ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  -- Ajouter date_document si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'date_document'
  ) THEN
    ALTER TABLE documents ADD COLUMN date_document date DEFAULT CURRENT_DATE;
  END IF;

  -- Ajouter date_expiration si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'date_expiration'
  ) THEN
    ALTER TABLE documents ADD COLUMN date_expiration date;
  END IF;

  -- Ajouter statut si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'statut'
  ) THEN
    ALTER TABLE documents ADD COLUMN statut text NOT NULL DEFAULT 'actif';
  END IF;

  -- Ajouter created_by si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Ajouter updated_at si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Ajouter les contraintes CHECK si elles n'existent pas
DO $$
BEGIN
  -- Contrainte categorie
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents' AND constraint_name = 'documents_categorie_check'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_categorie_check 
    CHECK (categorie IN ('facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre'));
  END IF;

  -- Contrainte type_fichier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents' AND constraint_name = 'documents_type_fichier_check'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_type_fichier_check 
    CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre'));
  END IF;

  -- Contrainte statut
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents' AND constraint_name = 'documents_statut_check'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_statut_check 
    CHECK (statut IN ('actif', 'archive', 'expire'));
  END IF;
END $$;

-- Créer les index s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_documents_entreprise_id ON documents(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_documents_categorie ON documents(categorie);
CREATE INDEX IF NOT EXISTS idx_documents_statut ON documents(statut);
CREATE INDEX IF NOT EXISTS idx_documents_date_document ON documents(date_document);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- Activer RLS si ce n'est pas déjà fait
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS si elles n'existent pas
DO $$
BEGIN
  -- Politique SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can view documents of their entreprises'
  ) THEN
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
  END IF;

  -- Politique INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can insert documents for their entreprises'
  ) THEN
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
  END IF;

  -- Politique UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can update documents of their entreprises'
  ) THEN
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
  END IF;

  -- Politique DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can delete documents of their entreprises'
  ) THEN
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
  END IF;
END $$;

-- Créer la fonction trigger pour updated_at si elle n'existe pas
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger si il n'existe pas
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();




