/*
  # Correction des politiques RLS pour modules_activation
  
  Utilisation de la fonction is_super_admin() pour éviter les problèmes de permissions
*/

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Super admin peut gérer tous les modules" ON modules_activation;
DROP POLICY IF EXISTS "Utilisateurs peuvent voir les modules actifs" ON modules_activation;

-- Vérifier que la fonction is_super_admin() existe, sinon la créer
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
  ) OR EXISTS (
    SELECT 1 
    FROM utilisateurs
    WHERE utilisateurs.id = auth.uid()
    AND utilisateurs.role = 'super_admin'
  );
END;
$$;

-- Créer la politique SELECT pour tous les utilisateurs authentifiés (voir modules actifs)
CREATE POLICY "Utilisateurs peuvent voir les modules actifs"
  ON modules_activation FOR SELECT
  TO authenticated
  USING (actif = true OR is_super_admin());

-- Créer la politique INSERT pour super admin uniquement
CREATE POLICY "Super admin peut insérer des modules"
  ON modules_activation FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- Créer la politique UPDATE pour super admin uniquement
CREATE POLICY "Super admin peut modifier des modules"
  ON modules_activation FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Créer la politique DELETE pour super admin uniquement
CREATE POLICY "Super admin peut supprimer des modules"
  ON modules_activation FOR DELETE
  TO authenticated
  USING (is_super_admin());

COMMENT ON FUNCTION is_super_admin IS 'Vérifier si l''utilisateur actuel est super admin';




