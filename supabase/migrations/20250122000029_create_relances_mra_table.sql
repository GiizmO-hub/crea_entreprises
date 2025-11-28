/*
  # Table des relances MRA (Mise en Recouvrement d'Avoirs)
  
  1. Nouvelle table
    - `relances_mra`
      - `id` (uuid, primary key)
      - `facture_id` (uuid, référence factures)
      - `entreprise_id` (uuid, référence entreprises)
      - `client_id` (uuid, référence clients)
      - `numero_relance` (text, unique)
      - `date_relance` (date)
      - `type_relance` (text) - 'premiere', 'deuxieme', 'mise_en_demeure', 'injonction_de_payer'
      - `montant_due` (numeric)
      - `frais_recouvrement` (numeric, default 0)
      - `statut` (text) - 'envoyee', 'recue', 'payee', 'annulee'
      - `notes` (text)
      - `created_at`, `updated_at`
  
  2. Index et RLS
    - Index sur facture_id, entreprise_id, client_id
    - RLS activé avec politiques appropriées
*/

CREATE TABLE IF NOT EXISTS relances_mra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE SET NULL,
  numero_relance text NOT NULL,
  date_relance date NOT NULL DEFAULT CURRENT_DATE,
  type_relance text NOT NULL DEFAULT 'premiere' CHECK (type_relance IN ('premiere', 'deuxieme', 'mise_en_demeure', 'injonction_de_payer')),
  montant_due numeric NOT NULL DEFAULT 0,
  frais_recouvrement numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'envoyee' CHECK (statut IN ('envoyee', 'recue', 'payee', 'annulee')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, numero_relance)
);

CREATE INDEX idx_relances_mra_facture_id ON relances_mra(facture_id);
CREATE INDEX idx_relances_mra_entreprise_id ON relances_mra(entreprise_id);
CREATE INDEX idx_relances_mra_client_id ON relances_mra(client_id);
CREATE INDEX idx_relances_mra_statut ON relances_mra(statut);
CREATE INDEX idx_relances_mra_date_relance ON relances_mra(date_relance);

-- RLS pour relances_mra
ALTER TABLE relances_mra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relances_mra of their entreprises"
  ON relances_mra FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = relances_mra.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage relances_mra of their entreprises"
  ON relances_mra FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = relances_mra.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

COMMENT ON TABLE relances_mra IS 'Table pour gérer les relances MRA (Mise en Recouvrement d''Avoirs)';




