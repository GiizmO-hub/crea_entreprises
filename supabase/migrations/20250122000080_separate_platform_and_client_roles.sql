/*
  # Séparation complète des rôles PLATEFORME et CLIENTS
  
  PROBLÈME:
  - Les rôles plateforme et clients sont confondus
  - Un client avec un rôle super_admin peut bloquer la suppression d'entreprise
  - La fonction delete_entreprise_complete bloque si l'user a le rôle super_admin même si c'est un client
  
  SOLUTION:
  - Distinguer clairement super_admin PLATEFORME vs client_super_admin
  - Un super_admin PLATEFORME n'a JAMAIS d'espace membre client
  - Un client (même client_super_admin) a TOUJOURS un espace membre client
  - Modifier delete_entreprise_complete pour ne bloquer QUE les vrais super admin PLATEFORME
*/

-- ============================================================================
-- PARTIE 1 : Améliorer is_user_platform_super_admin pour distinguer clairement
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_platform_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Si pas d'user_id, retourner false
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- CRITÈRE 1 : Un super admin PLATEFORME n'a JAMAIS d'espace membre client
  -- Si l'utilisateur a un espace membre client, c'est un CLIENT, pas un super admin plateforme
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = p_user_id
  ) THEN
    RETURN false; -- C'est un client, donc pas super admin plateforme
  END IF;
  
  -- CRITÈRE 2 : Vérifier le rôle dans auth.users (doit être 'super_admin', pas 'client_super_admin')
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (raw_user_meta_data->>'role')::text = 'super_admin'
  ) THEN
    RETURN false; -- Pas le bon rôle
  END IF;
  
  -- CRITÈRE 3 : Vérifier dans utilisateurs (doit être 'super_admin', pas 'client_super_admin')
  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = p_user_id
    AND role = 'client_super_admin'
  ) THEN
    RETURN false; -- C'est un client_super_admin, pas un super admin plateforme
  END IF;
  
  -- Si tous les critères sont remplis : c'est un super admin PLATEFORME
  RETURN true;
END;
$$;

COMMENT ON FUNCTION is_user_platform_super_admin(uuid) IS 'Vérifie si un user_id est super_admin PLATEFORME (pas client). Un super admin PLATEFORME n''a JAMAIS d''espace membre client.';

