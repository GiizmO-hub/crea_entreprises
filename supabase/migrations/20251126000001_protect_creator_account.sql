/*
  # Protection du compte créateur de l'application
  
  1. Objectif
    - Empêcher la suppression du compte créateur (meddecyril@icloud.com)
    - Protéger les rôles super_admin de la plateforme
  
  2. Méthodes
    - Trigger BEFORE DELETE sur auth.users pour bloquer la suppression
    - Protection dans les fonctions de suppression
    - Marqueur dans les métadonnées utilisateur
*/

-- Fonction pour vérifier si un utilisateur est protégé contre la suppression
CREATE OR REPLACE FUNCTION is_user_protected(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Vérifier si l'utilisateur est marqué comme protégé ou créateur
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (
      (raw_user_meta_data->>'is_protected')::boolean = true
      OR (raw_user_meta_data->>'is_creator')::boolean = true
      OR email = 'meddecyril@icloud.com' -- Protection explicite pour le créateur
    )
  );
END;
$$;

COMMENT ON FUNCTION is_user_protected IS 'Vérifie si un utilisateur est protégé contre la suppression';

-- Trigger pour empêcher la suppression du compte créateur
CREATE OR REPLACE FUNCTION prevent_protected_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Empêcher la suppression si l'utilisateur est protégé
  IF is_user_protected(OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete protected user: % (Creator account cannot be deleted)', OLD.email
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  
  RETURN OLD;
END;
$$;

-- Créer le trigger si il n'existe pas déjà
DROP TRIGGER IF EXISTS prevent_protected_user_deletion_trigger ON auth.users;

CREATE TRIGGER prevent_protected_user_deletion_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_user_deletion();

COMMENT ON TRIGGER prevent_protected_user_deletion_trigger ON auth.users IS 
  'Empêche la suppression du compte créateur et des comptes protégés';

-- Marquer explicitement le compte créateur comme protégé
-- Note: On utilise uniquement raw_user_meta_data (colonne standard Supabase)
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

-- S'assurer que le rôle super_admin est bien défini dans la table utilisateurs
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
  updated_at = NOW()
WHERE utilisateurs.id = EXCLUDED.id;

COMMENT ON FUNCTION prevent_protected_user_deletion IS 
  'Empêche la suppression du compte créateur et des comptes marqués comme protégés';

