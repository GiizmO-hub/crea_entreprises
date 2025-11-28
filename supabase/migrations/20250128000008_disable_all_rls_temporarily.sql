/*
  # DÉSACTIVER TEMPORAIREMENT TOUTES LES RESTRICTIONS RLS
  
  OBJECTIF:
  - Supprimer TOUTES les policies RLS pour tester si c'est bien un problème de permissions
  - Permettre à TOUS les utilisateurs authentifiés d'accéder à TOUT
  - Si ça fonctionne, on saura que le problème vient des RLS policies
  
  ⚠️  ATTENTION: Cette migration supprime TOUTES les restrictions de sécurité
  C'est uniquement pour le diagnostic. À ne PAS utiliser en production !
*/

-- ✅ Fonction helper pour supprimer toutes les policies d'une table
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

-- ✅ 1. ENTREPRISES - Permettre TOUT à tous les authentifiés
SELECT drop_all_policies('entreprises');
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_entreprises"
  ON entreprises FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ✅ 2. CLIENTS - Permettre TOUT à tous les authentifiés
SELECT drop_all_policies('clients');
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_clients"
  ON clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ✅ 3. FACTURES - Permettre TOUT à tous les authentifiés
SELECT drop_all_policies('factures');
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_factures"
  ON factures FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ✅ 4. ABONNEMENTS - Permettre TOUT à tous les authentifiés
SELECT drop_all_policies('abonnements');
ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_abonnements"
  ON abonnements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ✅ 5. PAIEMENTS - Permettre TOUT à tous les authentifiés
SELECT drop_all_policies('paiements');
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_paiements"
  ON paiements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ✅ 6. ESPACES_MEMBRES_CLIENTS - Permettre TOUT si la table existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'espaces_membres_clients'
  ) THEN
    PERFORM drop_all_policies('espaces_membres_clients');
    ALTER TABLE espaces_membres_clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "temp_allow_all_espaces_membres"
      ON espaces_membres_clients FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ✅ 7. COLLABORATEURS - Permettre TOUT si la table existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs'
  ) THEN
    PERFORM drop_all_policies('collaborateurs');
    ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "temp_allow_all_collaborateurs"
      ON collaborateurs FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ✅ 8. COLLABORATEURS_ENTREPRISE - Permettre TOUT si la table existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collaborateurs_entreprise'
  ) THEN
    PERFORM drop_all_policies('collaborateurs_entreprise');
    ALTER TABLE collaborateurs_entreprise ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "temp_allow_all_collaborateurs_entreprise"
      ON collaborateurs_entreprise FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ✅ 9. DOCUMENTS - Permettre TOUT si la table existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    PERFORM drop_all_policies('documents');
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "temp_allow_all_documents"
      ON documents FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ✅ 10. DOCUMENT_FOLDERS - Permettre TOUT si la table existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'document_folders'
  ) THEN
    PERFORM drop_all_policies('document_folders');
    ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "temp_allow_all_document_folders"
      ON document_folders FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ✅ Nettoyer la fonction helper
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ✅ Message final
DO $$
BEGIN
  RAISE NOTICE '⚠️  ATTENTION: TOUTES LES RESTRICTIONS RLS ONT ÉTÉ SUPPRIMÉES !';
  RAISE NOTICE '   → Tous les utilisateurs authentifiés peuvent maintenant accéder à TOUT';
  RAISE NOTICE '   → C''est uniquement pour le diagnostic';
  RAISE NOTICE '   → Ne PAS utiliser en production !';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Si les données s''affichent maintenant, le problème vient des RLS policies';
  RAISE NOTICE '✅ On pourra remettre les restrictions progressivement ensuite';
END $$;
