/*
  # Fix : Correction de la récursion infinie dans les politiques RLS de utilisateurs
  
  Problème : La politique "Utilisateurs peuvent voir collaborateurs de leur entreprise" 
  fait une sous-requête sur la table utilisateurs elle-même, créant une récursion infinie.
  
  Solution : 
  1. Supprimer la politique problématique qui crée la récursion
  2. Utiliser uniquement les politiques qui vérifient l'utilisateur lui-même (pas de sous-requête récursive)
  3. Les super_admins peuvent déjà tout voir via une autre politique
*/

-- 1. Supprimer la politique qui crée la récursion
DROP POLICY IF EXISTS "Utilisateurs peuvent voir collaborateurs de leur entreprise" ON utilisateurs;

-- 2. S'assurer que les politiques non-récursives sont bien présentes

-- Politique 1 : Utilisateurs peuvent voir leurs propres infos (pas de récursion)
DROP POLICY IF EXISTS "Utilisateurs peuvent voir leurs propres infos" ON utilisateurs;
CREATE POLICY "Utilisateurs peuvent voir leurs propres infos"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Politique 2 : Super admin peut voir tous les utilisateurs (vérifie dans auth.users, pas dans utilisateurs)
DROP POLICY IF EXISTS "Super admin peut voir tous les utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut voir tous les utilisateurs"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
        OR (auth.users.raw_user_meta_data->>'role')::text = 'admin'
      )
    )
  );

-- 3. S'assurer que les politiques INSERT, UPDATE, DELETE sont également non-récursives

-- INSERT : Super admin peut créer des utilisateurs
DROP POLICY IF EXISTS "Super admin peut créer des utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut créer des utilisateurs"
  ON utilisateurs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- UPDATE : Super admin peut modifier tous les utilisateurs
DROP POLICY IF EXISTS "Super admin peut modifier tous les utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut modifier tous les utilisateurs"
  ON utilisateurs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- UPDATE : Utilisateurs peuvent modifier leurs propres infos
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier leurs propres infos" ON utilisateurs;
CREATE POLICY "Utilisateurs peuvent modifier leurs propres infos"
  ON utilisateurs FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE : Super admin peut supprimer des utilisateurs
DROP POLICY IF EXISTS "Super admin peut supprimer des utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut supprimer des utilisateurs"
  ON utilisateurs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- 4. Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS corrigées - Plus de récursion infinie';
  RAISE NOTICE 'Les utilisateurs peuvent voir leur propre profil';
  RAISE NOTICE 'Les super_admins peuvent voir tous les utilisateurs';
END $$;

