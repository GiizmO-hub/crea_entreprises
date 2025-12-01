/*
  # CORRECTION : S'assurer que meddecyril@icloud.com est bien super_admin PLATEFORME
  
  PROBLÈME POTENTIEL:
  - meddecyril@icloud.com doit être super_admin PLATEFORME (pas client)
  - Il ne doit PAS avoir d'espace membre client
  - Il doit avoir le rôle 'super_admin' dans auth.users et utilisateurs
  
  SOLUTION:
  - Supprimer tout espace membre client pour cet utilisateur
  - S'assurer que le rôle est 'super_admin' (pas 'client_super_admin')
  - Protéger ce compte contre toute modification de rôle
*/

-- ============================================================================
-- ÉTAPE 1 : Supprimer tout espace membre client pour meddecyril@icloud.com
-- (Un super admin PLATEFORME ne doit JAMAIS avoir d'espace membre client)
-- ============================================================================

DELETE FROM espaces_membres_clients
WHERE EXISTS (
  SELECT 1 FROM auth.users
  WHERE auth.users.id = espaces_membres_clients.user_id
  AND auth.users.email = 'meddecyril@icloud.com'
);

-- ============================================================================
-- ÉTAPE 2 : S'assurer que le rôle est 'super_admin' dans auth.users
-- ============================================================================

UPDATE auth.users
SET 
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', 'super_admin',
      'is_protected', true,
      'is_creator', true,
      'is_platform_super_admin', true
    )
WHERE email = 'meddecyril@icloud.com';

-- ============================================================================
-- ÉTAPE 3 : S'assurer que le rôle est 'super_admin' dans utilisateurs
-- ============================================================================

INSERT INTO utilisateurs (id, email, role, statut, created_at, updated_at)
SELECT 
  id,
  email,
  'super_admin',
  'active',
  created_at,
  updated_at
FROM auth.users
WHERE email = 'meddecyril@icloud.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin', -- FORCER super_admin (pas client_super_admin)
  email = EXCLUDED.email,
  statut = 'active',
  updated_at = now()
WHERE utilisateurs.id = EXCLUDED.id;

-- ============================================================================
-- ÉTAPE 4 : Vérifier que le compte n'est PAS un client
-- ============================================================================

-- Supprimer toute référence client pour meddecyril@icloud.com
DELETE FROM clients
WHERE email = 'meddecyril@icloud.com';

-- ============================================================================
-- ÉTAPE 5 : Fonction pour vérifier le statut de meddecyril@icloud.com
-- ============================================================================

CREATE OR REPLACE FUNCTION check_meddecyril_admin_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_role_auth text;
  v_role_utilisateurs text;
  v_has_client_space boolean;
  v_is_client boolean;
BEGIN
  -- Trouver l'ID de l'utilisateur
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Utilisateur meddecyril@icloud.com non trouvé'
    );
  END IF;
  
  -- Vérifier le rôle dans auth.users
  SELECT COALESCE(
    (raw_user_meta_data->>'role')::text,
    ''
  ) INTO v_role_auth
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Vérifier le rôle dans utilisateurs
  SELECT COALESCE(role, '') INTO v_role_utilisateurs
  FROM utilisateurs
  WHERE id = v_user_id;
  
  -- Vérifier s'il a un espace membre client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = v_user_id
  ) INTO v_has_client_space;
  
  -- Vérifier s'il est dans la table clients
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE email = 'meddecyril@icloud.com'
  ) INTO v_is_client;
  
  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email', 'meddecyril@icloud.com',
    'role_auth_users', v_role_auth,
    'role_utilisateurs', v_role_utilisateurs,
    'has_client_space', v_has_client_space,
    'is_client', v_is_client,
    'is_platform_super_admin', (
      v_role_auth = 'super_admin' 
      AND v_role_utilisateurs = 'super_admin'
      AND NOT v_has_client_space
      AND NOT v_is_client
    )
  );
END;
$$;

COMMENT ON FUNCTION check_meddecyril_admin_status IS 
  'Vérifie le statut de meddecyril@icloud.com et confirme qu''il est bien super_admin PLATEFORME';

GRANT EXECUTE ON FUNCTION check_meddecyril_admin_status() TO authenticated;

-- ============================================================================
-- ÉTAPE 6 : Afficher le statut actuel
-- ============================================================================

DO $$
DECLARE
  v_status jsonb;
BEGIN
  v_status := check_meddecyril_admin_status();
  RAISE NOTICE '📊 Statut meddecyril@icloud.com: %', v_status;
END $$;

SELECT '✅ Configuration meddecyril@icloud.com vérifiée et corrigée' as resultat;

