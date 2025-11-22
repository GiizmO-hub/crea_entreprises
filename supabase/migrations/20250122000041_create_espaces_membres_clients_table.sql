/*
  # Création de la table espaces_membres_clients
  
  Cette table stocke les espaces membres créés pour chaque client.
  Elle est utilisée par la fonction create_espace_membre_from_client.
*/

-- Créer la table espaces_membres_clients si elle n'existe pas
CREATE TABLE IF NOT EXISTS espaces_membres_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  abonnement_id uuid REFERENCES abonnements(id) ON DELETE SET NULL,
  actif boolean DEFAULT true NOT NULL,
  modules_actifs jsonb DEFAULT '{
    "tableau_de_bord": true,
    "mon_entreprise": true,
    "gestion_clients": true,
    "facturation": true,
    "finances": true,
    "messages": true,
    "automatisation": true,
    "parametres": true
  }'::jsonb,
  preferences jsonb DEFAULT '{
    "theme": "dark",
    "langue": "fr",
    "notifications": true,
    "affichage_complet": true
  }'::jsonb,
  password_temporaire text,
  doit_changer_password boolean DEFAULT false,
  email_envoye boolean DEFAULT false,
  date_email_envoye timestamptz,
  email text,
  derniere_connexion timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(client_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_espaces_membres_client_id ON espaces_membres_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_espaces_membres_entreprise_id ON espaces_membres_clients(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_espaces_membres_user_id ON espaces_membres_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_espaces_membres_abonnement_id ON espaces_membres_clients(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_espaces_membres_actif ON espaces_membres_clients(actif);

-- Activer RLS
ALTER TABLE espaces_membres_clients ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Les clients voient leur propre espace, les entreprises voient les espaces de leurs clients
CREATE POLICY "Clients voient leur propre espace"
  ON espaces_membres_clients FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = espaces_membres_clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique INSERT : Les entreprises peuvent créer des espaces pour leurs clients
CREATE POLICY "Entreprises créent espaces pour leurs clients"
  ON espaces_membres_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique UPDATE : Les propriétaires peuvent modifier les espaces
CREATE POLICY "Propriétaires modifient espaces"
  ON espaces_membres_clients FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = espaces_membres_clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique DELETE : Les entreprises peuvent supprimer les espaces de leurs clients
CREATE POLICY "Entreprises suppriment espaces de leurs clients"
  ON espaces_membres_clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = espaces_membres_clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_espaces_membres_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_espaces_membres_clients_updated_at_trigger ON espaces_membres_clients;
CREATE TRIGGER update_espaces_membres_clients_updated_at_trigger
  BEFORE UPDATE ON espaces_membres_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_espaces_membres_clients_updated_at();

COMMENT ON TABLE espaces_membres_clients IS 'Espaces membres personnalisés pour chaque client avec modules actifs et préférences';
COMMENT ON COLUMN espaces_membres_clients.modules_actifs IS 'Modules activés pour cet espace membre (JSON)';
COMMENT ON COLUMN espaces_membres_clients.preferences IS 'Préférences utilisateur (thème, langue, notifications, etc.)';
COMMENT ON COLUMN espaces_membres_clients.password_temporaire IS 'Mot de passe temporaire généré lors de la création, à changer à la première connexion';

