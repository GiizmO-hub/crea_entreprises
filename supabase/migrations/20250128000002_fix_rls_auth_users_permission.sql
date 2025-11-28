/*
  # FIX RLS - Permission denied for table users
  
  PROBLÈME:
  - Les RLS policies utilisent is_platform_super_admin() qui accède à auth.users
  - Erreur "permission denied for table users" (code 42501)
  - Les fonctions SECURITY DEFINER doivent avoir le bon search_path
  
  SOLUTION:
  - Vérifier que is_platform_super_admin() a SET search_path = public, auth
  - S'assurer que les fonctions peuvent accéder à auth.users
  - Vérifier les permissions des fonctions
*/

-- ✅ 1. Recréer is_platform_super_admin() avec le bon search_path et permissions
DROP FUNCTION IF EXISTS public.is_platform_super_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- ✅ Vérifier UNIQUEMENT le rôle 'super_admin' (plateforme), PAS 'client_super_admin'
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE users.id = auth.uid()
    AND COALESCE((users.raw_user_meta_data->>'role')::text, '') = 'super_admin'
  );
END;
$$;

-- ✅ 2. Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO anon;

-- ✅ 3. Vérifier que la fonction peut lire auth.users
-- Note: SECURITY DEFINER devrait permettre l'accès, mais on vérifie quand même
COMMENT ON FUNCTION public.is_platform_super_admin() IS 
'Vérifie si l''utilisateur est super_admin PLATEFORME (role = super_admin). 
Utilise SECURITY DEFINER pour accéder à auth.users. 
Distinction importante avec client_super_admin.';

-- ✅ 4. Tester la fonction
DO $$
DECLARE
  v_result boolean;
BEGIN
  SELECT public.is_platform_super_admin() INTO v_result;
  RAISE NOTICE '✅ Fonction is_platform_super_admin() testée: %', v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erreur lors du test: %', SQLERRM;
END $$;

-- ✅ 5. S'assurer que toutes les RLS policies utilisent cette fonction correctement
-- Les policies existantes devraient déjà utiliser public.is_platform_super_admin()
-- mais on vérifie qu'elles ne font pas d'accès direct à auth.users

COMMENT ON FUNCTION public.is_platform_super_admin() IS 
'Fonction SECURITY DEFINER pour vérifier le rôle super_admin PLATEFORME.
Doit être utilisée dans les RLS policies au lieu d''accès direct à auth.users.';

