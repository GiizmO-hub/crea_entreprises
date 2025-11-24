/*
  # Correction permissions table utilisateurs
  
  PROBLÈMES IDENTIFIÉS:
  1. Erreur 403/42501: "permission denied for table users" dans GestionEquipe.tsx et GestionProjets.tsx
  2. Les policies RLS sur utilisateurs bloquent l'accès même pour les admins
  
  SOLUTIONS:
  1. Créer fonction RPC pour lire utilisateurs de manière sécurisée
  2. Corriger les policies RLS pour permettre accès admin
  3. S'assurer que les admins peuvent lire les rôles des utilisateurs
*/

-- ============================================================================
-- PARTIE 1 : Fonction RPC pour lire les rôles utilisateurs
-- ============================================================================

-- Fonction pour obtenir le rôle d'un utilisateur (accessible par tous les utilisateurs authentifiés)
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  -- Récupérer le rôle depuis utilisateurs ou auth.users
  SELECT COALESCE(
    (SELECT role FROM utilisateurs WHERE id = p_user_id),
    (SELECT (raw_user_meta_data->>'role')::text FROM auth.users WHERE id = p_user_id),
    'client'
  ) INTO v_role;
  
  RETURN v_role;
END;
$$;

COMMENT ON FUNCTION get_user_role(uuid) IS 'Retourne le rôle d''un utilisateur (accessible par tous les utilisateurs authentifiés)';

-- Fonction pour obtenir les rôles de plusieurs utilisateurs (pour les admins)
CREATE OR REPLACE FUNCTION get_users_roles(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Vérifier que l'utilisateur est admin ou super_admin
  IF is_platform_super_admin() THEN
    -- Super admin, continuer
  ELSE
    -- Vérifier si c'est un admin (pas super_admin)
    SELECT COALESCE(
      (raw_user_meta_data->>'role')::text,
      ''
    ) INTO v_user_role
    FROM auth.users
    WHERE id = auth.uid();
    
    IF v_user_role NOT IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Accès non autorisé - Admin requis';
    END IF;
  END IF;
  
  -- Retourner les rôles
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    COALESCE(
      (SELECT role FROM utilisateurs WHERE id = u.id),
      (u.raw_user_meta_data->>'role')::text,
      'client'
    ) AS role
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids);
END;
$$;

COMMENT ON FUNCTION get_users_roles(uuid[]) IS 'Retourne les rôles de plusieurs utilisateurs (admin seulement)';

-- ============================================================================
-- PARTIE 2 : Corriger les policies RLS sur utilisateurs
-- ============================================================================

-- Activer RLS sur utilisateurs si pas déjà fait
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can read own profile" ON utilisateurs;
DROP POLICY IF EXISTS "Admins can read all users" ON utilisateurs;
DROP POLICY IF EXISTS "Users can update own profile" ON utilisateurs;
DROP POLICY IF EXISTS "Users can read utilisateurs" ON utilisateurs;
DROP POLICY IF EXISTS "Users can update utilisateurs" ON utilisateurs;
DROP POLICY IF EXISTS "Admins can insert utilisateurs" ON utilisateurs;

-- Fonction helper pour vérifier si admin (utilisable dans policies)
CREATE OR REPLACE FUNCTION is_admin_user_check()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  RETURN is_platform_super_admin() 
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND COALESCE((raw_user_meta_data->>'role')::text, '') IN ('super_admin', 'admin')
    );
END;
$$;

-- Policy SELECT : Les utilisateurs peuvent lire leur propre profil, les admins peuvent tout lire
CREATE POLICY "Users can read utilisateurs"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR is_admin_user_check()
  );

-- Policy UPDATE : Les utilisateurs peuvent modifier leur propre profil, les admins peuvent tout modifier
CREATE POLICY "Users can update utilisateurs"
  ON utilisateurs
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() 
    OR is_admin_user_check()
  )
  WITH CHECK (
    id = auth.uid() 
    OR is_admin_user_check()
  );

-- Policy INSERT : Seuls les admins peuvent créer des utilisateurs (normalement via create_espace_membre_from_client)
CREATE POLICY "Admins can insert utilisateurs"
  ON utilisateurs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user_check());

-- ============================================================================
-- PARTIE 3 : Permissions d'exécution
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_roles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user_check() TO authenticated;
