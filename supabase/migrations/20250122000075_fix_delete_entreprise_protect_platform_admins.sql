/*
  # Correction : Protéger les super admin PLATEFORME lors de la suppression d'entreprise
  
  PROBLÈME:
  - La fonction delete_entreprise_complete() pourrait supprimer un super admin PLATEFORME
  - Il faut distinguer super_admin (plateforme) et client_super_admin (client)
  - Les super admin PLATEFORME ne doivent JAMAIS être supprimés
  
  SOLUTION:
  - Utiliser is_platform_super_admin() pour vérifier si un user est super admin plateforme
  - Ne jamais supprimer les auth.users des super admin PLATEFORME
  - Supprimer uniquement les client_super_admin et clients normaux
*/

-- ============================================================================
-- PARTIE 1 : Fonction helper pour vérifier si un user est super admin PLATEFORME
-- ============================================================================

-- Fonction pour vérifier si un user_id spécifique est super admin PLATEFORME
CREATE OR REPLACE FUNCTION is_user_platform_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  user_role text;
  has_client_space boolean;
BEGIN
  -- Si pas d'user_id, retourner false
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier si l'utilisateur est un client (a un espace membre)
  -- Si c'est un client, il n'est JAMAIS super_admin plateforme
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = p_user_id
  ) INTO has_client_space;
  
  IF has_client_space THEN
    RETURN false; -- C'est un client, donc pas super admin plateforme
  END IF;
  
  -- Vérifier le rôle dans auth.users
  SELECT COALESCE(
    (raw_user_meta_data->>'role')::text,
    ''
  ) INTO user_role
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Vérifier aussi dans utilisateurs pour être sûr
  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = p_user_id
    AND role = 'super_admin'
  ) THEN
    -- Double vérification : si dans utilisateurs et pas dans espaces_membres_clients, c'est plateforme
    RETURN true;
  END IF;
  
  -- Retourner true seulement si c'est 'super_admin' (pas 'client_super_admin')
  RETURN user_role = 'super_admin';
END;
$$;

COMMENT ON FUNCTION is_user_platform_super_admin(uuid) IS 'Vérifie si un user_id spécifique est super_admin PLATEFORME (pas client)';

GRANT EXECUTE ON FUNCTION is_user_platform_super_admin(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 2 : Corriger delete_entreprise_complete() pour protéger les super admin PLATEFORME
-- ============================================================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS delete_entreprise_complete(uuid);

-- Créer la nouvelle fonction qui protège les super admin PLATEFORME
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
  
  -- Vérifier si le propriétaire de l'entreprise est un super admin PLATEFORME
  IF v_entreprise_user_id IS NOT NULL AND is_user_platform_super_admin(v_entreprise_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible de supprimer une entreprise appartenant à un super administrateur de la plateforme'
    );
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
        -- Ne pas supprimer si c'est un super admin PLATEFORME
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
  IF v_entreprise_user_id IS NOT NULL THEN
    -- Vérifier si c'est un super admin PLATEFORME (NE PAS supprimer)
    IF NOT is_user_platform_super_admin(v_entreprise_user_id) THEN
      BEGIN
        DELETE FROM auth.users WHERE id = v_entreprise_user_id;
        v_auth_users_count := v_auth_users_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSE
      -- C'est un super admin PLATEFORME, on ne le supprime pas
      v_protected_admins_count := v_protected_admins_count + 1;
    END IF;
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

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié, EN PROTÉGEANT les super admin PLATEFORME (ne supprime jamais les auth.users des super_admin plateforme, seulement les client_super_admin et clients normaux)';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;




