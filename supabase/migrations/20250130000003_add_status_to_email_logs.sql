/*
  # Ajout du statut et updated_at à email_logs
  
  Permet de tracker l'état des emails via les webhooks Resend
*/

-- Ajouter la colonne status si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE email_logs 
    ADD COLUMN status text DEFAULT 'sent' 
    CHECK (status IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'failed'));
    
    -- Mettre à jour les logs existants
    UPDATE email_logs SET status = 'sent' WHERE status IS NULL;
  END IF;
END $$;

-- Ajouter la colonne updated_at si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE email_logs 
    ADD COLUMN updated_at timestamptz DEFAULT now();
    
    -- Initialiser updated_at pour les logs existants
    UPDATE email_logs SET updated_at = created_at WHERE updated_at IS NULL;
  END IF;
END $$;

-- Créer un index sur status pour les recherches
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Créer un index sur provider_id pour les webhooks
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_id ON email_logs(provider_id);

COMMENT ON COLUMN email_logs.status IS 'Statut de l''email: sent, delivered, bounced, complained, opened, clicked, failed';
COMMENT ON COLUMN email_logs.updated_at IS 'Date de dernière mise à jour (mise à jour via webhooks)';

