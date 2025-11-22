/*
  # Création du système de dossiers pour les documents
  Cette migration crée une table pour organiser les documents en dossiers hiérarchiques
  et permet de créer des dossiers par client et des sous-dossiers (ex: salarié -> contrat)
*/

-- 1. Créer la table document_folders
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  couleur text DEFAULT '#3B82F6', -- Couleur pour l'affichage
  ordre integer DEFAULT 0, -- Ordre d'affichage
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, client_id, parent_id, nom) -- Un nom unique par dossier au même niveau
);

-- 2. Ajouter les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_document_folders_entreprise_id ON document_folders(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_client_id ON document_folders(client_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_ordre ON document_folders(entreprise_id, parent_id, ordre);

-- 3. Activer RLS
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS pour document_folders
CREATE POLICY "Users can view folders of their entreprises"
  ON document_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = document_folders.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert folders for their entreprises"
  ON document_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = document_folders.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update folders of their entreprises"
  ON document_folders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = document_folders.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = document_folders.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folders of their entreprises"
  ON document_folders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = document_folders.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- 5. Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_document_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger pour updated_at
CREATE TRIGGER update_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_document_folders_updated_at();

-- 7. Ajouter folder_id et client_id à la table documents
DO $$
BEGIN
  -- Ajouter folder_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
  END IF;

  -- Ajouter client_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'client_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
  END IF;
END $$;

-- 8. Fonction pour obtenir le chemin complet d'un dossier (pour l'affichage)
CREATE OR REPLACE FUNCTION get_folder_path(folder_uuid uuid)
RETURNS text AS $$
DECLARE
  path text := '';
  current_id uuid := folder_uuid;
  folder_name text;
  parent_id uuid;
BEGIN
  LOOP
    SELECT nom, document_folders.parent_id INTO folder_name, parent_id
    FROM document_folders
    WHERE id = current_id;

    IF folder_name IS NULL THEN
      EXIT;
    END IF;

    IF path = '' THEN
      path := folder_name;
    ELSE
      path := folder_name || ' / ' || path;
    END IF;

    IF parent_id IS NULL THEN
      EXIT;
    END IF;

    current_id := parent_id;
  END LOOP;

  RETURN path;
END;
$$ LANGUAGE plpgsql;

-- 9. Fonction pour obtenir tous les dossiers enfants d'un dossier (récursif)
CREATE OR REPLACE FUNCTION get_child_folders(parent_uuid uuid, entreprise_uuid uuid)
RETURNS TABLE(id uuid, nom text, parent_id uuid, client_id uuid, niveau integer) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    -- Dossier racine
    SELECT df.id, df.nom, df.parent_id, df.client_id, 0 AS niveau
    FROM document_folders df
    WHERE df.id = parent_uuid AND df.entreprise_id = entreprise_uuid
    
    UNION ALL
    
    -- Dossiers enfants récursifs
    SELECT df.id, df.nom, df.parent_id, df.client_id, ft.niveau + 1
    FROM document_folders df
    INNER JOIN folder_tree ft ON df.parent_id = ft.id
    WHERE df.entreprise_id = entreprise_uuid
  )
  SELECT * FROM folder_tree WHERE folder_tree.id != parent_uuid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE document_folders IS 'Dossiers hiérarchiques pour organiser les documents par client et par catégorie';

