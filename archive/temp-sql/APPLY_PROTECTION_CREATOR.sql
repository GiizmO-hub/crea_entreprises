/*
  # Protection du compte créateur - À appliquer dans Supabase Dashboard
  
  Ce script protège le compte créateur contre la suppression et s'assure
  qu'il a tous les droits super_admin.
*/

-- 1. Fonction pour vérifier si un utilisateur est protégé
CREATE OR REPLACE FUNCTION is_user_protected(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (
      (raw_user_meta_data->>'is_protected')::boolean = true
      OR (raw_user_meta_data->>'is_creator')::boolean = true
      OR email = 'meddecyril@icloud.com'
    )
  );
END;
$$;

-- 2. Fonction trigger pour empêcher la suppression
CREATE OR REPLACE FUNCTION prevent_protected_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF is_user_protected(OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete protected user: % (Creator account cannot be deleted)', OLD.email
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

-- 3. Créer le trigger
DROP TRIGGER IF EXISTS prevent_protected_user_deletion_trigger ON auth.users;
CREATE TRIGGER prevent_protected_user_deletion_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_user_deletion();

-- 4. Marquer le compte créateur comme protégé et super_admin
-- Note: On utilise uniquement raw_user_meta_data car raw_app_meta_data n'est pas toujours disponible
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

-- 5. S'assurer que le rôle est bien défini dans utilisateurs
INSERT INTO utilisateurs (id, email, role, statut, created_at)
SELECT 
  id,
  email,
  'super_admin',
  'active',
  created_at
FROM auth.users
WHERE email = 'meddecyril@icloud.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  email = EXCLUDED.email,
  statut = 'active',
  updated_at = NOW();

-- Vérification
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'is_protected' as is_protected,
  raw_user_meta_data->>'is_creator' as is_creator
FROM auth.users
WHERE email = 'meddecyril@icloud.com';

