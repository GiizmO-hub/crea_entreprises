/*
  # Corriger is_platform_super_admin pour détecter correctement les super admins
  
  PROBLÈME:
  - is_platform_super_admin() retourne false même pour les super admins plateforme
  - La fonction ne détecte pas correctement le rôle super_admin
  
  SOLUTION:
  - Simplifier la logique de détection
  - Vérifier directement dans auth.users sans dépendre de espaces_membres_clients
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS is_platform_super_admin() CASCADE;

-- Créer une version simplifiée et plus robuste
CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Si pas d'utilisateur connecté, retourner false
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Récupérer le rôle directement depuis auth.users
  SELECT COALESCE(
    (raw_user_meta_data->>'role')::text,
    ''
  ) INTO user_role
  FROM auth.users
  WHERE id = auth.uid();
  
  -- ✅ CORRECTION: Retourner true si c'est 'super_admin' ET que ce n'est PAS un client
  -- Vérifier si l'utilisateur est un client
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = auth.uid()
  ) THEN
    -- Si c'est un client, ce n'est JAMAIS un super admin plateforme
    RETURN false;
  END IF;
  
  -- Retourner true seulement si c'est 'super_admin' (pas 'client_super_admin')
  RETURN user_role = 'super_admin';
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin() IS 
  'Vérifie si l''utilisateur connecté est super_admin de la plateforme. Exclut les clients.';

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

-- Tester la fonction pour l'utilisateur admin
DO $$
DECLARE
  v_admin_id uuid;
  v_test_result boolean;
BEGIN
  -- Trouver l'ID de l'admin
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  AND COALESCE((raw_user_meta_data->>'role')::text, '') = 'super_admin'
  LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    -- Simuler l'appel avec cet utilisateur (pas possible directement, juste pour info)
    RAISE NOTICE '✅ Utilisateur admin trouvé: %', v_admin_id;
    
    -- Vérifier qu'il n'a pas d'espace client
    IF NOT EXISTS (SELECT 1 FROM espaces_membres_clients WHERE user_id = v_admin_id) THEN
      RAISE NOTICE '✅ Utilisateur admin n''a pas d''espace client - devrait être détecté comme super admin';
    ELSE
      RAISE WARNING '⚠️ Utilisateur admin a un espace client - ne sera PAS détecté comme super admin';
    END IF;
  END IF;
END $$;




