/*
  # RESTAURER LES RLS PROGRESSIVEMENT - ÉTAPE 3
  
  ÉTAPE 3: Tables documents et projets
  
  TABLES:
  - documents
  - document_folders
  - projets
  - projets_jalons
  - projets_taches
  - projets_documents
  - salaries (si existe)
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

-- ✅ 10. DOCUMENTS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    DROP POLICY IF EXISTS "temp_allow_all_documents" ON documents;
    PERFORM drop_all_policies('documents');
    
    CREATE POLICY "super_admin_or_owner_documents"
      ON documents FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour documents';
  END IF;
END $$;

-- ✅ 11. DOCUMENT_FOLDERS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'document_folders'
  ) THEN
    DROP POLICY IF EXISTS "temp_allow_all_document_folders" ON document_folders;
    PERFORM drop_all_policies('document_folders');
    
    CREATE POLICY "super_admin_or_owner_document_folders"
      ON document_folders FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour document_folders';
  END IF;
END $$;

-- ✅ 12. PROJETS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projets'
  ) THEN
    PERFORM drop_all_policies('projets');
    
    CREATE POLICY "super_admin_or_owner_projets"
      ON projets FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour projets';
  END IF;
END $$;

-- ✅ 13. PROJETS_JALONS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projets_jalons'
  ) THEN
    PERFORM drop_all_policies('projets_jalons');
    
    CREATE POLICY "super_admin_or_owner_projets_jalons"
      ON projets_jalons FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour projets_jalons';
  END IF;
END $$;

-- ✅ 14. PROJETS_TACHES
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projets_taches'
  ) THEN
    PERFORM drop_all_policies('projets_taches');
    
    CREATE POLICY "super_admin_or_owner_projets_taches"
      ON projets_taches FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour projets_taches';
  END IF;
END $$;

-- ✅ 15. PROJETS_DOCUMENTS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projets_documents'
  ) THEN
    PERFORM drop_all_policies('projets_documents');
    
    CREATE POLICY "super_admin_or_owner_projets_documents"
      ON projets_documents FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR projet_id IN (
          SELECT id FROM projets WHERE entreprise_id IN (
            SELECT id FROM entreprises WHERE user_id = auth.uid()
          )
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour projets_documents';
  END IF;
END $$;

-- ✅ 16. SALARIES
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'salaries'
  ) THEN
    PERFORM drop_all_policies('salaries');
    
    CREATE POLICY "super_admin_or_owner_salaries"
      ON salaries FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour salaries';
  END IF;
END $$;

-- Nettoyer
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ✅ Message final
DO $$
BEGIN
  RAISE NOTICE '✅ ÉTAPE 3 TERMINÉE: RLS restaurées pour documents et projets';
  RAISE NOTICE '   → documents, document_folders';
  RAISE NOTICE '   → projets, projets_jalons, projets_taches, projets_documents';
  RAISE NOTICE '   → salaries (si existe)';
  RAISE NOTICE '   → Testez maintenant avant de continuer';
END $$;

