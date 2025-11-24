/*
  # Restaurer les droits complets du super admin PLATEFORME
  
  PROBLÈME:
  - meddecyril@icloud.com doit être super admin PLATEFORME avec TOUS les droits
  - Il doit pouvoir supprimer TOUTES les entreprises (même les siennes)
  - Les rôles PLATEFORME et CLIENTS doivent être complètement séparés
  
  SOLUTION:
  1. S'assurer que meddecyril@icloud.com est super admin PLATEFORME
  2. Permettre au super admin PLATEFORME de supprimer N'IMPORTE quelle entreprise
  3. Distinguer clairement : super admin PLATEFORME vs clients
*/

-- ============================================================================
-- PARTIE 1 : S'assurer que meddecyril@icloud.com est super admin PLATEFORME
-- ============================================================================

-- Mettre à jour auth.users pour que meddecyril@icloud.com soit super_admin PLATEFORME
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'::jsonb
)
WHERE email = 'meddecyril@icloud.com';

-- S'assurer que l'entrée existe dans utilisateurs avec le rôle super_admin
INSERT INTO utilisateurs (id, email, role, nom, prenom)
SELECT 
  id,
  email,
  'super_admin'::text,
  COALESCE(raw_user_meta_data->>'nom', 'Admin'),
  COALESCE(raw_user_meta_data->>'prenom', 'Plateforme')
FROM auth.users
WHERE email = 'meddecyril@icloud.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  email = EXCLUDED.email,
  nom = COALESCE(EXCLUDED.nom, utilisateurs.nom),
  prenom = COALESCE(EXCLUDED.prenom, utilisateurs.prenom);

-- ============================================================================
-- PARTIE 2 : Fonction pour vérifier si un user est super admin PLATEFORME
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
  
  -- CRITÈRE PRINCIPAL : Un super admin PLATEFORME n'a JAMAIS d'espace membre client
  -- Si l'utilisateur a un espace membre client, c'est un CLIENT, pas un super admin plateforme
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = p_user_id
  ) THEN
    RETURN false; -- C'est un client, donc pas super admin plateforme
  END IF;
  
  -- Vérifier le rôle dans auth.users (doit être 'super_admin', pas 'client_super_admin')
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (raw_user_meta_data->>'role')::text = 'super_admin'
  ) THEN
    -- Vérifier aussi dans utilisateurs pour confirmer
    IF NOT EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = p_user_id
      AND role = 'client_super_admin'
    ) THEN
      RETURN true; -- C'est un super admin PLATEFORME
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION is_user_platform_super_admin(uuid) IS 'Vérifie si un user_id est super_admin PLATEFORME. Un super admin PLATEFORME n''a JAMAIS d''espace membre client.';

GRANT EXECUTE ON FUNCTION is_user_platform_super_admin(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Modifier delete_entreprise_complete pour permettre au super admin PLATEFORME de tout supprimer
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
  v_is_caller_platform_super_admin boolean := false;
  v_is_owner_platform_super_admin boolean := false;
BEGIN
  -- Vérifier si l'appelant est un super admin PLATEFORME
  v_is_caller_platform_super_admin := is_platform_super_admin();
  
  -- Vérifier si l'utilisateur est admin/propriétaire OU super admin PLATEFORME
  IF NOT (
    v_is_caller_platform_super_admin
    OR is_admin_user_simple()
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
  IF v_entreprise_user_id IS NOT NULL THEN
    v_is_owner_platform_super_admin := is_user_platform_super_admin(v_entreprise_user_id);
    
    -- IMPORTANT : Si l'appelant est super admin PLATEFORME, il peut supprimer TOUT (même les entreprises de super admins)
    -- Sinon, on bloque si c'est une entreprise d'un super admin PLATEFORME
    IF v_is_owner_platform_super_admin AND NOT v_is_caller_platform_super_admin THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Impossible de supprimer une entreprise appartenant à un super administrateur de la plateforme. Seul un super administrateur peut effectuer cette action.'
      );
    END IF;
    -- Si l'appelant EST super admin PLATEFORME, on continue (il peut supprimer)
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
      -- Supprimer par user_id (sauf si c'est le super admin PLATEFORME appelant lui-même)
      IF v_espace_record.user_id IS NOT NULL THEN
        -- Ne pas supprimer le super admin PLATEFORME appelant (sauf si c'est lui-même qui demande)
        IF v_espace_record.user_id != auth.uid() OR NOT v_is_caller_platform_super_admin THEN
          -- Vérifier si c'est un super admin PLATEFORME
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
             AND (v_email_user_id != auth.uid() OR NOT v_is_caller_platform_super_admin)
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
        
        -- Ne pas supprimer le super admin PLATEFORME appelant
        IF v_client_user_id IS NOT NULL 
           AND (v_client_user_id != auth.uid() OR NOT v_is_caller_platform_super_admin)
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
  
  -- Supprimer l'auth.user de l'entreprise elle-même (sauf si c'est le super admin PLATEFORME appelant)
  IF v_entreprise_user_id IS NOT NULL THEN
    -- Si c'est le super admin PLATEFORME qui appelle, il peut supprimer même son entreprise
    -- Mais on ne supprime PAS son propre auth.user (il doit rester)
    IF v_entreprise_user_id = auth.uid() AND v_is_caller_platform_super_admin THEN
      -- C'est le super admin qui supprime sa propre entreprise, on ne supprime pas son auth.user
      v_protected_admins_count := v_protected_admins_count + 1;
    ELSIF NOT is_user_platform_super_admin(v_entreprise_user_id) THEN
      -- Ce n'est pas un super admin PLATEFORME, on peut supprimer
      BEGIN
        DELETE FROM auth.users WHERE id = v_entreprise_user_id;
        v_auth_users_count := v_auth_users_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSE
      -- C'est un autre super admin PLATEFORME, on ne supprime pas (sauf si c'est le super admin appelant)
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
      
      -- Ne pas supprimer le super admin PLATEFORME appelant
      IF v_entreprise_email_user_id IS NOT NULL 
         AND (v_entreprise_email_user_id != auth.uid() OR NOT v_is_caller_platform_super_admin)
         AND v_entreprise_email_user_id != v_entreprise_user_id
         AND NOT is_user_platform_super_admin(v_entreprise_email_user_id) THEN
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

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime définitivement une entreprise et TOUT ce qui est lié. Le super admin PLATEFORME peut supprimer TOUTES les entreprises (même les siennes).';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : S'assurer que is_platform_super_admin() fonctionne correctement
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
-- PARTIE 5 : Log pour confirmer la configuration
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_admin_email text;
BEGIN
  SELECT id, email INTO v_admin_id, v_admin_email
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    RAISE NOTICE '✅ Super admin PLATEFORME configuré: % (id: %)', v_admin_email, v_admin_id;
  ELSE
    RAISE NOTICE '⚠️  Attention: meddecyril@icloud.com non trouvé dans auth.users';
  END IF;
END $$;

