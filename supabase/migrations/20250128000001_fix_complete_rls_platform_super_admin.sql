/*
  # FIX COMPLET RLS - Super Admin Plateforme
  
  Objectif: Permettre aux super_admins PLATEFORME (role = 'super_admin') 
  de voir TOUTES les données dans toutes les tables critiques.
  
  IMPORTANT: Distinction entre:
  - super_admin PLATEFORME (role = 'super_admin') → voit TOUT
  - client_super_admin (role = 'client_super_admin') → voit uniquement son espace client
  
  Tables concernées:
  - entreprises
  - clients
  - factures
  - abonnements
  - paiements
  - espaces_membres_clients
*/

-- ✅ 1. S'assurer que is_platform_super_admin() existe et fonctionne correctement
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- ✅ Vérifier UNIQUEMENT le rôle 'super_admin' (plateforme), PAS 'client_super_admin'
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE users.id = auth.uid()
    AND COALESCE((users.raw_user_meta_data->>'role')::text, '') = 'super_admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_platform_super_admin() IS 'Vérifie si l''utilisateur est super_admin PLATEFORME (role = super_admin). Ne retourne PAS true pour client_super_admin.';

-- ✅ 2. ENTREPRISES - Mettre à jour toutes les policies RLS
DROP POLICY IF EXISTS "Users can read entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can view entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can read own entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can see all entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can create entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can create entreprises"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin() OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can update own entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can update all entreprises"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    user_id = auth.uid()
  )
  WITH CHECK (
    public.is_platform_super_admin() OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete entreprises" ON entreprises;
DROP POLICY IF EXISTS "Users can delete own entreprises" ON entreprises;
CREATE POLICY "Platform super_admin can delete all entreprises"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    user_id = auth.uid()
  );

-- ✅ 3. CLIENTS - Mettre à jour toutes les policies RLS
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can view entreprise clients" ON clients;
CREATE POLICY "Platform super_admin can see all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can insert entreprise clients" ON clients;
CREATE POLICY "Platform super_admin can create all clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can update entreprise clients" ON clients;
CREATE POLICY "Platform super_admin can update all clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "Users can delete entreprise clients" ON clients;
CREATE POLICY "Platform super_admin can delete all clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ✅ 4. FACTURES - Mettre à jour toutes les policies RLS
DROP POLICY IF EXISTS "Users can view entreprise factures" ON factures;
DROP POLICY IF EXISTS "Users can view factures" ON factures;
CREATE POLICY "Platform super_admin can see all factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert entreprise factures" ON factures;
DROP POLICY IF EXISTS "Users can insert factures" ON factures;
CREATE POLICY "Platform super_admin can create all factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update entreprise factures" ON factures;
DROP POLICY IF EXISTS "Users can update factures" ON factures;
CREATE POLICY "Platform super_admin can update all factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete entreprise factures" ON factures;
DROP POLICY IF EXISTS "Users can delete factures" ON factures;
CREATE POLICY "Platform super_admin can delete all factures"
  ON factures FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = factures.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ✅ 5. ABONNEMENTS - Mettre à jour toutes les policies RLS
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can see all abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can see all abonnements"
  ON abonnements FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    ) OR
    -- Permettre aussi aux clients de voir leurs propres abonnements via client_id
    (
      abonnements.client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.client_id = abonnements.client_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can insert abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can create all abonnements"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can update abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can update all abonnements"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admin can delete abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users can delete abonnements" ON abonnements;
CREATE POLICY "Platform super_admin can delete all abonnements"
  ON abonnements FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = abonnements.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ✅ 6. PAIEMENTS - Mettre à jour toutes les policies RLS (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paiements') THEN
    DROP POLICY IF EXISTS "Platform super_admin can see all paiements" ON paiements;
    DROP POLICY IF EXISTS "Users can view paiements" ON paiements;
    EXECUTE 'CREATE POLICY "Platform super_admin can see all paiements"
      ON paiements FOR SELECT
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        EXISTS (
          SELECT 1 FROM entreprises
          WHERE entreprises.id = paiements.entreprise_id
          AND entreprises.user_id = auth.uid()
        )
      )';

    DROP POLICY IF EXISTS "Platform super_admin can create all paiements" ON paiements;
    DROP POLICY IF EXISTS "Users can insert paiements" ON paiements;
    EXECUTE 'CREATE POLICY "Platform super_admin can create all paiements"
      ON paiements FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_platform_super_admin() OR
        EXISTS (
          SELECT 1 FROM entreprises
          WHERE entreprises.id = paiements.entreprise_id
          AND entreprises.user_id = auth.uid()
        )
      )';

    DROP POLICY IF EXISTS "Platform super_admin can update all paiements" ON paiements;
    DROP POLICY IF EXISTS "Users can update paiements" ON paiements;
    EXECUTE 'CREATE POLICY "Platform super_admin can update all paiements"
      ON paiements FOR UPDATE
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        EXISTS (
          SELECT 1 FROM entreprises
          WHERE entreprises.id = paiements.entreprise_id
          AND entreprises.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_platform_super_admin() OR
        EXISTS (
          SELECT 1 FROM entreprises
          WHERE entreprises.id = paiements.entreprise_id
          AND entreprises.user_id = auth.uid()
        )
      )';

    DROP POLICY IF EXISTS "Platform super_admin can delete all paiements" ON paiements;
    DROP POLICY IF EXISTS "Users can delete paiements" ON paiements;
    EXECUTE 'CREATE POLICY "Platform super_admin can delete all paiements"
      ON paiements FOR DELETE
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        EXISTS (
          SELECT 1 FROM entreprises
          WHERE entreprises.id = paiements.entreprise_id
          AND entreprises.user_id = auth.uid()
        )
      )';
  END IF;