GRANT EXECUTE ON FUNCTION is_user_platform_super_admin(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 2 : Améliorer is_platform_super_admin() pour l'utilisateur connecté
-- ============================================================================

CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Utiliser la fonction helper
  RETURN is_user_platform_super_admin(auth.uid());
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin() IS 'Vérifie si l''utilisateur connecté est super_admin PLATEFORME (pas client)';

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

-- ============================================================================
-- PARTIE 3 : Modifier delete_entreprise_complete pour ne bloquer QUE les vrais super admin PLATEFORME
-- ============================================================================

DROP FUNCTION IF EXISTS delete_entreprise_complete(uuid);

CREATE OR REPLACE FUNCTION delete_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_record RECORD;
  v_espace_record RECORD;
  v_user_id uuid;
  v_abonnement_record RECORD;
  v_clients_count integer := 0;
  v_espaces_count integer := 0;
  v_auth_users_count integer := 0;
  v_abonnements_count integer := 0;
  v_protected_admins_count integer := 0;
  v_entreprise_email text;
  v_entreprise_user_id uuid;
  v_is_platform_super_admin boolean := false;
BEGIN
  -- Vérifier si l'utilisateur est admin ou propriétaire
  IF NOT (
    is_admin_user_simple()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = p_entreprise_id
      AND user_id = auth.uid()
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé'
    );
  END IF;
  
  -- Vérifier que l'entreprise existe
  IF NOT EXISTS (SELECT 1 FROM entreprises WHERE id = p_entreprise_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;
  
  -- Récupérer les infos de l'entreprise AVANT suppression
  SELECT email, user_id INTO v_entreprise_email, v_entreprise_user_id
  FROM entreprises
  WHERE id = p_entreprise_id;
  
  -- Vérifier si le propriétaire de l'entreprise est un VRAI super admin PLATEFORME
  -- (pas un client, même si son rôle est super_admin)
  IF v_entreprise_user_id IS NOT NULL THEN
    v_is_platform_super_admin := is_user_platform_super_admin(v_entreprise_user_id);
    
    -- NE bloquer QUE si c'est un VRAI super admin PLATEFORME (qui n'a pas d'espace membre client)
    IF v_is_platform_super_admin THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Impossible de supprimer une entreprise appartenant à un super administrateur de la plateforme'
      );
    END IF;
    -- Sinon, c'est soit un client, soit un utilisateur normal → on peut supprimer
  END IF;
  
  -- ========================================================================
  -- ÉTAPE 1 : Supprimer tous les auth.users des clients et espaces membres
  -- ========================================================================
  
  -- Pour chaque client de cette entreprise
  FOR v_client_record IN 
    SELECT id, email FROM clients WHERE entreprise_id = p_entreprise_id
  LOOP
    -- Supprimer les auth.users via les espaces membres
    FOR v_espace_record IN
      SELECT user_id, email 
      FROM espaces_membres_clients 
      WHERE client_id = v_client_record.id
      AND (user_id IS NOT NULL OR email IS NOT NULL)
    LOOP
      -- Supprimer par user_id (UNIQUEMENT si ce n'est pas un super admin PLATEFORME)
      IF v_espace_record.user_id IS NOT NULL THEN
        -- Vérifier si c'est un super admin PLATEFORME
        IF NOT is_user_platform_super_admin(v_espace_record.user_id) THEN
          BEGIN
            DELETE FROM auth.users WHERE id = v_espace_record.user_id;
            v_auth_users_count := v_auth_users_count + 1;
          EXCEPTION WHEN OTHERS THEN
            -- Ignorer si déjà supprimé
            NULL;
          END;
        ELSE
          -- C'est un super admin PLATEFORME, on ne le supprime pas
          v_protected_admins_count := v_protected_admins_count + 1;
        END IF;
      END IF;
      
      -- Supprimer par email (au cas où, mais avec vérification)
      IF v_espace_record.email IS NOT NULL AND v_espace_record.email != '' THEN
        DECLARE
          v_email_user_id uuid;
        BEGIN
          SELECT id INTO v_email_user_id
          FROM auth.users
          WHERE email = v_espace_record.email
          LIMIT 1;
          
          IF v_email_user_id IS NOT NULL AND NOT is_user_platform_super_admin(v_email_user_id) THEN
            BEGIN
              PERFORM delete_auth_user_by_email(v_espace_record.email);
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END;
      END IF;
    END LOOP;
    
    -- Supprimer aussi l'auth.user du client directement par email (UNIQUEMENT si pas super admin PLATEFORME)
    IF v_client_record.email IS NOT NULL AND v_client_record.email != '' THEN
      DECLARE
        v_client_user_id uuid;
      BEGIN
        SELECT id INTO v_client_user_id
        FROM auth.users
        WHERE email = v_client_record.email
        LIMIT 1;
        
        -- Supprimer uniquement si ce n'est pas un super admin PLATEFORME
        IF v_client_user_id IS NOT NULL AND NOT is_user_platform_super_admin(v_client_user_id) THEN
          BEGIN
            PERFORM delete_auth_user_by_email(v_client_record.email);
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        ELSE
          v_protected_admins_count := v_protected_admins_count + 1;
        END IF;
      END;
    END IF;
    
    v_clients_count := v_clients_count + 1;
  END LOOP;
  
  -- Supprimer l'auth.user de l'entreprise elle-même (UNIQUEMENT si pas super admin PLATEFORME)
  IF v_entreprise_user_id IS NOT NULL AND NOT v_is_platform_super_admin THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_entreprise_user_id;
      v_auth_users_count := v_auth_users_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSIF v_is_platform_super_admin THEN
    -- C'est un super admin PLATEFORME, on ne le supprime pas
    v_protected_admins_count := v_protected_admins_count + 1;
  END IF;
  
  -- Supprimer par email aussi (si différent)
  IF v_entreprise_email IS NOT NULL AND v_entreprise_email != '' THEN
    DECLARE
      v_entreprise_email_user_id uuid;
    BEGIN
      SELECT id INTO v_entreprise_email_user_id
      FROM auth.users
      WHERE email = v_entreprise_email
      LIMIT 1;
      
      -- Supprimer uniquement si ce n'est pas un super admin PLATEFORME
      IF v_entreprise_email_user_id IS NOT NULL 
         AND NOT is_user_platform_super_admin(v_entreprise_email_user_id)
         AND v_entreprise_email_user_id != v_entreprise_user_id THEN
        BEGIN
          PERFORM delete_auth_user_by_email(v_entreprise_email);
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END;
  END IF;
  
  -- ========================================================================
  -- ÉTAPE 2 : Supprimer tous les abonnements de l'entreprise
  -- ========================================================================
  
  FOR v_abonnement_record IN
    SELECT id, user_id FROM abonnements WHERE entreprise_id = p_entreprise_id
  LOOP
    DELETE FROM abonnements WHERE id = v_abonnement_record.id;
    v_abonnements_count := v_abonnements_count + 1;
  END LOOP;
  
  -- ========================================================================
  -- ÉTAPE 3 : Supprimer tous les espaces membres clients
  -- ========================================================================
  
  SELECT COUNT(*) INTO v_espaces_count
  FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  DELETE FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- ========================================================================
  -- ÉTAPE 4 : Supprimer tous les clients
  -- ========================================================================
  
  DELETE FROM clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- ========================================================================
  -- ÉTAPE 5 : Supprimer tous les autres éléments liés
  -- ========================================================================
  
  DELETE FROM invitations_clients WHERE entreprise_id = p_entreprise_id;
  DELETE FROM notifications_espace_client WHERE entreprise_id = p_entreprise_id;
  DELETE FROM factures_clients WHERE entreprise_id = p_entreprise_id;
  DELETE FROM avoirs_clients WHERE entreprise_id = p_entreprise_id;
  DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
  DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
  
  BEGIN
    DELETE FROM previsionnels WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM collaborateurs_entreprise WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- ========================================================================
  -- ÉTAPE 6 : Supprimer l'entreprise elle-même
  -- ========================================================================
  
  DELETE FROM entreprises
  WHERE id = p_entreprise_id;
  
  -- Retourner le résumé avec info sur les admins protégés
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée : %s client(s), %s espace(s), %s abonnement(s), %s auth.user(s) supprimé(s). %s super admin(s) PLATEFORME protégé(s).',
      v_clients_count,
      v_espaces_count,
      v_abonnements_count,
      v_auth_users_count,
      v_protected_admins_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'auth_users_deleted', v_auth_users_count,
    'protected_platform_admins', v_protected_admins_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié. NE BLOQUE QUE si le propriétaire est un VRAI super admin PLATEFORME (pas un client).';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Documentation de la séparation des rôles
-- ============================================================================

-- La distinction est maintenant claire :
-- 
-- SUPER ADMIN PLATEFORME:
--   - Rôle dans auth.users: 'super_admin'
--   - Rôle dans utilisateurs: 'super_admin' (pas 'client_super_admin')
--   - N'a JAMAIS d'espace membre client (pas d'entrée dans espaces_membres_clients)
--   - Gère la plateforme, les clients, les modules, etc.
--   - NE PEUT PAS supprimer son entreprise (protection)
--
-- CLIENT SUPER ADMIN:
--   - Rôle dans auth.users: 'client_super_admin'
--   - Rôle dans utilisateurs: 'client_super_admin'
--   - A TOUJOURS un espace membre client (entrée dans espaces_membres_clients)
--   - Gère son espace client uniquement
--   - PEUT supprimer son entreprise (pas de protection)

