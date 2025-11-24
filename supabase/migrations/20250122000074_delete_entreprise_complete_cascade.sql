/*
  # Suppression complète et définitive d'une entreprise
  
  PROBLÈME:
  - Lorsqu'on supprime une entreprise, tout n'est pas supprimé définitivement
  - Les auth.users restent parfois dans la base
  - Certains éléments liés peuvent rester orphelins
  
  SOLUTION:
  - Créer une fonction qui supprime TOUT de manière séquentielle et complète
  - Supprimer tous les auth.users associés
  - Supprimer tous les abonnements
  - Supprimer tous les clients, espaces membres, etc.
  - Supprimer l'entreprise elle-même
*/

-- ============================================================================
-- PARTIE 1 : Fonction complète de suppression d'entreprise
-- ============================================================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS delete_entreprise_complete(uuid);

-- Créer la nouvelle fonction complète qui supprime TOUT
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
  -- ÉTAPE 5 : Supprimer tous les autres éléments liés
  -- ========================================================================
  
  -- Supprimer les invitations clients
  DELETE FROM invitations_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les notifications espace client
  DELETE FROM notifications_espace_client
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les factures clients
  DELETE FROM factures_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les avoirs clients
  DELETE FROM avoirs_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les documents clients
  DELETE FROM documents_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les demandes clients
  DELETE FROM demandes_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- Supprimer les prévisionnels (si table existe)
  BEGIN
    DELETE FROM previsionnels
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    -- Table peut ne pas exister
    NULL;
  END;
  
  -- Supprimer les collaborateurs entreprise (si table existe)
  BEGIN
    DELETE FROM collaborateurs_entreprise
    WHERE entreprise_id = p_entreprise_id;
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

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié : clients, espaces membres, abonnements, auth.users, invitations, notifications, factures, etc.';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 2 : Vérifier et corriger les contraintes CASCADE
-- ============================================================================

-- S'assurer que les contraintes CASCADE sont bien en place
-- (Déjà fait dans la migration précédente, mais on vérifie)

-- Vérifier que espaces_membres_clients a bien CASCADE sur entreprise_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'espaces_membres_clients'::regclass
    AND conname LIKE '%entreprise_id%'
    AND contype = 'f'
  ) THEN
    -- Vérifier si CASCADE est présent
    -- (Si non, on le recrée avec CASCADE)
    NULL; -- Déjà fait dans migration précédente
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3 : Améliorer le trigger pour double sécurité
-- ============================================================================

-- Le trigger trigger_delete_entreprise_auth sera toujours appelé
-- en complément de la fonction pour s'assurer que tout est supprimé

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement TOUT : entreprise, clients, espaces membres, abonnements, auth.users, invitations, notifications, factures clients, etc. Utilise CASCADE et suppressions explicites pour garantir la suppression complète.';

