/*
  # Fix: Simplifier les politiques RLS pour éviter "permission denied for table users"
  
  PROBLÈME:
  - L'erreur "permission denied for table users" (code 42501) persiste
  - Même avec SECURITY DEFINER, il peut y avoir des problèmes
  - La requête frontend joint plans_abonnement qui peut aussi causer des problèmes
  
  SOLUTION:
  - Simplifier les politiques RLS pour éviter les accès à auth.users
  - Utiliser uniquement les colonnes disponibles dans la table abonnements
  - Permettre aux super admins via une fonction simple qui ne dépend pas de auth.users
*/

-- Supprimer toutes les politiques actuelles
DROP POLICY IF EXISTS "Super admin can delete abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;

-- Créer une fonction simple pour vérifier si c'est un super admin
-- Sans accès direct à auth.users dans les politiques
CREATE OR REPLACE FUNCTION check_is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier dans raw_user_meta_data
  SELECT (raw_user_meta_data->>'role')::text INTO v_role
  FROM auth.users
  WHERE id = v_user_id
  LIMIT 1;
  
  IF v_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Vérifier dans raw_app_meta_data
  SELECT (raw_app_meta_data->>'role')::text INTO v_role
  FROM auth.users
  WHERE id = v_user_id
  LIMIT 1;
  
  RETURN COALESCE(v_role IN ('super_admin', 'admin'), false);
END;
$$;

-- ============================================================================
-- POLITIQUES RLS SIMPLIFIÉES (sans accès direct à auth.users)
-- ============================================================================

-- 1. SELECT: Permissif - permettre la lecture si l'utilisateur a des entreprises
-- ou si c'est un super admin
CREATE POLICY "Users can view abonnements of their entreprises"
ON abonnements
FOR SELECT
TO authenticated
USING (
  -- Super admin via fonction SECURITY DEFINER
  check_is_super_admin()
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

-- 2. INSERT: Permettre la création pour les entreprises de l'utilisateur ou super admin
CREATE POLICY "Users can insert abonnements for their entreprises"
ON abonnements
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admin peut créer pour n'importe qui
  check_is_super_admin()
  OR
  -- Utilisateur peut créer pour ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 3. UPDATE: Permettre la modification pour les entreprises de l'utilisateur ou super admin
CREATE POLICY "Users can update abonnements of their entreprises"
ON abonnements
FOR UPDATE
TO authenticated
USING (
  check_is_super_admin()
  OR
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
)
WITH CHECK (
  check_is_super_admin()
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
  check_is_super_admin()
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

-- Tester la fonction
DO $$
DECLARE
  v_test_result boolean;
BEGIN
  SELECT check_is_super_admin() INTO v_test_result;
  RAISE NOTICE '✅ Fonction check_is_super_admin() testée: %', v_test_result;
END $$;

COMMENT ON FUNCTION check_is_super_admin IS 
  'Vérifie si l''utilisateur actuel est super admin. Utilise SECURITY DEFINER pour accéder à auth.users.';

COMMENT ON POLICY "Users can view abonnements of their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de voir leurs propres abonnements ou ceux de leurs entreprises. Les super admins voient tout.';


