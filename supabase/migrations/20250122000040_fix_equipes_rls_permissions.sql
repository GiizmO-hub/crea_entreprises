/*
  # Fix : Correction des permissions RLS pour les tables equipes, collaborateurs_equipes et permissions_dossiers
  
  Problème : Les politiques RLS tentent d'accéder directement à la table utilisateurs
  dans les politiques RLS, ce qui cause "permission denied for table users".
  
  Solution : Utiliser la fonction is_super_admin() qui a SECURITY DEFINER
  et peut accéder à auth.users directement.
*/

-- 1. S'assurer que la fonction is_super_admin() existe
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

-- 2. Supprimer toutes les anciennes politiques pour equipes
DROP POLICY IF EXISTS "Users can view equipes of their entreprises" ON equipes;
DROP POLICY IF EXISTS "Super admins can manage equipes" ON equipes;

-- 3. Recréer les politiques RLS pour equipes en utilisant is_super_admin()
CREATE POLICY "Users can view equipes of their entreprises"
  ON equipes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = equipes.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage equipes"
  ON equipes FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = equipes.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = equipes.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- 4. Supprimer toutes les anciennes politiques pour collaborateurs_equipes
DROP POLICY IF EXISTS "Users can view collaborateurs_equipes of their entreprises" ON collaborateurs_equipes;
DROP POLICY IF EXISTS "Super admins can manage collaborateurs_equipes" ON collaborateurs_equipes;

-- 5. Recréer les politiques RLS pour collaborateurs_equipes en utilisant is_super_admin()
CREATE POLICY "Users can view collaborateurs_equipes of their entreprises"
  ON collaborateurs_equipes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM equipes
      JOIN entreprises ON entreprises.id = equipes.entreprise_id
      WHERE equipes.id = collaborateurs_equipes.equipe_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage collaborateurs_equipes"
  ON collaborateurs_equipes FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM equipes
      JOIN entreprises ON entreprises.id = equipes.entreprise_id
      WHERE equipes.id = collaborateurs_equipes.equipe_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM equipes
      JOIN entreprises ON entreprises.id = equipes.entreprise_id
      WHERE equipes.id = collaborateurs_equipes.equipe_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- 6. Supprimer toutes les anciennes politiques pour permissions_dossiers
DROP POLICY IF EXISTS "Users can view permissions_dossiers of their entreprises" ON permissions_dossiers;
DROP POLICY IF EXISTS "Super admins can manage permissions_dossiers" ON permissions_dossiers;

-- 7. Recréer les politiques RLS pour permissions_dossiers en utilisant is_super_admin()
CREATE POLICY "Users can view permissions_dossiers of their entreprises"
  ON permissions_dossiers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = permissions_dossiers.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage permissions_dossiers"
  ON permissions_dossiers FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = permissions_dossiers.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = permissions_dossiers.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

COMMENT ON FUNCTION is_super_admin() IS 'Vérifie si l''utilisateur actuel est super_admin en accédant à auth.users avec SECURITY DEFINER';




