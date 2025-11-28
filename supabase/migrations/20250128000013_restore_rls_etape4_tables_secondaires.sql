/*
  # RESTAURER LES RLS PROGRESSIVEMENT - ÉTAPE 4
  
  ÉTAPE 4: Tables secondaires et factures
  
  TABLES:
  - avoirs
  - facture_lignes
  - relances_mra
  - plans_abonnement (lecture pour tous)
  - options_supplementaires (lecture pour tous)
  - autres tables liées
*/

-- ✅ Fonction helper pour supprimer toutes les policies
CREATE OR REPLACE FUNCTION drop_all_policies(table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = drop_all_policies.table_name
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 
      policy_record.policyname, 
      drop_all_policies.table_name
    );
  END LOOP;
END;
$$;

-- ✅ 17. AVOIRS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'avoirs'
  ) THEN
    PERFORM drop_all_policies('avoirs');
    
    CREATE POLICY "super_admin_or_owner_avoirs"
      ON avoirs FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour avoirs';
  END IF;
END $$;

-- ✅ 18. FACTURE_LIGNES
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'facture_lignes'
  ) THEN
    PERFORM drop_all_policies('facture_lignes');
    
    CREATE POLICY "super_admin_or_owner_facture_lignes"
      ON facture_lignes FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour facture_lignes';
  END IF;
END $$;

-- ✅ 19. RELANCES_MRA
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'relances_mra'
  ) THEN
    PERFORM drop_all_policies('relances_mra');
    
    CREATE POLICY "super_admin_or_owner_relances_mra"
      ON relances_mra FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR facture_id IN (
          SELECT id FROM factures WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour relances_mra';
  END IF;
END $$;

-- ✅ 20. PLANS_ABONNEMENT (lecture pour tous, modification pour super_admin)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'plans_abonnement'
  ) THEN
    PERFORM drop_all_policies('plans_abonnement');
    
    -- Lecture pour tous les authentifiés
    CREATE POLICY "all_authenticated_read_plans"
      ON plans_abonnement FOR SELECT
      TO authenticated
      USING (true);
    
    -- Modification uniquement pour super_admin
    CREATE POLICY "super_admin_modify_plans"
      ON plans_abonnement FOR ALL
      TO authenticated
      USING (public.is_super_admin_check())
      WITH CHECK (public.is_super_admin_check());
    
    RAISE NOTICE '✅ RLS restaurée pour plans_abonnement';
  END IF;
END $$;

-- ✅ 21. OPTIONS_SUPPLEMENTAIRES (lecture pour tous, modification pour super_admin)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'options_supplementaires'
  ) THEN
    PERFORM drop_all_policies('options_supplementaires');
    
    -- Lecture pour tous les authentifiés
    CREATE POLICY "all_authenticated_read_options"
      ON options_supplementaires FOR SELECT
      TO authenticated
      USING (true);
    
    -- Modification uniquement pour super_admin
    CREATE POLICY "super_admin_modify_options"
      ON options_supplementaires FOR ALL
      TO authenticated
      USING (public.is_super_admin_check())
      WITH CHECK (public.is_super_admin_check());
    
    RAISE NOTICE '✅ RLS restaurée pour options_supplementaires';
  END IF;
END $$;

-- Nettoyer
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ✅ Message final
DO $$
BEGIN
  RAISE NOTICE '✅ ÉTAPE 4 TERMINÉE: RLS restaurées pour tables secondaires';
  RAISE NOTICE '   → avoirs, facture_lignes, relances_mra';
  RAISE NOTICE '   → plans_abonnement, options_supplementaires';
  RAISE NOTICE '   → Testez maintenant avant de continuer';
END $$;

