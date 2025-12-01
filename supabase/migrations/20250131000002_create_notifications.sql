/*
  # CRÉATION DE LA TABLE NOTIFICATIONS
  
  OBJECTIF:
  Système complet de notifications in-app pour les utilisateurs (plateforme et clients).
  
  STRUCTURE:
  - Une notification par événement/action
  - Support de différents types de notifications
  - Statut lu/non lu
  - Liens vers les ressources concernées
*/

-- ============================================================================
-- CRÉATION DE LA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Contenu de la notification
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'invoice', 'client', 'payment', 'subscription', 'system')),
  
  -- Lien vers la ressource concernée (optionnel)
  link_url text,
  link_text text,
  
  -- Métadonnées
  "read" boolean DEFAULT false NOT NULL,
  read_at timestamptz,
  
  -- Données supplémentaires (JSON)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz -- Pour les notifications temporaires
);

-- ============================================================================
-- INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read 
  ON public.notifications(user_id, "read") WHERE "read" = false;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
  ON public.notifications(type);

-- ============================================================================
-- FONCTION POUR MARQUER COMME LU
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_as_read(notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET "read" = true, read_at = now()
  WHERE id = notification_id
  AND user_id = auth.uid();
END;
$$;

-- ============================================================================
-- FONCTION POUR MARQUER TOUTES COMME LUES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.notifications
  SET "read" = true, read_at = now()
  WHERE user_id = auth.uid()
  AND "read" = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ============================================================================
-- FONCTION POUR COMPTER LES NOTIFICATIONS NON LUES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_unread_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM public.notifications
  WHERE user_id = auth.uid()
  AND "read" = false
  AND (expires_at IS NULL OR expires_at > now());
  
  RETURN unread_count;
END;
$$;

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy pour SELECT : Les utilisateurs peuvent voir leurs propres notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy pour INSERT : Les utilisateurs peuvent créer leurs propres notifications
-- (ou via service role pour les notifications système)
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy pour UPDATE : Les utilisateurs peuvent mettre à jour leurs propres notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy pour DELETE : Les utilisateurs peuvent supprimer leurs propres notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGER POUR NETTOYER LES NOTIFICATIONS EXPIRÉES (optionnel)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL
  AND expires_at < now()
  AND "read" = true; -- Ne supprimer que les notifications lues et expirées
END;
$$;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.notifications IS 
  'Notifications in-app pour les utilisateurs';

COMMENT ON COLUMN public.notifications.type IS 
  'Type de notification: info, success, warning, error, invoice, client, payment, subscription, system';

COMMENT ON COLUMN public.notifications.link_url IS 
  'URL vers la ressource concernée (ex: /factures/123)';

COMMENT ON COLUMN public.notifications.metadata IS 
  'Données supplémentaires au format JSON (ex: facture_id, client_id, etc.)';

