/*
  # Correction FINALE : delete_entreprise_complete - Suppression de toute référence à user_id
  
  PROBLÈME:
  - La fonction delete_entreprise_complete() essaie d'accéder à entreprises.user_id
  - Cette colonne peut ne pas exister ou ne pas être nécessaire
  - L'erreur "column user_id does not exist" se produit lors de la suppression
  
  SOLUTION:
  - Supprimer TOUTES les références à entreprises.user_id
  - Utiliser uniquement l'entreprise_id pour identifier l'entreprise
  - Simplifier la logique de suppression
*/

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS delete_entreprise_complete(uuid) CASCADE;

-- Créer une version simplifiée qui ne dépend PAS de user_id
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
  v_is_caller_platform_super_admin boolean := false;
BEGIN
  -- Vérifier si l'appelant est un super admin PLATEFORME
  v_is_caller_platform_super_admin := COALESCE(is_platform_super_admin(), false);
  
  -- Vérifier si l'utilisateur est admin OU super admin PLATEFORME
  IF NOT (
    v_is_caller_platform_super_admin
    OR COALESCE(is_admin_user_simple(), false)
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
  
  -- ========================================================================
  -- ÉTAPE 1 : Supprimer tous les auth.users des clients et espaces membres
  -- ========================================================================
  
  -- Pour chaque client de cette entreprise
  FOR v_client_record IN 
    SELECT id, email FROM clients WHERE entreprise_id = p_entreprise_id
  LOOP
    -- Supprimer les auth.users via les espaces membres
    FOR v_espace_record IN
      SELECT DISTINCT user_id, email 
      FROM espaces_membres_clients 
      WHERE client_id = v_client_record.id
        AND (user_id IS NOT NULL OR email IS NOT NULL)
    LOOP
      -- Supprimer par user_id (sauf si c'est le super admin PLATEFORME)
      IF v_espace_record.user_id IS NOT NULL THEN
        -- Ne pas supprimer le super admin PLATEFORME
        IF NOT COALESCE(is_user_platform_super_admin(v_espace_record.user_id), false) THEN
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
      
      -- Supprimer par email si disponible
      IF v_espace_record.email IS NOT NULL AND v_espace_record.email != '' THEN
        BEGIN
          -- Chercher l'user par email
          DECLARE
            v_email_user_id uuid;
          BEGIN
            SELECT id INTO v_email_user_id
            FROM auth.users
            WHERE email = v_espace_record.email
            LIMIT 1;
            
            IF v_email_user_id IS NOT NULL 
               AND NOT COALESCE(is_user_platform_super_admin(v_email_user_id), false) THEN
              BEGIN
                DELETE FROM auth.users WHERE id = v_email_user_id;
                v_auth_users_count := v_auth_users_count + 1;
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END IF;
          END;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END LOOP;
    
    -- Supprimer aussi l'auth.user du client directement par email
    IF v_client_record.email IS NOT NULL AND v_client_record.email != '' THEN
      BEGIN
        DECLARE
          v_client_user_id uuid;
        BEGIN
          SELECT id INTO v_client_user_id
          FROM auth.users
          WHERE email = v_client_record.email
          LIMIT 1;
          
          -- Ne pas supprimer le super admin PLATEFORME
          IF v_client_user_id IS NOT NULL 
             AND NOT COALESCE(is_user_platform_super_admin(v_client_user_id), false) THEN
            BEGIN
              DELETE FROM auth.users WHERE id = v_client_user_id;
              v_auth_users_count := v_auth_users_count + 1;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          ELSE
            IF v_client_user_id IS NOT NULL THEN
              v_protected_admins_count := v_protected_admins_count + 1;
            END IF;
          END IF;
        END;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
    
    v_clients_count := v_clients_count + 1;
  END LOOP;
  
  -- ========================================================================
  -- ÉTAPE 2 : Supprimer tous les abonnements de l'entreprise
  -- ========================================================================
  
  SELECT COUNT(*) INTO v_abonnements_count
  FROM abonnements 
  WHERE entreprise_id = p_entreprise_id;
  
  DELETE FROM abonnements 
  WHERE entreprise_id = p_entreprise_id;
  
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
  -- ÉTAPE 5 : Supprimer tous les autres éléments liés (avec gestion d'erreur)
  -- ========================================================================
  
  BEGIN
    DELETE FROM invitations_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM notifications_espace_client WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM factures_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM avoirs_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
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
      'Entreprise supprimée avec succès : %s client(s), %s espace(s), %s abonnement(s), %s auth.user(s) supprimé(s). %s super admin(s) PLATEFORME protégé(s).',
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
      'sqlstate', SQLSTATE,
      'detail', 'Erreur lors de la suppression de l''entreprise'
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié. NE DÉPEND PLUS de la colonne user_id. Utilise uniquement l''entreprise_id.';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;

-- Log final
DO $$
BEGIN
  RAISE NOTICE '✅ Fonction delete_entreprise_complete corrigée - PLUS AUCUNE dépendance à user_id';
END $$;

