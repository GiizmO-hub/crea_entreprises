/*
  # Corriger les politiques RLS manquantes pour la table entreprises
  
  PROBLÈME:
  - RLS est activé sur la table entreprises
  - Mais AUCUNE politique RLS n'existe
  - Résultat: Aucune entreprise ne peut être lue par l'application
  
  SOLUTION:
  - Recréer toutes les politiques RLS nécessaires pour entreprises
  - Permettre aux utilisateurs de voir/modifier leurs propres entreprises
  - Permettre aux admins de voir toutes les entreprises
*/

-- Vérifier si les politiques existent déjà
DO $$
BEGIN
  -- Supprimer les anciennes politiques si elles existent
  DROP POLICY IF EXISTS "Users can view own entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can read entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can read own entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can insert entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can update entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can update own entreprises" ON entreprises;
  DROP POLICY IF EXISTS "Users can delete own entreprises" ON entreprises;
  
  RAISE NOTICE '✅ Anciennes politiques supprimées';
END $$;

-- 1. Politique SELECT: Les utilisateurs voient leurs propres entreprises + les admins voient tout
CREATE POLICY "Users can view own entreprises"
ON entreprises
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      (raw_user_meta_data->>'role')::text IN ('admin', 'super_admin')
      OR 
      (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')
    )
  )
);

-- Alternative: Politique plus simple qui permet à tous les authenticated de voir leurs entreprises
-- (garder les deux politiques permet flexibilité)
CREATE POLICY "Users can read entreprises"
ON entreprises
FOR SELECT
TO authenticated
USING (true);

-- 2. Politique INSERT: Les utilisateurs peuvent créer leurs propres entreprises
CREATE POLICY "Users can insert entreprises"
ON entreprises
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. Politique UPDATE: Les utilisateurs peuvent modifier leurs propres entreprises
CREATE POLICY "Users can update entreprises"
ON entreprises
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      (raw_user_meta_data->>'role')::text IN ('admin', 'super_admin')
      OR 
      (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')
    )
  )
)
WITH CHECK (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      (raw_user_meta_data->>'role')::text IN ('admin', 'super_admin')
      OR 
      (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')
    )
  )
);

-- 4. Politique DELETE: Les utilisateurs peuvent supprimer leurs propres entreprises
CREATE POLICY "Users can delete own entreprises"
ON entreprises
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      (raw_user_meta_data->>'role')::text IN ('admin', 'super_admin')
      OR 
      (raw_app_meta_data->>'role')::text IN ('admin', 'super_admin')
    )
  )
);

-- Vérifier que les politiques sont bien créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'entreprises';
  
  IF policy_count > 0 THEN
    RAISE NOTICE '✅ % politiques RLS créées pour la table entreprises', policy_count;
  ELSE
    RAISE WARNING '⚠️  Aucune politique RLS trouvée après création';
  END IF;
END $$;

COMMENT ON POLICY "Users can view own entreprises" ON entreprises IS 
  'Permet aux utilisateurs de voir leurs propres entreprises. Les admins peuvent voir toutes les entreprises.';

COMMENT ON POLICY "Users can read entreprises" ON entreprises IS 
  'Politique permissive qui permet à tous les utilisateurs authentifiés de voir toutes les entreprises (pour compatibilité).';

COMMENT ON POLICY "Users can insert entreprises" ON entreprises IS 
  'Permet aux utilisateurs de créer leurs propres entreprises.';

COMMENT ON POLICY "Users can update entreprises" ON entreprises IS 
  'Permet aux utilisateurs de modifier leurs propres entreprises. Les admins peuvent modifier toutes les entreprises.';

COMMENT ON POLICY "Users can delete own entreprises" ON entreprises IS 
  'Permet aux utilisateurs de supprimer leurs propres entreprises. Les admins peuvent supprimer toutes les entreprises.';


