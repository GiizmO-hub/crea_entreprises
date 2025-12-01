/*
  # CORRECTION DE LA STRUCTURE DE LA TABLE NOTIFICATIONS
  
  OBJECTIF:
  Adapter la table notifications existante à la nouvelle structure standardisée.
*/

-- Renommer les colonnes existantes si elles existent
DO $$
BEGIN
  -- Renommer "lue" en "read" (avec guillemets car mot réservé)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'notifications' 
             AND column_name = 'lue') THEN
    ALTER TABLE public.notifications RENAME COLUMN lue TO "read";
  END IF;

  -- Renommer "titre" en "title"
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'notifications' 
             AND column_name = 'titre') THEN
    ALTER TABLE public.notifications RENAME COLUMN titre TO title;
  END IF;

  -- Renommer "lien_action" en "link_url"
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'notifications' 
             AND column_name = 'lien_action') THEN
    ALTER TABLE public.notifications RENAME COLUMN lien_action TO link_url;
  END IF;
END $$;

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Ajouter "read" si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'notifications' 
                 AND column_name = 'read') THEN
    ALTER TABLE public.notifications ADD COLUMN "read" boolean DEFAULT false NOT NULL;
  END IF;

  -- Ajouter "read_at" si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'notifications' 
                 AND column_name = 'read_at') THEN
    ALTER TABLE public.notifications ADD COLUMN read_at timestamptz;
  END IF;

  -- Ajouter "link_text" si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'notifications' 
                 AND column_name = 'link_text') THEN
    ALTER TABLE public.notifications ADD COLUMN link_text text;
  END IF;

  -- Ajouter "metadata" si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'notifications' 
                 AND column_name = 'metadata') THEN
    ALTER TABLE public.notifications ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Ajouter "expires_at" si elle n'existe pas
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'notifications' 
             AND column_name = 'expires_at') THEN
    -- Colonne existe déjà, ne rien faire
  ELSE
    ALTER TABLE public.notifications ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Supprimer les colonnes obsolètes si elles existent
DO $$
BEGIN
  -- Supprimer "entreprise_id" si elle existe (on utilise user_id uniquement)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'notifications' 
             AND column_name = 'entreprise_id') THEN
    ALTER TABLE public.notifications DROP COLUMN entreprise_id;
  END IF;
END $$;

-- Mettre à jour la contrainte CHECK pour le type si nécessaire
DO $$
BEGIN
  -- Vérifier si la contrainte existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND constraint_name LIKE '%type%check%'
  ) THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('info', 'success', 'warning', 'error', 'invoice', 'client', 'payment', 'subscription', 'system'));
  END IF;
END $$;

-- Recréer les index si nécessaire
DROP INDEX IF EXISTS idx_notifications_read;
CREATE INDEX IF NOT EXISTS idx_notifications_read 
  ON public.notifications(user_id, "read") WHERE "read" = false;

-- Recréer les fonctions RPC
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

