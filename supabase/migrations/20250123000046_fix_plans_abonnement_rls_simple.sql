/*
  # Fix: Simplifier les politiques RLS sur plans_abonnement
  
  PROBLÈME:
  - L'erreur "permission denied for table users" peut venir de la jointure avec plans_abonnement
  - Les politiques RLS sur plans_abonnement peuvent essayer d'accéder à auth.users
  
  SOLUTION:
  - Simplifier les politiques RLS sur plans_abonnement
  - Permettre la lecture pour tous les utilisateurs authentifiés
*/

-- Supprimer toutes les politiques existantes sur plans_abonnement
DROP POLICY IF EXISTS "Plans visibles par tous authentifiés" ON plans_abonnement;
DROP POLICY IF EXISTS "Everyone can view active plans" ON plans_abonnement;
DROP POLICY IF EXISTS "Admins can insert plans" ON plans_abonnement;
DROP POLICY IF EXISTS "Admins can update plans" ON plans_abonnement;
DROP POLICY IF EXISTS "Admins can delete plans" ON plans_abonnement;
DROP POLICY IF EXISTS "Plans visibles par tous les utilisateurs authentifiés" ON plans_abonnement;

-- Créer une politique simple pour SELECT (lecture)
CREATE POLICY "Everyone can view active plans"
ON plans_abonnement
FOR SELECT
TO authenticated
USING (actif = true);

-- Créer une politique simple pour INSERT (création) - seulement pour super admin
CREATE POLICY "Admins can insert plans"
ON plans_abonnement
FOR INSERT
TO authenticated
WITH CHECK (
  check_is_super_admin()
);

-- Créer une politique simple pour UPDATE (modification) - seulement pour super admin
CREATE POLICY "Admins can update plans"
ON plans_abonnement
FOR UPDATE
TO authenticated
USING (check_is_super_admin())
WITH CHECK (check_is_super_admin());

-- Créer une politique simple pour DELETE (suppression) - seulement pour super admin
CREATE POLICY "Admins can delete plans"
ON plans_abonnement
FOR DELETE
TO authenticated
USING (check_is_super_admin());

-- Vérifier que les politiques sont créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'plans_abonnement';
  
  IF policy_count > 0 THEN
    RAISE NOTICE '✅ % politiques RLS créées pour la table plans_abonnement', policy_count;
  ELSE
    RAISE WARNING '⚠️  Aucune politique RLS trouvée pour plans_abonnement';
  END IF;
END $$;


