/*
  # Module de Gestion de Documents Complet
  
  1. Nouvelle table documents
    - `documents`
      - `id` (uuid, primary key)
      - `entreprise_id` (uuid, référence entreprises)
      - `nom` (text)
      - `description` (text)
      - `categorie` (text) - 'facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre'
      - `type_fichier` (text) - 'pdf', 'image', 'excel', 'word', 'autre'
      - `taille` (numeric) - en octets
      - `chemin_fichier` (text) - URL ou chemin du fichier
      - `tags` (text[]) - tableau de tags
      - `date_document` (date) - date du document
      - `date_expiration` (date) - date d'expiration si applicable
      - `statut` (text) - 'actif', 'archive', 'expire'
      - `created_by` (uuid) - utilisateur créateur
      - `created_at`, `updated_at`
  
  2. Index et RLS
    - Index sur entreprise_id, categorie, statut, date_document
    - RLS activé avec politiques appropriées
*/

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  categorie text NOT NULL DEFAULT 'autre' CHECK (categorie IN ('facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre')),
  type_fichier text NOT NULL DEFAULT 'autre' CHECK (type_fichier IN ('pdf', 'image', 'excel', 'word', 'autre')),
  taille numeric DEFAULT 0,
  chemin_fichier text NOT NULL,
  tags text[] DEFAULT '{}',
  date_document date DEFAULT CURRENT_DATE,
  date_expiration date,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'archive', 'expire')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_documents_entreprise_id ON documents(entreprise_id);
CREATE INDEX idx_documents_categorie ON documents(categorie);
CREATE INDEX idx_documents_statut ON documents(statut);
CREATE INDEX idx_documents_date_document ON documents(date_document);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- RLS pour documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

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

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

COMMENT ON TABLE documents IS 'Table pour gérer tous les documents de l''entreprise';

