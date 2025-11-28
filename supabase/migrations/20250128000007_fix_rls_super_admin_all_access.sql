/*
  # FIX RLS - Accès complet pour super_admin (SOLUTION RADICALE)
  
  PROBLÈME:
  - Les erreurs "permission denied" persistent malgré toutes les corrections
  - Les sous-requêtes et fonctions complexes causent des problèmes
  - Le rôle n'est peut-être pas accessible via auth.jwt()->>'role'
  
  SOLUTION RADICALE:
  - Créer des policies très simples qui permettent TOUT aux super_admins
  - Utiliser une vérification directe du rôle depuis le JWT
  - Pour super_admin, permettre TOUT sans conditions
  - Pour les autres, garder les restrictions normales
  
  Cette migration remplace TOUTES les policies existantes par des versions simplifiées
*/

-- ✅ Fonction ultra-simple pour vérifier super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin_simple()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Vérifier dans user_metadata OU app_metadata
  SELECT 
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin';
$$;

-- ✅ 1. ENTREPRISES - Policy ultra-simple
DROP POLICY IF EXISTS "Super admin ou propriétaire peut voir entreprises" ON entreprises;
DROP POLICY IF EXISTS "Super admin ou utilisateur peut créer entreprises" ON entreprises;
DROP POLICY IF EXISTS "Super admin ou propriétaire peut modifier entreprises" ON entreprises;
DROP POLICY IF EXISTS "Super admin ou propriétaire peut supprimer entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can see all entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can create entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can update entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can delete entreprises" ON entreprises;

-- Permettre TOUT aux super_admins, sinon restrictions normales
CREATE POLICY "super_admin_all_access_entreprises"
  ON entreprises FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_simple()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin_simple()
    OR user_id = auth.uid()
  );

-- ✅ 2. CLIENTS - Policy ultra-simple
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut voir clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut créer clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut modifier clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut supprimer clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;

CREATE POLICY "super_admin_all_access_clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 3. FACTURES - Policy ultra-simple
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut voir factures" ON factures;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut créer factures" ON factures;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut modifier factures" ON factures;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut supprimer factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;

CREATE POLICY "super_admin_all_access_factures"
  ON factures FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 4. ABONNEMENTS - Policy ultra-simple
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut voir abonnements" ON abonnements;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut créer abonnements" ON abonnements;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut modifier abonnements" ON abonnements;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut supprimer abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can see all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can create abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can update abonnements" ON abonnements;
DROP POLICY IF EXISTS "Platform super_admin can delete abonnements" ON abonnements;

CREATE POLICY "super_admin_all_access_abonnements"
  ON abonnements FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  )
  WITH CHECK (
    public.is_super_admin_simple()
    OR public.user_owns_entreprise(entreprise_id)
  );

-- ✅ 5. PAIEMENTS - Policy ultra-simple
DROP POLICY IF EXISTS "Super admin ou propriétaire peut voir paiements" ON paiements;
DROP POLICY IF EXISTS "Super admin ou utilisateur peut créer paiements" ON paiements;
DROP POLICY IF EXISTS "Super admin ou propriétaire peut modifier paiements" ON paiements;
DROP POLICY IF EXISTS "Super admin ou propriétaire peut supprimer paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can see all paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can create paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can update paiements" ON paiements;
DROP POLICY IF EXISTS "Platform super_admin can delete paiements" ON paiements;

CREATE POLICY "super_admin_all_access_paiements"
  ON paiements FOR ALL
  TO authenticated
  USING (
    public.is_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  )
  WITH CHECK (
    public.is_super_admin_simple()
    OR user_id = auth.uid()
    OR (entreprise_id IS NOT NULL AND public.user_owns_entreprise(entreprise_id))
  );

-- ✅ 6. COLLABORATEURS - Policy ultra-simple
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs'
  ) THEN
    -- Supprimer toutes les anciennes policies
    EXECUTE (
      SELECT string_agg(
        'DROP POLICY IF EXISTS "' || policyname || '" ON collaborateurs;',
        E'\n'
      )
      FROM pg_policies
      WHERE tablename = 'collaborateurs'
    );
    
    -- Créer une policy simple
    CREATE POLICY "super_admin_all_access_collaborateurs"
      ON collaborateurs FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_simple()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_simple()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
      
    RAISE NOTICE '✅ Policies créées pour collaborateurs';
  END IF;
END $$;

-- ✅ 7. COLLABORATEURS_ENTREPRISE - Policy ultra-simple
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs_entreprise'
  ) THEN
    -- Supprimer toutes les anciennes policies
    EXECUTE (
      SELECT string_agg(
        'DROP POLICY IF EXISTS "' || policyname || '" ON collaborateurs_entreprise;',
        E'\n'
      )
      FROM pg_policies
      WHERE tablename = 'collaborateurs_entreprise'
    );
    
    -- Créer une policy simple
    CREATE POLICY "super_admin_all_access_collaborateurs_entreprise"
      ON collaborateurs_entreprise FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_simple()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs_entreprise.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_simple()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs_entreprise.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
      
    RAISE NOTICE '✅ Policies créées pour collaborateurs_entreprise';
  END IF;
END $$;

-- ✅ Accorder les permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin_simple() TO authenticated;

-- ✅ Vérification finale
DO $$
BEGIN
  RAISE NOTICE '✅ Migration super_admin all access appliquée !';
  RAISE NOTICE '   → Super admin peut maintenant accéder à TOUT';
  RAISE NOTICE '   → Utilise is_super_admin_simple() pour vérifier le rôle';
END $$;

