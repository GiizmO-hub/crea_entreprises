/*
  # Correction : Session d'authentification et détection admin
  
  PROBLÈMES:
  - La déconnexion ne fonctionne pas (reconnexion automatique)
  - Après reconnexion, aucun accès (tableau de bord seulement)
  - Les fonctions de détection admin ne fonctionnent pas correctement
  
  SOLUTION:
  1. Vérifier que meddecyril@icloud.com est correctement configuré
  2. Corriger les fonctions de détection de super admin
  3. S'assurer que la session est correctement gérée
  4. Forcer la synchronisation des rôles
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et forcer la configuration de meddecyril@icloud.com
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_admin_exists boolean;
BEGIN
  -- Vérifier si meddecyril@icloud.com existe
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '❌ ERREUR CRITIQUE: meddecyril@icloud.com n''existe pas dans auth.users !';
  END IF;
  
  RAISE NOTICE '✅ meddecyril@icloud.com trouvé: id = %', v_admin_id;
  
  -- FORCER la mise à jour du rôle dans auth.users
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"super_admin"'::jsonb
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"super_admin"'::jsonb
    ),
    updated_at = now()
  WHERE id = v_admin_id;
  
  RAISE NOTICE '✅ Rôle super_admin forcé dans auth.users pour meddecyril@icloud.com';
  
  -- S'assurer que l'entrée existe dans utilisateurs
  INSERT INTO utilisateurs (id, email, role, nom, prenom, created_at, updated_at)
  SELECT 
    id,
    email,
    'super_admin'::text,
    COALESCE(raw_user_meta_data->>'nom', 'Admin'),
    COALESCE(raw_user_meta_data->>'prenom', 'Plateforme'),
    created_at,
    now()
  FROM auth.users
  WHERE id = v_admin_id
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'super_admin',
    email = EXCLUDED.email,
    nom = COALESCE(EXCLUDED.nom, utilisateurs.nom),
    prenom = COALESCE(EXCLUDED.prenom, utilisateurs.prenom),
    updated_at = now();
  
  RAISE NOTICE '✅ Rôle super_admin synchronisé dans utilisateurs';
  
  -- S'assurer qu'il n'a PAS d'espace membre client
  DELETE FROM espaces_membres_clients
  WHERE user_id = v_admin_id;
  
  IF FOUND THEN
    RAISE NOTICE '⚠️  Espaces membres clients supprimés pour meddecyril@icloud.com';
  END IF;
  
END $$;

-- ============================================================================
-- PARTIE 2 : Recréer les fonctions de détection admin de manière robuste
-- ============================================================================

-- Fonction pour vérifier si un user_id est super admin PLATEFORME
DROP FUNCTION IF EXISTS is_user_platform_super_admin(uuid);
CREATE OR REPLACE FUNCTION is_user_platform_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_role text;
  v_has_client_space boolean;
BEGIN
  -- Si pas d'user_id, retourner false
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- CRITÈRE 1 : Un super admin PLATEFORME n'a JAMAIS d'espace membre client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = p_user_id
  ) INTO v_has_client_space;
  
  IF v_has_client_space THEN
    RETURN false; -- C'est un client, donc pas super admin plateforme
  END IF;
  
  -- CRITÈRE 2 : Vérifier le rôle dans auth.users
  SELECT COALESCE(
    (raw_user_meta_data->>'role')::text,
    ''
  ) INTO v_role
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Le rôle doit être exactement 'super_admin' (pas 'client_super_admin')
  IF v_role != 'super_admin' THEN
    RETURN false;
  END IF;
  
  -- CRITÈRE 3 : Vérifier dans utilisateurs (ne doit pas être 'client_super_admin')
  IF EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = p_user_id
    AND role = 'client_super_admin'
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION is_user_platform_super_admin(uuid) IS 'Vérifie si un user_id est super_admin PLATEFORME. Un super admin PLATEFORME n''a JAMAIS d''espace membre client et a le rôle ''super_admin''.';

GRANT EXECUTE ON FUNCTION is_user_platform_super_admin(uuid) TO authenticated;

-- Fonction pour l'utilisateur connecté
DROP FUNCTION IF EXISTS is_platform_super_admin();
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

COMMENT ON FUNCTION is_platform_super_admin() IS 'Vérifie si l''utilisateur connecté est super_admin PLATEFORME.';

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

-- Fonction simple pour vérifier si admin (admin OU super_admin)
-- NE PAS SUPPRIMER - Utilisée par les policies RLS
CREATE OR REPLACE FUNCTION is_admin_user_simple()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier directement dans auth.users
  SELECT COALESCE(
    (raw_user_meta_data->>'role')::text,
    ''
  ) INTO v_role
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Retourner true si admin ou super_admin
  RETURN v_role IN ('admin', 'super_admin');
END;
$$;

COMMENT ON FUNCTION is_admin_user_simple() IS 'Vérifie si l''utilisateur connecté est admin ou super_admin (non-récursif).';

GRANT EXECUTE ON FUNCTION is_admin_user_simple() TO authenticated;

-- Fonction pour obtenir le rôle actuel de l'utilisateur
DROP FUNCTION IF EXISTS get_current_user_role();
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_email text;
  v_has_client_space boolean;
  v_is_platform_super_admin boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'role', null,
      'is_admin', false,
      'is_super_admin', false,
      'is_platform_super_admin', false,
      'is_client', false,
      'error', 'Non authentifié'
    );
  END IF;
  
  -- Récupérer le rôle depuis auth.users
  SELECT 
    COALESCE((raw_user_meta_data->>'role')::text, ''),
    email
  INTO v_role, v_email
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Vérifier s'il a un espace membre client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = v_user_id
  ) INTO v_has_client_space;
  
  -- Vérifier si c'est un super admin PLATEFORME
  v_is_platform_super_admin := is_user_platform_super_admin(v_user_id);
  
  RETURN jsonb_build_object(
    'role', v_role,
    'email', v_email,
    'is_admin', v_role IN ('admin', 'super_admin'),
    'is_super_admin', v_role = 'super_admin',
    'is_platform_super_admin', v_is_platform_super_admin,
    'is_client', v_has_client_space,
    'user_id', v_user_id
  );
END;
$$;

COMMENT ON FUNCTION get_current_user_role() IS 'Retourne le rôle et les informations de l''utilisateur connecté.';

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

-- ============================================================================
-- PARTIE 3 : Fonction de diagnostic pour meddecyril@icloud.com
-- ============================================================================

CREATE OR REPLACE FUNCTION diagnostic_admin_principal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_email text;
  v_role_auth text;
  v_role_utilisateurs text;
  v_has_client_space boolean;
  v_is_platform_super_admin boolean;
  v_result jsonb;
BEGIN
  -- Récupérer les infos de meddecyril@icloud.com
  SELECT 
    id,
    email,
    COALESCE((raw_user_meta_data->>'role')::text, ''),
    COALESCE((raw_app_meta_data->>'role')::text, '')
  INTO v_admin_id, v_admin_email, v_role_auth, v_role_utilisateurs
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'meddecyril@icloud.com non trouvé dans auth.users',
      'success', false
    );
  END IF;
  
  -- Vérifier dans utilisateurs
  SELECT COALESCE(role, '') INTO v_role_utilisateurs
  FROM utilisateurs
  WHERE id = v_admin_id;
  
  -- Vérifier s'il a un espace membre client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = v_admin_id
  ) INTO v_has_client_space;
  
  -- Vérifier si c'est un super admin PLATEFORME
  v_is_platform_super_admin := is_user_platform_super_admin(v_admin_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'admin_id', v_admin_id,
    'email', v_admin_email,
    'role_auth_users', v_role_auth,
    'role_utilisateurs', v_role_utilisateurs,
    'has_client_space', v_has_client_space,
    'is_platform_super_admin', v_is_platform_super_admin,
    'message', CASE 
      WHEN v_is_platform_super_admin THEN '✅ Configuration correcte'
      ELSE '❌ Configuration incorrecte - pas super admin PLATEFORME'
    END
  );
END;
$$;

COMMENT ON FUNCTION diagnostic_admin_principal() IS 'Diagnostic complet pour meddecyril@icloud.com.';

GRANT EXECUTE ON FUNCTION diagnostic_admin_principal() TO authenticated;

-- ============================================================================
-- PARTIE 4 : Forcer la suppression des sessions pour meddecyril@icloud.com
-- ============================================================================

-- Note: On ne peut pas supprimer directement les sessions dans Supabase depuis SQL
-- Mais on peut créer une fonction qui force la mise à jour du rôle pour invalider le cache

CREATE OR REPLACE FUNCTION force_refresh_admin_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin non trouvé');
  END IF;
  
  -- Forcer la mise à jour pour invalider le cache
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"super_admin"'::jsonb
    ),
    updated_at = now()
  WHERE id = v_admin_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rôle super_admin forcé pour meddecyril@icloud.com. Veuillez vous déconnecter et vous reconnecter.',
    'admin_id', v_admin_id
  );
END;
$$;

COMMENT ON FUNCTION force_refresh_admin_role() IS 'Force la mise à jour du rôle admin pour invalider le cache de session.';

GRANT EXECUTE ON FUNCTION force_refresh_admin_role() TO authenticated;

-- ============================================================================
-- PARTIE 5 : Log final
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration terminée. Vérifiez avec: SELECT diagnostic_admin_principal();';
END $$;

