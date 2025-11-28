/*
  # FIX RLS - Utiliser auth.jwt() directement au lieu d'accéder auth.users
  
  PROBLÈME:
  - Erreur "permission denied for table users" (code 42501)
  - Les fonctions SECURITY DEFINER qui accèdent à auth.users ne fonctionnent pas dans RLS policies
  - Les policies ne peuvent pas appeler des fonctions qui accèdent à auth.users
  
  SOLUTION:
  - Utiliser auth.jwt() directement dans les policies pour lire les métadonnées
  - auth.jwt() retourne le token JWT actuel avec toutes les métadonnées
  - Pas besoin d'accéder à auth.users dans les policies
  
  CHANGEMENTS:
  - Recréer les policies pour utiliser auth.jwt()->>'role' au lieu de is_platform_super_admin()
  - Garder is_platform_super_admin() pour les appels RPC, mais utiliser auth.jwt() dans RLS
*/

-- ✅ Fonction helper qui utilise auth.jwt() au lieu d'auth.users
-- Cette fonction peut être utilisée dans les RLS policies
CREATE OR REPLACE FUNCTION public.is_platform_super_admin_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- ✅ Utiliser auth.jwt() directement (disponible dans RLS policies)
  -- Pas besoin de SECURITY DEFINER car on n'accède pas à auth.users
  SELECT COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin';
$$;

COMMENT ON FUNCTION public.is_platform_super_admin_jwt() IS 
'Vérifie si l''utilisateur est super_admin PLATEFORME en utilisant auth.jwt().
Utilisable dans les RLS policies car n''accède pas à auth.users.';

-- ✅ 1. ENTREPRISES - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can see all entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    -- ✅ Utiliser auth.jwt() directement au lieu de la fonction
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Platform super_admin can create entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can create entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Platform super_admin can update entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can update entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Platform super_admin can delete entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can delete entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
  );

-- ✅ 2. CLIENTS - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
CREATE POLICY "Platform super_admin can see all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
CREATE POLICY "Platform super_admin can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
CREATE POLICY "Platform super_admin can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;
CREATE POLICY "Platform super_admin can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 3. FACTURES - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
CREATE POLICY "Platform super_admin can see all factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
CREATE POLICY "Platform super_admin can create factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
CREATE POLICY "Platform super_admin can update factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;
CREATE POLICY "Platform super_admin can delete factures"
  ON factures FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 4. ABONNEMENTS - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can see all abonnements"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can create abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can create abonnements"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can update abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can update abonnements"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform super_admin can delete abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can delete abonnements"
  ON abonnements FOR DELETE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
  );

-- ✅ 5. PAIEMENTS - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all paiements" ON paiements;
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

-- ✅ 6. ESPACES_MEMBRES_CLIENTS - Utiliser auth.jwt() dans les policies
DROP POLICY IF EXISTS "Platform super_admin can see all espaces_membres_clients" ON espaces_membres_clients;
CREATE POLICY "Platform super_admin can see all espaces_membres_clients"
  ON espaces_membres_clients FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR user_id = auth.uid()
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

COMMENT ON FUNCTION public.is_platform_super_admin_jwt() IS 
'Utilise auth.jwt() pour vérifier le rôle super_admin PLATEFORME.
Utilisable dans les RLS policies car n''accède pas à auth.users.';

