/*
  # Fix : Correction des permissions RLS pour la table collaborateurs
  
  Problème : Les politiques RLS de collaborateurs vérifient dans utilisateurs, 
  mais cela cause "permission denied for table users" car les politiques RLS 
  ne peuvent pas accéder directement à auth.users sans SECURITY DEFINER.
  
  Solution : 
  1. Créer une fonction SECURITY DEFINER pour vérifier si l'utilisateur est super_admin
  2. Utiliser cette fonction dans les politiques RLS au lieu de vérifier dans utilisateurs
  3. Utiliser auth.users.raw_user_meta_data directement dans les politiques (plus simple)
*/

-- 1. Créer une fonction pour vérifier si l'utilisateur actuel est super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
END;
$$;

-- 2. Recréer les politiques RLS en utilisant la fonction ou auth.users directement

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Super admin peut voir tous les collaborateurs" ON collaborateurs;
DROP POLICY IF EXISTS "Collaborateurs peuvent voir leurs propres infos" ON collaborateurs;
DROP POLICY IF EXISTS "Admins peuvent voir collaborateurs de leur entreprise" ON collaborateurs;
DROP POLICY IF EXISTS "Super admin peut créer collaborateurs" ON collaborateurs;
DROP POLICY IF EXISTS "Super admin peut modifier collaborateurs" ON collaborateurs;
DROP POLICY IF EXISTS "Super admin peut supprimer collaborateurs" ON collaborateurs;

-- Politique SELECT : Super admin peut voir tous les collaborateurs (utilise auth.users directement)
CREATE POLICY "Super admin peut voir tous les collaborateurs"
  ON collaborateurs FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR user_id = auth.uid() -- Les utilisateurs peuvent voir leur propre profil
  );

-- Politique INSERT : Super admin peut créer des collaborateurs
CREATE POLICY "Super admin peut créer collaborateurs"
  ON collaborateurs FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- Politique UPDATE : Super admin peut modifier les collaborateurs
CREATE POLICY "Super admin peut modifier collaborateurs"
  ON collaborateurs FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Politique DELETE : Super admin peut supprimer les collaborateurs
CREATE POLICY "Super admin peut supprimer collaborateurs"
  ON collaborateurs FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- 3. Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS corrigées pour collaborateurs';
  RAISE NOTICE 'Utilise maintenant is_super_admin() et auth.users directement';
END $$;

