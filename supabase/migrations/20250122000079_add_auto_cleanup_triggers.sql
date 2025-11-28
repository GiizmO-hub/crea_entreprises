/*
  # Ajouter les triggers de nettoyage automatique des emails
  
  PROBLÈME:
  - Les triggers de suppression automatique des auth.users ont été retirés
  - Besoin de nettoyage automatique lors des suppressions futures
  
  SOLUTION:
  - Créer les triggers pour supprimer automatiquement les auth.users
  - Protéger les super admin PLATEFORME
*/

-- ============================================================================
-- PARTIE 1 : Trigger pour supprimer auth.users lors de la suppression d'un client
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_delete_client_auth_user ON clients;

CREATE OR REPLACE FUNCTION delete_client_auth_user_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Récupérer le user_id depuis les espaces membres ou clients
  SELECT user_id INTO v_user_id
  FROM espaces_membres_clients
  WHERE client_id = OLD.id
  LIMIT 1;
  
  -- Si pas trouvé, essayer par email dans clients
  IF v_user_id IS NULL AND OLD.email IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = OLD.email
    LIMIT 1;
  END IF;
  
  -- Supprimer l'auth user si trouvé (sauf si c'est un super admin plateforme)
  IF v_user_id IS NOT NULL THEN
    -- Vérifier si c'est un super admin plateforme (utiliser la fonction helper)
    IF NOT (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = v_user_id
        AND (raw_user_meta_data->>'role')::text = 'super_admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM espaces_membres_clients WHERE user_id = v_user_id
      )
    ) THEN
      -- Ce n'est pas un super admin plateforme, on peut supprimer
      DELETE FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_delete_client_auth_user
  AFTER DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION delete_client_auth_user_trigger();

COMMENT ON FUNCTION delete_client_auth_user_trigger() IS 'Supprime automatiquement l''auth.user lors de la suppression d''un client (protège les super admin PLATEFORME)';

-- ============================================================================
-- PARTIE 2 : Trigger pour supprimer auth.users lors de la suppression d'un collaborateur
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_delete_collaborateur_auth_user ON collaborateurs;

CREATE OR REPLACE FUNCTION delete_collaborateur_auth_user_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email_user_id uuid;
BEGIN
  -- Supprimer l'auth user si présent (sauf si c'est un super admin plateforme)
  IF OLD.user_id IS NOT NULL THEN
    -- Vérifier si c'est un super admin plateforme
    IF NOT (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = OLD.user_id
        AND (raw_user_meta_data->>'role')::text = 'super_admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM espaces_membres_clients WHERE user_id = OLD.user_id
      )
    ) THEN
      -- Ce n'est pas un super admin plateforme, on peut supprimer
      DELETE FROM auth.users WHERE id = OLD.user_id;
    END IF;
  END IF;
  
  -- Aussi supprimer par email au cas où
  IF OLD.email IS NOT NULL THEN
    BEGIN
      SELECT id INTO v_email_user_id
      FROM auth.users
      WHERE email = OLD.email
      LIMIT 1;
      
      IF v_email_user_id IS NOT NULL AND v_email_user_id != OLD.user_id THEN
        -- Vérifier si c'est un super admin plateforme
        IF NOT (
          EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = v_email_user_id
            AND (raw_user_meta_data->>'role')::text = 'super_admin'
          )
          AND NOT EXISTS (
            SELECT 1 FROM espaces_membres_clients WHERE user_id = v_email_user_id
          )
        ) THEN
          -- Ce n'est pas un super admin plateforme, on peut supprimer
          DELETE FROM auth.users WHERE id = v_email_user_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_delete_collaborateur_auth_user
  AFTER DELETE ON collaborateurs
  FOR EACH ROW
  EXECUTE FUNCTION delete_collaborateur_auth_user_trigger();

COMMENT ON FUNCTION delete_collaborateur_auth_user_trigger() IS 'Supprime automatiquement l''auth.user lors de la suppression d''un collaborateur (protège les super admin PLATEFORME)';

-- ============================================================================
-- PARTIE 3 : Trigger pour supprimer auth.users lors de la suppression d'un espace membre
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_delete_espace_membre_auth_user ON espaces_membres_clients;

CREATE OR REPLACE FUNCTION delete_espace_membre_auth_user_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Supprimer l'auth user si présent (sauf si c'est un super admin plateforme)
  IF OLD.user_id IS NOT NULL THEN
    -- Vérifier si c'est un super admin plateforme
    IF NOT (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = OLD.user_id
        AND (raw_user_meta_data->>'role')::text = 'super_admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM espaces_membres_clients emc2
        WHERE emc2.user_id = OLD.user_id
        AND emc2.id != OLD.id
      )
    ) THEN
      -- Ce n'est pas un super admin plateforme, on peut supprimer
      -- Mais vérifier qu'il n'y a pas d'autres espaces membres pour ce user
      IF NOT EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = OLD.user_id
        AND id != OLD.id
      ) THEN
        DELETE FROM auth.users WHERE id = OLD.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_delete_espace_membre_auth_user
  AFTER DELETE ON espaces_membres_clients
  FOR EACH ROW
  EXECUTE FUNCTION delete_espace_membre_auth_user_trigger();

COMMENT ON FUNCTION delete_espace_membre_auth_user_trigger() IS 'Supprime automatiquement l''auth.user lors de la suppression d''un espace membre (si c''est le dernier espace, protège les super admin PLATEFORME)';




