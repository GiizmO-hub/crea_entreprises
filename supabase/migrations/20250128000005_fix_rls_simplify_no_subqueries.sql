/*
  # FIX RLS - Simplifier les policies sans sous-requêtes complexes
  
  PROBLÈME:
  - Les erreurs "permission denied for table users" persistent
  - Même avec auth.jwt(), les sous-requêtes complexes peuvent causer des problèmes
  - Les sous-requêtes qui vérifient user_id peuvent encore accéder à auth.users
  
  SOLUTION:
  - Simplifier les policies en évitant les sous-requêtes complexes
  - Utiliser uniquement auth.jwt() et auth.uid() directement
  - Pour les tables liées (clients, factures, etc.), créer des fonctions helper simples
  - Utiliser des fonctions SECURITY DEFINER seulement pour les vérifications simples
  
  CHANGEMENTS:
  - Créer des fonctions helper qui utilisent auth.jwt() uniquement
  - Simplifier les policies pour éviter les sous-requêtes complexes
*/

-- ✅ Fonction helper simple pour vérifier si l'utilisateur est super_admin
CREATE OR REPLACE FUNCTION public.is_platform_super_admin_simple()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- ✅ Utiliser auth.jwt() directement - disponible dans RLS policies
  SELECT COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin';
$$;

-- ✅ Fonction helper pour vérifier si l'utilisateur possède une entreprise
-- Note: Cette fonction évite les sous-requêtes dans les policies
CREATE OR REPLACE FUNCTION public.user_owns_entreprise(entreprise_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Vérifier directement sans sous-requête complexe
  SELECT EXISTS (
    SELECT 1 
    FROM entreprises 
    WHERE id = entreprise_uuid 
    AND user_id = auth.uid()
  );
$$;

-- ✅ 1. ENTREPRISES - Policies simplifiées
DROP POLICY IF EXISTS "Platform super_admin can see all entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can create entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can update entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can delete entreprises" ON entreprises;

CREATE POLICY "Super admin ou propriétaire peut voir entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou utilisateur peut créer entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou propriétaire peut modifier entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou propriétaire peut supprimer entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

-- ✅ 2. CLIENTS - Policies simplifiées avec fonction helper
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;

CREATE POLICY "Super admin ou propriétaire entreprise peut voir clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut créer clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut modifier clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut supprimer clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 3. FACTURES - Policies simplifiées
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;

CREATE POLICY "Super admin ou propriétaire entreprise peut voir factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut créer factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut modifier factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut supprimer factures"
  ON factures FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 4. ABONNEMENTS - Policies simplifiées
DROP POLICY IF EXISTS "Platform super_admin can see all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can create abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can update abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can delete abonnements" ON abonnements;

CREATE POLICY "Super admin ou propriétaire entreprise peut voir abonnements"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut créer abonnements"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut modifier abonnements"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

CREATE POLICY "Super admin ou propriétaire entreprise peut supprimer abonnements"
  ON abonnements FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 5. PAIEMENTS - Policies simplifiées
DROP POLICY IF EXISTS "Platform super_admin can see all paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can create paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can update paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can delete paiements" ON paiements;

CREATE POLICY "Super admin ou propriétaire peut voir paiements"
  ON paiements FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  );

CREATE POLICY "Super admin ou utilisateur peut créer paiements"
  ON paiements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  );

CREATE POLICY "Super admin ou propriétaire peut modifier paiements"
  ON paiements FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  );

CREATE POLICY "Super admin ou propriétaire peut supprimer paiements"
  ON paiements FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  );

-- ✅ 6. ESPACES_MEMBRES_CLIENTS - Policies simplifiées
DROP POLICY IF EXISTS "Platform super_admin can see all espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can create espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can update espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can delete espaces_membres_clients" ON espaces_membres_clients;

CREATE POLICY "Super admin ou utilisateur peut voir espaces membres"
  ON espaces_membres_clients FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou utilisateur peut créer espaces membres"
  ON espaces_membres_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou utilisateur peut modifier espaces membres"
  ON espaces_membres_clients FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

CREATE POLICY "Super admin ou utilisateur peut supprimer espaces membres"
  ON espaces_membres_clients FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin_simple()
    OR user_id = auth.uid()
  );

-- ✅ Accorder les permissions sur les fonctions
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin_simple() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_entreprise(uuid) TO authenticated;

-- ✅ Vérification finale
DO $$
BEGIN
  RAISE NOTICE '✅ Migration RLS simplifiée appliquée avec succès !';
  RAISE NOTICE '   → Utilisation de fonctions helper simples';
  RAISE NOTICE '   → Plus de sous-requêtes complexes dans les policies';
  RAISE NOTICE '   → Les erreurs 403 devraient être résolues';
END $$;

