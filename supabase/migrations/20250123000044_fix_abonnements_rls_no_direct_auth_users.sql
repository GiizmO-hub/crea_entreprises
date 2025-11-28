/*
  # Fix: "permission denied for table users" dans les politiques RLS abonnements
  
  PROBLÈME:
  - Les politiques RLS tentent d'accéder directement à auth.users
  - PostgreSQL retourne "permission denied for table users" (code 42501)
  - Les politiques RLS ne peuvent pas accéder directement à auth.users sans SECURITY DEFINER
  
  SOLUTION:
  - Utiliser une fonction SECURITY DEFINER pour vérifier les rôles
  - Utiliser client_id au lieu de chercher dans auth.users
  - Simplifier les politiques pour éviter les accès directs à auth.users
*/

-- Supprimer toutes les politiques qui accèdent à auth.users
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can delete abonnements" ON abonnements;

-- Créer une fonction helper pour vérifier si l'utilisateur est admin
-- (si elle n'existe pas déjà)
CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

-- ============================================================================
-- NOUVELLES POLITIQUES RLS SIMPLIFIÉES (sans accès direct à auth.users)
-- ============================================================================

-- 1. SELECT: Utilisateurs voient leurs abonnements ou ceux de leurs entreprises
CREATE POLICY "Users can view abonnements of their entreprises"
ON abonnements
FOR SELECT
TO authenticated
USING (
  -- Super admin peut tout voir (via fonction SECURITY DEFINER)
  is_platform_super_admin()
  OR
  -- Utilisateur peut voir ses propres abonnements (client_id = auth.uid())
  client_id = auth.uid()
  OR
  -- Utilisateur peut voir les abonnements de ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 2. INSERT: Super admin peut créer pour n'importe qui, utilisateurs pour leurs entreprises
CREATE POLICY "Users can insert abonnements for their entreprises"
ON abonnements
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admin peut créer pour n'importe qui
  is_platform_super_admin()
  OR
  -- Utilisateur peut créer pour ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 3. UPDATE: Super admin peut modifier tout, utilisateurs peuvent modifier ceux de leurs entreprises
CREATE POLICY "Users can update abonnements of their entreprises"
ON abonnements
FOR UPDATE
TO authenticated
USING (
  -- Super admin peut modifier tout
  is_platform_super_admin()
  OR
  -- Utilisateur peut modifier les abonnements de ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Mêmes conditions pour WITH CHECK
  is_platform_super_admin()
  OR
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 4. DELETE: Seul super admin peut supprimer
CREATE POLICY "Super admin can delete abonnements"
ON abonnements
FOR DELETE
TO authenticated
USING (
  is_platform_super_admin()
);

-- Vérifier que les politiques sont bien créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'abonnements';
  
  IF policy_count > 0 THEN
    RAISE NOTICE '✅ % politiques RLS créées pour la table abonnements', policy_count;
  ELSE
    RAISE WARNING '⚠️  Aucune politique RLS trouvée après création';
  END IF;
END $$;

COMMENT ON POLICY "Users can view abonnements of their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de voir leurs propres abonnements ou ceux de leurs entreprises. Les super admins voient tout.';

COMMENT ON POLICY "Users can insert abonnements for their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de créer des abonnements pour leurs entreprises. Les super admins peuvent créer pour n''importe qui.';

COMMENT ON POLICY "Users can update abonnements of their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de modifier les abonnements de leurs entreprises. Les super admins peuvent modifier tout.';

COMMENT ON POLICY "Super admin can delete abonnements" ON abonnements IS 
  'Seuls les super admins peuvent supprimer des abonnements.';


