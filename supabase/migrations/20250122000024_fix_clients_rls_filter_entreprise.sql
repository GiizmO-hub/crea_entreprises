/*
  # Fix: Filtrage clients par entreprise de l'utilisateur
  
  Modifie les politiques RLS pour que même les super_admins ne voient
  que les clients de leurs propres entreprises, pas tous les clients.
*/

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view clients of their entreprises" ON clients;
DROP POLICY IF EXISTS "Users can insert clients in their entreprises" ON clients;
DROP POLICY IF EXISTS "Users can update clients of their entreprises" ON clients;
DROP POLICY IF EXISTS "Users can delete clients of their entreprises" ON clients;

-- Créer une fonction pour vérifier si l'utilisateur est super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  -- Vérifier dans utilisateurs d'abord
  SELECT role INTO v_role
  FROM utilisateurs
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Fallback sur user_metadata
  SELECT (raw_user_meta_data->>'role')::text INTO v_role
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_role = 'super_admin', false);
END;
$$;

-- Politique SELECT : Utilisateurs voient uniquement les clients de leurs entreprises
CREATE POLICY "Users can view clients of their entreprises"
  ON clients FOR SELECT
  TO authenticated
  USING (
    -- Vérifier que l'entreprise appartient à l'utilisateur
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    -- Les super_admins ne peuvent voir que les entreprises qu'ils possèdent
    -- Pas d'exception pour voir tous les clients
  );

-- Politique INSERT : Utilisateurs peuvent insérer uniquement dans leurs entreprises
CREATE POLICY "Users can insert clients in their entreprises"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Vérifier que l'entreprise appartient à l'utilisateur
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique UPDATE : Utilisateurs peuvent modifier uniquement les clients de leurs entreprises
CREATE POLICY "Users can update clients of their entreprises"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    -- Vérifier que l'entreprise appartient à l'utilisateur
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- S'assurer que la modification garde l'entreprise dans la même entreprise
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Politique DELETE : Utilisateurs peuvent supprimer uniquement les clients de leurs entreprises
CREATE POLICY "Users can delete clients of their entreprises"
  ON clients FOR DELETE
  TO authenticated
  USING (
    -- Vérifier que l'entreprise appartient à l'utilisateur
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view clients of their entreprises" ON clients IS 
  'Les utilisateurs (y compris super_admins) ne peuvent voir que les clients de leurs propres entreprises';




