/*
  # Supprimer toutes les versions de is_platform_super_admin et en recréer une seule
  
  PROBLÈME:
  - Erreur "function is_platform_super_admin() is not unique"
  - Plusieurs versions de la fonction existent avec différentes signatures
  
  SOLUTION:
  - Supprimer TOUTES les versions existantes
  - Recréer UNE SEULE version propre
*/

-- Supprimer TOUTES les versions possibles de la fonction
DO $$
BEGIN
  -- Supprimer toutes les signatures possibles
  DROP FUNCTION IF EXISTS is_platform_super_admin() CASCADE;
  DROP FUNCTION IF EXISTS is_platform_super_admin(uuid) CASCADE;
  DROP FUNCTION IF EXISTS is_platform_super_admin(text) CASCADE;
  DROP FUNCTION IF EXISTS public.is_platform_super_admin() CASCADE;
  DROP FUNCTION IF EXISTS public.is_platform_super_admin(uuid) CASCADE;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorer les erreurs si certaines fonctions n'existent pas
    NULL;
END $$;

-- Recréer UNE SEULE version de la fonction
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
  
  -- Vérifier si l'utilisateur est un client
  -- Si c'est un client, ce n'est JAMAIS un super admin plateforme
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;
  
  -- Retourner true seulement si c'est 'super_admin' (pas 'client_super_admin')
  RETURN user_role = 'super_admin';
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin() IS 
  'Vérifie si l''utilisateur connecté est super_admin de la plateforme. Exclut les clients.';

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

-- Vérifier qu'il n'y a qu'une seule version
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'is_platform_super_admin';
  
  IF v_count = 1 THEN
    RAISE NOTICE '✅ Une seule version de is_platform_super_admin() existe';
  ELSE
    RAISE WARNING '❌ % versions de is_platform_super_admin() existent encore!', v_count;
  END IF;
END $$;




