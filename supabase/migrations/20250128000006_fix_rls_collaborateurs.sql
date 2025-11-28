/*
  # FIX RLS - Table collaborateurs
  
  PROBLÈME:
  - Erreur "permission denied for table users" sur la table collaborateurs
  - La table collaborateurs n'a peut-être pas de RLS policies correctes
  - Ou les policies utilisent encore des accès à auth.users
  
  SOLUTION:
  - Vérifier que la table existe
  - Créer des RLS policies simplifiées pour collaborateurs
  - Utiliser auth.jwt() directement
*/

-- ✅ Vérifier que la table existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    RAISE NOTICE '⚠️  Table collaborateurs_entreprise n''existe pas';
  ELSE
    RAISE NOTICE '✅ Table collaborateurs_entreprise existe';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'collaborateurs'
  ) THEN
    RAISE NOTICE '⚠️  Table collaborateurs n''existe pas';
  ELSE
    RAISE NOTICE '✅ Table collaborateurs existe';
  END IF;
END $$;

-- ✅ 1. COLLABORATEURS_ENTREPRISE - Créer des policies simplifiées
-- Vérifier d'abord si la table existe avant de créer les policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    -- Activer RLS si pas déjà activé
    ALTER TABLE collaborateurs_entreprise ENABLE ROW LEVEL SECURITY;
    
    -- Supprimer les anciennes policies
    DROP POLICY IF EXISTS "Users can view collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Users can insert collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Users can update collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Users can delete collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Platform super_admin can see all collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Platform super_admin can create collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Platform super_admin can update collaborateurs" ON collaborateurs_entreprise;
    DROP POLICY IF EXISTS "Platform super_admin can delete collaborateurs" ON collaborateurs_entreprise;
    
    -- SELECT
    CREATE POLICY "Super admin ou propriétaire peut voir collaborateurs"
      ON collaborateurs_entreprise FOR SELECT
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    -- INSERT
    CREATE POLICY "Super admin ou propriétaire peut créer collaborateurs"
      ON collaborateurs_entreprise FOR INSERT
      TO authenticated
      WITH CHECK (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    -- UPDATE
    CREATE POLICY "Super admin ou propriétaire peut modifier collaborateurs"
      ON collaborateurs_entreprise FOR UPDATE
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    -- DELETE
    CREATE POLICY "Super admin ou propriétaire peut supprimer collaborateurs"
      ON collaborateurs_entreprise FOR DELETE
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR entreprise_id IN (
          SELECT id FROM entreprises WHERE user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ Policies créées pour collaborateurs_entreprise';
  END IF;
END $$;

-- ✅ 2. COLLABORATEURS - Créer des policies simplifiées
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'collaborateurs'
  ) THEN
    -- Activer RLS si pas déjà activé
    ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
    
    -- Supprimer les anciennes policies
    DROP POLICY IF EXISTS "Users can view collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can insert collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can update collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can delete collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Platform super_admin can see all collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Platform super_admin can create collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Platform super_admin can update collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Platform super_admin can delete collaborateurs" ON collaborateurs;
    
    -- SELECT - Super admin voit tout, sinon voir selon entreprise_id
    CREATE POLICY "Super admin peut voir tous collaborateurs"
      ON collaborateurs FOR SELECT
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    -- INSERT
    CREATE POLICY "Super admin peut créer collaborateurs"
      ON collaborateurs FOR INSERT
      TO authenticated
      WITH CHECK (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    -- UPDATE
    CREATE POLICY "Super admin peut modifier collaborateurs"
      ON collaborateurs FOR UPDATE
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    -- DELETE
    CREATE POLICY "Super admin peut supprimer collaborateurs"
      ON collaborateurs FOR DELETE
      TO authenticated
      USING (
        COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ Policies créées pour collaborateurs';
  END IF;
END $$;

-- ✅ Vérification finale
DO $$
BEGIN
  RAISE NOTICE '✅ Migration RLS collaborateurs appliquée !';
END $$;

