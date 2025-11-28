/*
  # Correction : Erreur "column user_id does not exist" dans delete_entreprise_complete
  
  PROBLÈME:
  - La fonction delete_entreprise_complete() essaie d'accéder à entreprises.user_id
  - Mais cette colonne n'existe peut-être pas ou n'est pas nécessaire pour la suppression
  
  SOLUTION:
  - Vérifier si la colonne existe avant de l'utiliser
  - Simplifier la fonction pour ne pas dépendre de user_id
  - Utiliser uniquement l'entreprise_id pour la suppression
*/

-- ============================================================================
-- PARTIE 1 : Vérifier si la colonne user_id existe dans entreprises
-- ============================================================================

DO $$
DECLARE
  v_has_user_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entreprises' 
    AND column_name = 'user_id'
  ) INTO v_has_user_id;
  
  IF v_has_user_id THEN
    RAISE NOTICE '✅ La colonne user_id existe dans entreprises';
  ELSE
    RAISE NOTICE '⚠️  La colonne user_id n''existe PAS dans entreprises';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Corriger delete_entreprise_complete pour ne plus dépendre de user_id
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
  v_abonnement_record RECORD;
  v_clients_count integer := 0;
  v_espaces_count integer := 0;
  v_auth_users_count integer := 0;
  v_abonnements_count integer := 0;
  v_protected_admins_count integer := 0;
  v_entreprise_email text;
  v_is_caller_platform_super_admin boolean := false;
  v_has_user_id_column boolean;
BEGIN
  -- Vérifier si l'appelant est un super admin PLATEFORME
  v_is_caller_platform_super_admin := is_platform_super_admin();
  
  -- Vérifier si l'utilisateur est admin OU super admin PLATEFORME
  IF NOT (
    v_is_caller_platform_super_admin
    OR is_admin_user_simple()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Admin requis'
    );
  END IF;
  
  -- Vérifier que l'entreprise existe
  IF NOT EXISTS (SELECT 1 FROM entreprises WHERE id = p_entreprise_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;
  
  -- Vérifier si la colonne user_id existe (optionnel pour récupérer l'email)
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entreprises' 
    AND column_name = 'user_id'
  ) INTO v_has_user_id_column;
  
  -- Récupérer l'email de l'entreprise (si disponible)
  IF v_has_user_id_column THEN
    SELECT email INTO v_entreprise_email
    FROM entreprises
    WHERE id = p_entreprise_id;
  ELSE
    -- Si pas de colonne user_id, récupérer l'email directement
    SELECT email INTO v_entreprise_email
    FROM entreprises
    WHERE id = p_entreprise_id;
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
      -- Supprimer par user_id (sauf si c'est le super admin PLATEFORME)
      IF v_espace_record.user_id IS NOT NULL THEN
        -- Ne pas supprimer le super admin PLATEFORME
        IF NOT is_user_platform_super_admin(v_espace_record.user_id) THEN
          BEGIN
            DELETE FROM auth.users WHERE id = v_espace_record.user_id;
            v_auth_users_count := v_auth_users_count + 1;
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        ELSE
          v_protected_admins_count := v_protected_admins_count + 1;
        END IF;
      END IF;
      
      -- Supprimer par email (au cas où)
      IF v_espace_record.email IS NOT NULL AND v_espace_record.email != '' THEN
        DECLARE
          v_email_user_id uuid;
        BEGIN
          SELECT id INTO v_email_user_id
          FROM auth.users
          WHERE email = v_espace_record.email
          LIMIT 1;
          
          IF v_email_user_id IS NOT NULL 
             AND NOT is_user_platform_super_admin(v_email_user_id) THEN
            BEGIN
              PERFORM delete_auth_user_by_email(v_espace_record.email);
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END;
      END IF;
    END LOOP;
    
    -- Supprimer aussi l'auth.user du client directement par email
    IF v_client_record.email IS NOT NULL AND v_client_record.email != '' THEN
      DECLARE
        v_client_user_id uuid;
      BEGIN
        SELECT id INTO v_client_user_id
        FROM auth.users
        WHERE email = v_client_record.email
        LIMIT 1;
        
        -- Ne pas supprimer le super admin PLATEFORME
        IF v_client_user_id IS NOT NULL 
           AND NOT is_user_platform_super_admin(v_client_user_id) THEN
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
  
  -- ========================================================================
  -- ÉTAPE 2 : Supprimer tous les abonnements de l'entreprise
  -- ========================================================================
  
  FOR v_abonnement_record IN
    SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id
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
  
  -- Retourner le résumé
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

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié. Ne dépend plus de la colonne user_id.';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Log final
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fonction delete_entreprise_complete corrigée - ne dépend plus de user_id';
END $$;




