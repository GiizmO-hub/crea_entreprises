/*
  # Correction de la fonction toggle_client_super_admin
  
  PROBLÈME:
  - La fonction toggle_client_super_admin utilise peut-être la mauvaise vérification de permissions
  - Elle doit utiliser is_platform_super_admin() au lieu de vérifier directement utilisateurs
  - Elle doit utiliser le rôle 'client_super_admin' au lieu de 'super_admin'
  - Elle doit synchroniser avec auth.users.raw_user_meta_data
  
  SOLUTION:
  - Recréer la fonction avec la bonne logique
  - Utiliser is_platform_super_admin() pour les permissions
  - Utiliser le rôle 'client_super_admin'
  - Synchroniser avec auth.users
  
  MÉTHODOLOGIE: CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD
*/

-- Activer l'extension pgcrypto si nécessaire
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS toggle_client_super_admin(uuid, boolean) CASCADE;

-- ✅ FONCTION CORRIGÉE : Toggle client super admin status
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
BEGIN
  -- ✅ Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT COALESCE(is_platform_super_admin(), false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
  END IF;

  -- Récupérer le user_id du client depuis espaces_membres_clients
  SELECT 
    emc.user_id,
    au.email,
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

  -- ✅ Mettre à jour le rôle dans utilisateurs
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

  -- ✅ Synchroniser le rôle dans auth.users.raw_user_meta_data
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_new_role)
    ),
    updated_at = NOW()
  WHERE id = v_user_id;

  -- ✅ Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_is_super_admin THEN 'Client défini comme super admin de son espace'
      ELSE 'Statut super admin retiré du client'
    END,
    'is_super_admin', p_is_super_admin,
    'role', v_new_role
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

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut client_super_admin d''un client dans son espace. Seuls les super_admin de la plateforme peuvent utiliser cette fonction. Synchronise le rôle dans utilisateurs et auth.users.raw_user_meta_data.';

GRANT EXECUTE ON FUNCTION toggle_client_super_admin(uuid, boolean) TO authenticated;

-- Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ Fonction toggle_client_super_admin corrigée avec succès ! ✅✅✅';
  RAISE NOTICE '   - Utilise is_platform_super_admin() pour les permissions';
  RAISE NOTICE '   - Utilise le rôle client_super_admin (pas super_admin)';
  RAISE NOTICE '   - Synchronise avec auth.users.raw_user_meta_data';
END $$;

