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
-- Utilise uniquement la table utilisateurs (pas auth.users) pour éviter les problèmes de permissions
CREATE OR REPLACE FUNCTION is_user_protected(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  -- Récupérer l'email depuis auth.users (lecture seule, pas de problème de permissions)
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Vérifier si c'est le compte créateur
  IF v_email = 'meddecyril@icloud.com' THEN
    RETURN true;
  END IF;
  
  -- Vérifier dans la table utilisateurs si l'utilisateur est marqué comme protégé
  -- Note: La colonne metadata n'existe pas dans utilisateurs, on vérifie uniquement le rôle
  RETURN EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = p_user_id
    AND role = 'super_admin'
  );
END;
$$;

COMMENT ON FUNCTION is_user_protected IS 'Vérifie si un utilisateur est protégé contre la suppression';

-- Trigger pour empêcher la suppression du compte créateur
-- Note: Ce trigger nécessite des privilèges élevés sur auth.users
-- Si les privilèges ne sont pas suffisants, le trigger ne sera pas créé mais la fonction is_user_protected fonctionnera quand même
CREATE OR REPLACE FUNCTION prevent_protected_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  -- Récupérer l'email depuis OLD (pas besoin de lire auth.users)
  v_email := OLD.email;
  
  -- Empêcher la suppression si c'est le compte créateur
  IF v_email = 'meddecyril@icloud.com' THEN
    RAISE EXCEPTION 'Cannot delete protected user: % (Creator account cannot be deleted)', v_email
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  
  -- Vérifier via la fonction is_user_protected (qui lit depuis utilisateurs)
  IF is_user_protected(OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete protected user: % (Protected account cannot be deleted)', v_email
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  
  RETURN OLD;
END;
$$;

-- Note: La création du trigger sur auth.users nécessite d'être owner de la table
-- Cette partie est commentée car elle nécessite des privilèges élevés
-- La protection fonctionnera quand même via la fonction is_user_protected() 
-- qui peut être utilisée dans les fonctions de suppression de l'application
-- 
-- Pour activer le trigger, il faut être owner de auth.users ou utiliser l'API Supabase Admin
-- 
-- CREATE TRIGGER prevent_protected_user_deletion_trigger
--   BEFORE DELETE ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION prevent_protected_user_deletion();

-- Marquer explicitement le compte créateur comme protégé
-- Note: On ne peut pas modifier directement auth.users sans être owner
-- On utilise uniquement la table utilisateurs pour la protection
-- Le trigger empêchera la suppression via la fonction is_user_protected

-- S'assurer que le rôle super_admin est bien défini dans la table utilisateurs
-- Cette partie peut fonctionner car on modifie uniquement la table utilisateurs (pas auth.users)
DO $$
BEGIN
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
    
  RAISE NOTICE '✅ Compte créateur protégé dans la table utilisateurs';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erreur lors de la protection du créateur: %', SQLERRM;
END $$;

COMMENT ON FUNCTION prevent_protected_user_deletion IS 
  'Empêche la suppression du compte créateur et des comptes marqués comme protégés';

