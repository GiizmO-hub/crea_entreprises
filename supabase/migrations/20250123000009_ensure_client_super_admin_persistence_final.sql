/*
  # PERSISTANCE DÉFINITIVE DU RÔLE client_super_admin
  
  PROBLÈME:
  - Le rôle client_super_admin ne persiste pas après déconnexion/reconnexion
  - Il n'est peut-être pas correctement sauvegardé dans auth.users.raw_user_meta_data
  - Le rôle doit être dans auth.users.raw_user_meta_data pour persister (comme super_admin plateforme)
  
  SOLUTION:
  - Recréer la fonction toggle_client_super_admin pour garantir la synchronisation
  - Créer un trigger pour synchroniser automatiquement utilisateurs.role vers auth.users
  - S'assurer que le rôle est toujours lu depuis auth.users.raw_user_meta_data
  - Synchroniser tous les rôles existants
*/

-- Activer l'extension pgcrypto si nécessaire
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ✅ 1. Recréer toggle_client_super_admin avec garantie de persistance
DROP FUNCTION IF EXISTS toggle_client_super_admin(uuid, boolean) CASCADE;

CREATE OR REPLACE FUNCTION toggle_client_super_admin(
  p_client_id uuid,
  p_is_super_admin boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
  v_new_role text;
  v_result jsonb;
  v_updated_count integer;
BEGIN
  -- Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT COALESCE(is_platform_super_admin(), false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
  END IF;

  -- Récupérer le user_id du client depuis espaces_membres_clients
  SELECT 
    emc.user_id,
    COALESCE(au.email, c.email) as email,
    c.nom,
    c.prenom
  INTO 
    v_user_id,
    v_client_email,
    v_client_nom,
    v_client_prenom
  FROM clients c
  LEFT JOIN espaces_membres_clients emc ON emc.client_id = c.id
  LEFT JOIN auth.users au ON au.id = emc.user_id
  WHERE c.id = p_client_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun espace membre trouvé pour ce client. Créez d''abord un espace membre.'
    );
  END IF;

  -- Déterminer le nouveau rôle
  v_new_role := CASE 
    WHEN p_is_super_admin THEN 'client_super_admin'
    ELSE 'client'
  END;

  -- ✅ ÉTAPE 1: Mettre à jour le rôle dans utilisateurs
  INSERT INTO utilisateurs (
    id,
    email,
    nom,
    prenom,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_client_email, ''),
    COALESCE(v_client_nom, ''),
    COALESCE(v_client_prenom, ''),
    v_new_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = v_new_role,
    email = COALESCE(v_client_email, utilisateurs.email),
    nom = COALESCE(v_client_nom, utilisateurs.nom),
    prenom = COALESCE(v_client_prenom, utilisateurs.prenom),
    updated_at = NOW();

  -- ✅ ÉTAPE 2: CRITIQUE - Synchroniser IMMÉDIATEMENT vers auth.users.raw_user_meta_data
  -- C'est la source de vérité qui persiste après déconnexion/reconnexion
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_new_role)
    ),
    updated_at = NOW()
  WHERE id = v_user_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Vérifier que la mise à jour a bien eu lieu
  IF v_updated_count = 0 THEN
    RAISE WARNING 'Aucune ligne mise à jour dans auth.users pour user_id: %', v_user_id;
  END IF;

  -- ✅ ÉTAPE 3: Vérifier que le rôle est bien dans auth.users.raw_user_meta_data
  PERFORM 1
  FROM auth.users
  WHERE id = v_user_id
    AND (raw_user_meta_data->>'role')::text = v_new_role;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Échec de la synchronisation du rôle dans auth.users.raw_user_meta_data pour user_id: %', v_user_id;
  END IF;

  -- ✅ Retourner le résultat avec confirmation
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_is_super_admin THEN 'Client défini comme super admin de son espace. Le rôle est maintenant permanent dans la base de données.'
      ELSE 'Statut super admin retiré du client. Le rôle est maintenant permanent dans la base de données.'
    END,
    'is_super_admin', p_is_super_admin,
    'role', v_new_role,
    'user_id', v_user_id,
    'synchronized', true
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'user_id', v_user_id
    );
END;
$$;

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut client_super_admin d''un client. GARANTIT la synchronisation dans utilisateurs ET auth.users.raw_user_meta_data pour persistance permanente.';

GRANT EXECUTE ON FUNCTION toggle_client_super_admin(uuid, boolean) TO authenticated;

-- ✅ 2. Créer un trigger pour synchroniser automatiquement utilisateurs.role vers auth.users
CREATE OR REPLACE FUNCTION sync_utilisateurs_role_to_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Si le rôle a changé, synchroniser IMMÉDIATEMENT vers auth.users.raw_user_meta_data
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM COALESCE(OLD.role, '')))) THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role)
    ),
    updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Vérifier que la synchronisation a réussi
    IF NOT FOUND THEN
      RAISE WARNING 'Impossible de synchroniser le rôle vers auth.users pour user_id: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_utilisateurs_role_to_auth_users IS 'Synchronise automatiquement le rôle de utilisateurs vers auth.users.raw_user_meta_data pour garantir la persistance permanente.';

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS trigger_sync_role_to_auth_users ON utilisateurs;

-- Créer le trigger
CREATE TRIGGER trigger_sync_role_to_auth_users
  AFTER INSERT OR UPDATE OF role ON utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION sync_utilisateurs_role_to_auth_users();

-- ✅ 3. Synchroniser TOUS les rôles existants client_super_admin vers auth.users
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Synchroniser tous les client_super_admin existants
  UPDATE auth.users au
  SET raw_user_meta_data = jsonb_set(
    COALESCE(au.raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"client_super_admin"'::jsonb
  ),
  updated_at = NOW()
  FROM utilisateurs u
  WHERE u.id = au.id
    AND u.role = 'client_super_admin'
    AND (
      au.raw_user_meta_data IS NULL 
      OR (au.raw_user_meta_data->>'role')::text != 'client_super_admin'
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '✅ Synchronisés % rôles client_super_admin existants vers auth.users', v_count;
END $$;

-- ✅ 4. Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ PERSISTANCE DÉFINITIVE APPLIQUÉE ! ✅✅✅';
  RAISE NOTICE '   - toggle_client_super_admin garantit la synchronisation dans auth.users';
  RAISE NOTICE '   - Trigger automatique pour synchroniser utilisateurs.role → auth.users';
  RAISE NOTICE '   - Tous les rôles existants ont été synchronisés';
  RAISE NOTICE '   - Le rôle client_super_admin est maintenant PERMANENT dans la base de données';
END $$;

