/*
  # Corriger les politiques RLS pour que les admins voient toutes les entreprises
  
  PROBLÈME:
  - Les admins ne peuvent pas voir toutes les entreprises
  - La politique RLS limite l'accès aux entreprises de l'utilisateur uniquement
  
  SOLUTION:
  - Mettre à jour la politique RLS pour utiliser is_platform_super_admin()
  - Les super admins plateforme doivent voir TOUTES les entreprises
*/

-- Supprimer TOUTES les anciennes politiques
DROP POLICY IF EXISTS "Users can read entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can read own entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can view entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can view their own entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can insert their own entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can update their own entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can delete their own entreprises" ON entreprises;

-- Recréer la politique SELECT pour permettre aux admins de tout voir
CREATE POLICY "Users can read entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    -- Les super admins plateforme voient tout
    is_platform_super_admin() OR
    -- Sinon, l'utilisateur voit ses propres entreprises
    user_id = auth.uid()
  );

-- Recréer toutes les politiques avec support admin
CREATE POLICY "Users can insert entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    is_platform_super_admin() OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can update entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    is_platform_super_admin() OR
    user_id = auth.uid()
  )
  WITH CHECK (
    is_platform_super_admin() OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    is_platform_super_admin() OR
    user_id = auth.uid()
  );

-- Commentaires
COMMENT ON POLICY "Users can read entreprises" ON entreprises IS 
  'Les super admins plateforme voient toutes les entreprises, les autres utilisateurs voient seulement les leurs.';

