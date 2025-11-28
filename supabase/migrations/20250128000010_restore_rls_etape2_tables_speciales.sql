/*
  # RESTAURER LES RLS PROGRESSIVEMENT - ÉTAPE 2
  
  ÉTAPE 2: Tables spéciales (utilisateurs, espaces_membres_clients, collaborateurs)
  
  CORRECTIONS:
  - Ajouter RLS pour la table 'utilisateurs' (erreur 403)
  - Vérifier et ajouter RLS pour 'collaborateurs_entreprise' (erreur 404)
  - Ajouter RLS pour espaces_membres_clients
*/

-- Fonction helper pour supprimer toutes les policies (si pas déjà créée)
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

-- ✅ 6. UTILISATEURS - Ajouter RLS simplifiée (corrige l'erreur 403)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'utilisateurs'
  ) THEN
    -- Activer RLS
    ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
    
    -- Supprimer TOUTES les anciennes policies (elles utilisent auth.users)
    PERFORM drop_all_policies('utilisateurs');
    
    -- Créer une policy simple: super admin voit tout, utilisateurs voient leur propre profil
    CREATE POLICY "super_admin_or_self_utilisateurs"
      ON utilisateurs FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR id = auth.uid()
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR id = auth.uid()
      );
    
    RAISE NOTICE '✅ RLS simplifiée ajoutée pour utilisateurs';
  ELSE
    RAISE NOTICE '⚠️  Table utilisateurs n''existe pas';
  END IF;
END $$;

-- ✅ 7. ESPACES_MEMBRES_CLIENTS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'espaces_membres_clients'
  ) THEN
    DROP POLICY IF EXISTS "temp_allow_all_espaces_membres" ON espaces_membres_clients;
    
    CREATE POLICY "super_admin_or_self_espaces_membres"
      ON espaces_membres_clients FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR user_id = auth.uid()
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR user_id = auth.uid()
      );
    
    RAISE NOTICE '✅ RLS restaurée pour espaces_membres_clients';
  END IF;
END $$;

-- ✅ 8. COLLABORATEURS (table simple)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs'
  ) THEN
    DROP POLICY IF EXISTS "temp_allow_all_collaborateurs" ON collaborateurs;
    
    CREATE POLICY "super_admin_or_owner_collaborateurs"
      ON collaborateurs FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour collaborateurs';
  END IF;
END $$;

-- ✅ 9. COLLABORATEURS_ENTREPRISE - Vérifier et corriger (erreur 404)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs_entreprise'
  ) THEN
    DROP POLICY IF EXISTS "temp_allow_all_collaborateurs_entreprise" ON collaborateurs_entreprise;
    
    CREATE POLICY "super_admin_or_owner_collaborateurs_entreprise"
      ON collaborateurs_entreprise FOR ALL
      TO authenticated
      USING (
        public.is_super_admin_check()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs_entreprise.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_super_admin_check()
        OR EXISTS (
          SELECT 1 FROM entreprises 
          WHERE entreprises.id = collaborateurs_entreprise.entreprise_id 
          AND entreprises.user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS restaurée pour collaborateurs_entreprise';
  ELSE
    RAISE NOTICE '⚠️  Table collaborateurs_entreprise n''existe pas !';
    RAISE NOTICE '   → Vérifier le nom exact de la table dans la base';
  END IF;
END $$;

-- Nettoyer la fonction helper
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ✅ Message de fin
DO $$
BEGIN
  RAISE NOTICE '✅ ÉTAPE 2 TERMINÉE: RLS restaurées pour tables spéciales';
  RAISE NOTICE '   → utilisateurs (corrige erreur 403)';
  RAISE NOTICE '   → espaces_membres_clients';
  RAISE NOTICE '   → collaborateurs';
  RAISE NOTICE '   → collaborateurs_entreprise (corrige erreur 404 si table existe)';
  RAISE NOTICE '   → Testez maintenant avant de continuer';
END $$;

