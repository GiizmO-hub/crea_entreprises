/*
  # FIX FINAL - Table utilisateurs RLS
  
  PROBLÈME:
  - Erreur 403 persiste sur la table utilisateurs
  - Les anciennes policies utilisent EXISTS avec auth.users qui cause des erreurs
  
  SOLUTION:
  - Supprimer TOUTES les anciennes policies (elles utilisent auth.users)
  - Créer une policy ultra-simple qui utilise uniquement auth.jwt()
  - Permettre au super_admin de tout voir via le JWT uniquement
*/

-- ✅ Supprimer TOUTES les policies existantes sur utilisateurs
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'utilisateurs'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON utilisateurs', policy_record.policyname);
  END LOOP;
  
  RAISE NOTICE '✅ Toutes les anciennes policies supprimées';
END $$;

-- ✅ S'assurer que RLS est activé
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

-- ✅ Policy ultra-simple : Super admin voit TOUT, utilisateurs voient leur propre profil
CREATE POLICY "simple_utilisateurs_all"
  ON utilisateurs FOR ALL
  TO authenticated
  USING (
    -- Super admin via JWT
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    -- Ou utilisateur voit son propre profil
    OR id = auth.uid()
  )
  WITH CHECK (
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR id = auth.uid()
  );

-- ✅ Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Policy ultra-simple créée pour utilisateurs';
  RAISE NOTICE '   → Super admin voit TOUT (via JWT uniquement)';
  RAISE NOTICE '   → Utilisateurs voient leur propre profil';
  RAISE NOTICE '   → Plus d''accès à auth.users';
END $$;

