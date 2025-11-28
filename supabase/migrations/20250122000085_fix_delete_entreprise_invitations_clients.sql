/*
  # Correction : Suppression conditionnelle dans delete_entreprise_complete
  
  PROBLÈME:
  - La fonction delete_entreprise_complete essaie de supprimer depuis invitations_clients
  - Cette table peut ne pas exister dans certaines bases de données
  - Erreur: "relation invitations_clients does not exist"
  
  SOLUTION:
  - Ajouter des blocs TRY/CATCH pour toutes les tables optionnelles
  - Vérifier l'existence des tables avant suppression
  - Ignorer les erreurs si les tables n'existent pas
*/

-- Modifier la fonction delete_entreprise_complete pour gérer les tables optionnelles
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
  v_total_deleted integer := 0;
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
      -- Supprimer par user_id
      IF v_espace_record.user_id IS NOT NULL THEN
        BEGIN
          DELETE FROM auth.users WHERE id = v_espace_record.user_id;
          v_auth_users_count := v_auth_users_count + 1;
        EXCEPTION WHEN OTHERS THEN
          -- Ignorer si déjà supprimé
          NULL;
        END;
      END IF;
      
      -- Supprimer par email (au cas où)
      IF v_espace_record.email IS NOT NULL AND v_espace_record.email != '' THEN
        BEGIN
          PERFORM delete_auth_user_by_email(v_espace_record.email);
          -- Ne pas compter double si déjà compté par user_id
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END LOOP;
    
    -- Supprimer aussi l'auth.user du client directement par email
    IF v_client_record.email IS NOT NULL AND v_client_record.email != '' THEN
      BEGIN
        PERFORM delete_auth_user_by_email(v_client_record.email);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
    
    v_clients_count := v_clients_count + 1;
  END LOOP;
  
  -- Supprimer l'auth.user de l'entreprise elle-même (si email existe)
  DECLARE
    v_entreprise_email text;
    v_entreprise_user_id uuid;
  BEGIN
    SELECT email, user_id INTO v_entreprise_email, v_entreprise_user_id
    FROM entreprises
    WHERE id = p_entreprise_id;
    
    -- Ne supprimer que si ce n'est pas le super admin
    IF v_entreprise_user_id IS NOT NULL THEN
      -- Vérifier si c'est un super admin (ne pas supprimer)
      IF NOT EXISTS (
        SELECT 1 FROM utilisateurs 
        WHERE id = v_entreprise_user_id 
        AND role IN ('super_admin', 'admin')
      ) THEN
        BEGIN
          DELETE FROM auth.users WHERE id = v_entreprise_user_id;
          v_auth_users_count := v_auth_users_count + 1;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
    
    -- Supprimer par email aussi (si différent)
    IF v_entreprise_email IS NOT NULL AND v_entreprise_email != '' THEN
      BEGIN
        PERFORM delete_auth_user_by_email(v_entreprise_email);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END;
  
  -- ========================================================================
  -- ÉTAPE 2 : Supprimer tous les abonnements de l'entreprise
  -- ========================================================================
  
  -- Supprimer tous les abonnements liés à cette entreprise
  FOR v_abonnement_record IN
    SELECT id, user_id FROM abonnements WHERE entreprise_id = p_entreprise_id
  LOOP
    -- Supprimer l'abonnement (les plans_modules seront supprimés par CASCADE si nécessaire)
    DELETE FROM abonnements WHERE id = v_abonnement_record.id;
    v_abonnements_count := v_abonnements_count + 1;
  END LOOP;
  
  -- ========================================================================
  -- ÉTAPE 3 : Supprimer tous les espaces membres clients
  -- (Normalement supprimés par CASCADE, mais on s'assure)
  -- ========================================================================
  
  SELECT COUNT(*) INTO v_espaces_count
  FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  DELETE FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- ========================================================================
  -- ÉTAPE 4 : Supprimer tous les clients
  -- (Normalement supprimés par CASCADE, mais on s'assure)
  -- ========================================================================
  
  DELETE FROM clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- ========================================================================
  -- ÉTAPE 5 : Supprimer tous les autres éléments liés (tables optionnelles)
  -- ========================================================================
  
  -- Supprimer les invitations clients (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations_clients') THEN
      DELETE FROM invitations_clients
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorer si table n'existe pas ou erreur
    NULL;
  END;
  
  -- Supprimer les notifications espace client (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications_espace_client') THEN
      DELETE FROM notifications_espace_client
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les factures clients (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'factures_clients') THEN
      DELETE FROM factures_clients
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les avoirs clients (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avoirs_clients') THEN
      DELETE FROM avoirs_clients
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les documents clients (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents_clients') THEN
      DELETE FROM documents_clients
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les demandes clients (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'demandes_clients') THEN
      DELETE FROM demandes_clients
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les prévisionnels (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'previsionnels') THEN
      DELETE FROM previsionnels
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les collaborateurs entreprise (si table existe)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaborateurs_entreprise') THEN
      DELETE FROM collaborateurs_entreprise
      WHERE entreprise_id = p_entreprise_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- ========================================================================
  -- ÉTAPE 6 : Supprimer l'entreprise elle-même
  -- ========================================================================
  
  DELETE FROM entreprises
  WHERE id = p_entreprise_id;
  
  v_total_deleted := v_clients_count + v_espaces_count + v_abonnements_count + v_auth_users_count;
  
  -- Retourner le résumé
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée définitivement : %s client(s), %s espace(s), %s abonnement(s), %s auth.user(s) supprimé(s)',
      v_clients_count,
      v_espaces_count,
      v_abonnements_count,
      v_auth_users_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'auth_users_deleted', v_auth_users_count,
    'total_deleted', v_total_deleted
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

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié. Vérifie l''existence des tables optionnelles avant suppression.';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;




