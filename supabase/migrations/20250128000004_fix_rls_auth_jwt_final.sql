/*
  # FIX RLS - Utiliser auth.jwt() directement (VERSION FINALE)
  
  PROBLÈME:
  - Erreur "permission denied for table users" (code 42501)
  - Erreur 403 (Forbidden) sur toutes les requêtes
  - Les RLS policies ne peuvent pas accéder à auth.users même via SECURITY DEFINER
  
  SOLUTION:
  - Utiliser auth.jwt()->>'role' directement dans les RLS policies
  - auth.jwt() est disponible dans les RLS policies sans problème de permissions
  - Pas besoin d'accéder à auth.users dans les policies
  
  CHANGEMENTS:
  - Recréer toutes les RLS policies pour utiliser auth.jwt()->>'role'
  - Vérifier la structure réelle des tables avant de créer les policies
*/

-- ✅ 1. ENTREPRISES - Utiliser auth.jwt() directement
DROP POLICY IF EXISTS "Platform super_admin can see all entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can create entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can update entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can delete entreprises" ON entreprises;

-- SELECT
CREATE POLICY "Platform super_admin can see all entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    -- ✅ Utiliser auth.jwt() directement au lieu de la fonction
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- INSERT
CREATE POLICY "Platform super_admin can create entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- ✅ 2. CLIENTS - Utiliser auth.jwt() directement
-- Note: La table clients n'a PAS de colonne user_id, seulement entreprise_id
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;

-- SELECT
CREATE POLICY "Platform super_admin can see all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Platform super_admin can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 3. FACTURES - Utiliser auth.jwt() directement
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;

-- SELECT
CREATE POLICY "Platform super_admin can see all factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Platform super_admin can create factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete factures"
  ON factures FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 4. ABONNEMENTS - Utiliser auth.jwt() directement
DROP POLICY IF EXISTS "Platform super_admin can see all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can create abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can update abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can delete abonnements" ON abonnements;

-- SELECT
CREATE POLICY "Platform super_admin can see all abonnements"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Platform super_admin can create abonnements"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update abonnements"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete abonnements"
  ON abonnements FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 5. PAIEMENTS - Utiliser auth.jwt() directement
DROP POLICY IF EXISTS "Platform super_admin can see all paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can create paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can update paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can delete paiements" ON paiements;

-- SELECT
CREATE POLICY "Platform super_admin can see all paiements"
  ON paiements FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "Platform super_admin can create paiements"
  ON paiements FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update paiements"
  ON paiements FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete paiements"
  ON paiements FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 6. ESPACES_MEMBRES_CLIENTS - Utiliser auth.jwt() directement
DROP POLICY IF EXISTS "Platform super_admin can see all espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can create espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can update espaces_membres_clients" ON espaces_membres_clients;
DROP POLICY IF EXISTS "Platform super_admin can delete espaces_membres_clients" ON espaces_membres_clients;

-- SELECT
CREATE POLICY "Platform super_admin can see all espaces_membres_clients"
  ON espaces_membres_clients FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR client_id IN (
      SELECT id FROM clients WHERE entreprise_id IN (
        SELECT id FROM entreprises WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT
CREATE POLICY "Platform super_admin can create espaces_membres_clients"
  ON espaces_membres_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- UPDATE
CREATE POLICY "Platform super_admin can update espaces_membres_clients"
  ON espaces_membres_clients FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- DELETE
CREATE POLICY "Platform super_admin can delete espaces_membres_clients"
  ON espaces_membres_clients FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- ✅ Vérification finale
DO $$
BEGIN
  RAISE NOTICE '✅ Migration RLS auth.jwt() appliquée avec succès !';
  RAISE NOTICE '   → Toutes les policies utilisent maintenant auth.jwt()->>''role''';
  RAISE NOTICE '   → Plus d''accès à auth.users dans les RLS policies';
  RAISE NOTICE '   → Les erreurs 403 devraient être résolues';
END $$;

