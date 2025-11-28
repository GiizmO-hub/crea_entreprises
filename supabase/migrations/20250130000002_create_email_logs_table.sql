/*
  # Création de la table email_logs pour tracker les envois d'emails
  
  Cette table permet de :
  - Logger tous les envois d'emails
  - Tracker les emails envoyés par type
  - Vérifier l'historique des communications avec les clients
*/

-- Créer la table email_logs
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('credentials', 'credentials_reset', 'subscription_change', 'modules_update', 'notification', 'invoice')),
  recipient text NOT NULL,
  subject text NOT NULL,
  provider text DEFAULT 'resend',
  provider_id text,
  sent_at timestamptz DEFAULT now(),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);

-- RLS pour email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent voir tous les logs
CREATE POLICY "Platform super_admin can view all email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Les admins peuvent insérer des logs
CREATE POLICY "Platform super_admin can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Les clients peuvent voir leurs propres logs
CREATE POLICY "Clients can view their own email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    recipient = (SELECT email FROM clients WHERE id IN (
      SELECT client_id FROM espaces_membres_clients WHERE user_id = auth.uid()
    ) LIMIT 1)
  );

COMMENT ON TABLE email_logs IS 'Journal des emails envoyés aux clients';
COMMENT ON COLUMN email_logs.email_type IS 'Type d''email: credentials, credentials_reset, subscription_change, modules_update, notification, invoice';
COMMENT ON COLUMN email_logs.provider IS 'Service utilisé pour l''envoi: resend, local-simulated, etc.';
COMMENT ON COLUMN email_logs.provider_id IS 'ID retourné par le service d''email (ex: Resend email ID)';