END $$;

-- ✅ 7. ESPACES_MEMBRES_CLIENTS - Permettre aux super_admins plateforme de voir tous les espaces
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'espaces_membres_clients') THEN
    DROP POLICY IF EXISTS "Platform super_admin can see all espaces membres" ON espaces_membres_clients;
    DROP POLICY IF EXISTS "Users can view espaces membres" ON espaces_membres_clients;
    EXECUTE 'CREATE POLICY "Platform super_admin can see all espaces membres"
      ON espaces_membres_clients FOR SELECT
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        user_id = auth.uid()
      )';

    DROP POLICY IF EXISTS "Platform super_admin can create all espaces membres" ON espaces_membres_clients;
    DROP POLICY IF EXISTS "Users can insert espaces membres" ON espaces_membres_clients;
    EXECUTE 'CREATE POLICY "Platform super_admin can create all espaces membres"
      ON espaces_membres_clients FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_platform_super_admin() OR
        user_id = auth.uid()
      )';

    DROP POLICY IF EXISTS "Platform super_admin can update all espaces membres" ON espaces_membres_clients;
    DROP POLICY IF EXISTS "Users can update espaces membres" ON espaces_membres_clients;
    EXECUTE 'CREATE POLICY "Platform super_admin can update all espaces membres"
      ON espaces_membres_clients FOR UPDATE
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        user_id = auth.uid()
      )
      WITH CHECK (
        public.is_platform_super_admin() OR
        user_id = auth.uid()
      )';

    DROP POLICY IF EXISTS "Platform super_admin can delete all espaces membres" ON espaces_membres_clients;
    DROP POLICY IF EXISTS "Users can delete espaces membres" ON espaces_membres_clients;
    EXECUTE 'CREATE POLICY "Platform super_admin can delete all espaces membres"
      ON espaces_membres_clients FOR DELETE
      TO authenticated
      USING (
        public.is_platform_super_admin() OR
        user_id = auth.uid()
      )';
  END IF;
END $$;

COMMENT ON FUNCTION public.is_platform_super_admin() IS 'Vérifie si l''utilisateur est super_admin PLATEFORME (role = super_admin). Distinction importante avec client_super_admin. Permet aux super_admins plateforme de voir TOUTES les données via les RLS policies.';

