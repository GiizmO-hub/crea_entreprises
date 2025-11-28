/*
  # RESTAURER LES RLS PROGRESSIVEMENT - ÉTAPE 1
  
  OBJECTIF:
  - Réappliquer les RLS policies de manière simple et progressive
  - Commencer par les tables principales avec des policies simples
  - Tester au fur et à mesure
  
  ÉTAPE 1: Tables principales (entreprises, clients, factures, abonnements)
  ÉTAPE 2: Tables secondaires (paiements, espaces_membres_clients)
  ÉTAPE 3: Tables spéciales (collaborateurs, documents, utilisateurs)
  
  PRINCIPE:
  - Super admin voit TOUT (vérifié via auth.jwt()->>'role')
  - Utilisateurs normaux voient leurs propres données
  - Pas de sous-requêtes complexes qui peuvent causer des problèmes
*/

-- ✅ Fonction simple pour vérifier super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin_check()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Vérifier le rôle dans le JWT (plusieurs emplacements possibles)
  SELECT 
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin';
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin_check() TO authenticated;

-- ✅ FONCTION helper pour vérifier si l'utilisateur possède une entreprise
-- Utilise SECURITY DEFINER pour éviter les problèmes de permissions
CREATE OR REPLACE FUNCTION public.user_owns_entreprise_check(entreprise_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM entreprises 
    WHERE id = entreprise_uuid 
    AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_owns_entreprise_check(uuid) TO authenticated;

-- ============================================================================
-- ÉTAPE 1: TABLES PRINCIPALES
-- ============================================================================

-- ✅ 1. ENTREPRISES
DROP POLICY IF EXISTS "temp_allow_all_entreprises" ON entreprises;
CREATE POLICY "super_admin_or_owner_entreprises"
  ON entreprises FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  );

-- ✅ 2. CLIENTS
DROP POLICY IF EXISTS "temp_allow_all_clients" ON clients;
CREATE POLICY "super_admin_or_owner_clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  );

-- ✅ 3. FACTURES
DROP POLICY IF EXISTS "temp_allow_all_factures" ON factures;
CREATE POLICY "super_admin_or_owner_factures"
  ON factures FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  );

-- ✅ 4. ABONNEMENTS
DROP POLICY IF EXISTS "temp_allow_all_abonnements" ON abonnements;
CREATE POLICY "super_admin_or_owner_abonnements"
  ON abonnements FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR public.user_owns_entreprise_check(entreprise_id)
  );

-- ✅ 5. PAIEMENTS
DROP POLICY IF EXISTS "temp_allow_all_paiements" ON paiements;
CREATE POLICY "super_admin_or_owner_paiements"
  ON paiements FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise_check(entreprise_id))
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise_check(entreprise_id))
  );

-- ✅ Message de fin
DO $$
BEGIN
  RAISE NOTICE '✅ ÉTAPE 1 TERMINÉE: RLS restaurées pour tables principales';
  RAISE NOTICE '   → entreprises, clients, factures, abonnements, paiements';
  RAISE NOTICE '   → Testez maintenant avant de continuer avec les autres tables';
END $$;

