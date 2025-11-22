/*
  # Fix: Politique RLS pour super admin sur abonnements
  
  Le problème: Les super admins ne peuvent pas voir tous les abonnements à cause des politiques RLS
  Solution: Ajouter une politique qui permet aux super admins de voir tous les abonnements
*/

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can manage abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can view all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Super admin can manage all abonnements" ON abonnements;

-- Politique pour super admin : voir tous les abonnements
CREATE POLICY "Super admin can view all abonnements"
  ON abonnements FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Politique pour super admin : gérer tous les abonnements
CREATE POLICY "Super admin can manage all abonnements"
  ON abonnements FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Politique pour utilisateurs normaux : voir leurs abonnements via entreprise
CREATE POLICY "Users can view abonnements of their entreprises"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin() AND
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique pour utilisateurs normaux : gérer leurs abonnements via entreprise
CREATE POLICY "Users can manage abonnements of their entreprises"
  ON abonnements FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin() AND
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    NOT is_super_admin() AND
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Super admin can view all abonnements" ON abonnements IS 'Les super admins peuvent voir tous les abonnements';
COMMENT ON POLICY "Super admin can manage all abonnements" ON abonnements IS 'Les super admins peuvent gérer tous les abonnements';

