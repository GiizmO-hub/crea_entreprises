/*
  # Fix: Politiques RLS pour abonnements utilisent user_id au lieu de client_id
  
  PROBLÈME:
  - La table abonnements a une colonne `client_id` (pas `user_id`)
  - Les politiques RLS vérifient `user_id = auth.uid()`
  - Résultat: Les abonnements ne peuvent pas être lus/créés/modifiés
  
  SOLUTION:
  - Mettre à jour toutes les politiques RLS pour utiliser `client_id` au lieu de `user_id`
  - Ajouter une politique pour les super admins qui peuvent voir tous les abonnements
  - Permettre aux utilisateurs de voir les abonnements liés à leurs entreprises
*/

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Super admin can manage all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users can manage abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can delete abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Super admin can view all abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;
DROP POLICY IF EXISTS "Lecture abonnements" ON abonnements;
DROP POLICY IF EXISTS "Création abonnements" ON abonnements;
DROP POLICY IF EXISTS "Modification abonnements" ON abonnements;
DROP POLICY IF EXISTS "Suppression abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users and admins view abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users and admins insert abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users and admins update abonnements" ON abonnements;
DROP POLICY IF EXISTS "Users and admins delete abonnements" ON abonnements;
DROP POLICY IF EXISTS "Utilisateurs voient leurs abonnements" ON abonnements;
DROP POLICY IF EXISTS "Utilisateurs créent leurs abonnements" ON abonnements;
DROP POLICY IF EXISTS "Utilisateurs modifient leurs abonnements" ON abonnements;

-- ============================================================================
-- NOUVELLES POLITIQUES RLS CORRECTES
-- ============================================================================

-- 1. SELECT: Super admin voit tout, utilisateurs voient leurs abonnements ou ceux de leurs entreprises
CREATE POLICY "Users can view abonnements of their entreprises"
ON abonnements
FOR SELECT
TO authenticated
USING (
  -- Super admin peut tout voir
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR (raw_app_meta_data->>'role')::text IN ('super_admin', 'admin')
    )
  )
  OR
  -- Utilisateur peut voir ses propres abonnements (client_id = auth.uid())
  client_id = auth.uid()
  OR
  -- Utilisateur peut voir les abonnements de ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 2. INSERT: Super admin peut créer pour n'importe qui, utilisateurs peuvent créer pour leurs entreprises
CREATE POLICY "Users can insert abonnements for their entreprises"
ON abonnements
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admin peut créer pour n'importe qui
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR (raw_app_meta_data->>'role')::text IN ('super_admin', 'admin')
    )
  )
  OR
  -- Utilisateur peut créer pour ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 3. UPDATE: Super admin peut modifier tout, utilisateurs peuvent modifier ceux de leurs entreprises
CREATE POLICY "Users can update abonnements of their entreprises"
ON abonnements
FOR UPDATE
TO authenticated
USING (
  -- Super admin peut modifier tout
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR (raw_app_meta_data->>'role')::text IN ('super_admin', 'admin')
    )
  )
  OR
  -- Utilisateur peut modifier les abonnements de ses entreprises
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Mêmes conditions pour WITH CHECK
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR (raw_app_meta_data->>'role')::text IN ('super_admin', 'admin')
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM entreprises
    WHERE entreprises.id = abonnements.entreprise_id
    AND entreprises.user_id = auth.uid()
  )
);

-- 4. DELETE: Seul super admin peut supprimer
CREATE POLICY "Super admin can delete abonnements"
ON abonnements
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR (raw_app_meta_data->>'role')::text IN ('super_admin', 'admin')
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
  WHERE tablename = 'abonnements';
  
  IF policy_count > 0 THEN
    RAISE NOTICE '✅ % politiques RLS créées pour la table abonnements', policy_count;
  ELSE
    RAISE WARNING '⚠️  Aucune politique RLS trouvée après création';
  END IF;
END $$;

COMMENT ON POLICY "Users can view abonnements of their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de voir leurs propres abonnements ou ceux de leurs entreprises. Les super admins voient tout.';

COMMENT ON POLICY "Users can insert abonnements for their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de créer des abonnements pour leurs entreprises. Les super admins peuvent créer pour n''importe qui.';

COMMENT ON POLICY "Users can update abonnements of their entreprises" ON abonnements IS 
  'Permet aux utilisateurs de modifier les abonnements de leurs entreprises. Les super admins peuvent modifier tout.';

COMMENT ON POLICY "Super admin can delete abonnements" ON abonnements IS 
  'Seuls les super admins peuvent supprimer des abonnements.';


