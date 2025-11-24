/*
  # Correction récursion infinie dans policies RLS de collaborateurs
  
  PROBLÈME CRITIQUE:
  - Erreur "infinite recursion detected in policy for relation 'collaborateurs'"
  - Les policies RLS sur collaborateurs font référence à collaborateurs elle-même
  - Cela crée une boucle infinie lors des requêtes
  
  SOLUTION:
  - Corriger toutes les policies sur collaborateurs pour éviter la récursion
  - Utiliser uniquement auth.users ou entreprises pour les vérifications
  - Éviter toute référence à collaborateurs dans les policies de collaborateurs
*/

-- ============================================================================
-- PARTIE 1 : Vérifier si la table collaborateurs existe et ses policies
-- ============================================================================

-- Supprimer TOUTES les policies existantes sur collaborateurs (si la table existe)
DO $$
BEGIN
  -- Supprimer toutes les policies SELECT
  DROP POLICY IF EXISTS "Users can view collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Propriétaires voient collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Clients peuvent voir collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Admins can view collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Lecture collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Super admin voit tous les collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Utilisateur peut lire son propre profil" ON collaborateurs;
  DROP POLICY IF EXISTS "Collaborateurs SELECT policy" ON collaborateurs;
  
  -- Supprimer toutes les policies INSERT
  DROP POLICY IF EXISTS "Users can insert collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Admins can insert collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Propriétaires créent collaborateurs" ON collaborateurs;
  
  -- Supprimer toutes les policies UPDATE
  DROP POLICY IF EXISTS "Users can update collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Admins can update collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Propriétaires modifient collaborateurs" ON collaborateurs;
  
  -- Supprimer toutes les policies DELETE
  DROP POLICY IF EXISTS "Users can delete collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Admins can delete collaborateurs" ON collaborateurs;
  DROP POLICY IF EXISTS "Propriétaires suppriment collaborateurs" ON collaborateurs;
END $$;

-- ============================================================================
-- PARTIE 2 : Fonction helper pour vérifier si admin (sans récursion)
-- ============================================================================

-- Fonction pour vérifier si l'utilisateur est admin/super_admin (utilise uniquement auth.users)
CREATE OR REPLACE FUNCTION is_admin_user_simple()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Vérifier uniquement via auth.users.raw_user_meta_data (pas de récursion)
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user_simple() IS 'Vérifie si l''utilisateur est admin/super_admin (sans récursion, utilise uniquement auth.users)';

GRANT EXECUTE ON FUNCTION is_admin_user_simple() TO authenticated;

-- ============================================================================
-- PARTIE 3 : Recréer les policies sur collaborateurs SANS récursion
-- ============================================================================

-- Policy SELECT : Les utilisateurs peuvent voir les collaborateurs de leurs entreprises
-- OU les admins peuvent tout voir
CREATE POLICY "Users can view collaborateurs"
  ON collaborateurs
  FOR SELECT
  TO authenticated
  USING (
    -- Cas 1 : L'utilisateur est admin/super_admin (vérifié via auth.users uniquement)
    is_admin_user_simple()
    OR
    -- Cas 2 : L'utilisateur peut voir les collaborateurs de ses entreprises
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = collaborateurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    -- Cas 3 : L'utilisateur peut voir son propre profil de collaborateur
    collaborateurs.user_id = auth.uid()
  );

-- Policy INSERT : Les utilisateurs peuvent créer des collaborateurs pour leurs entreprises
CREATE POLICY "Users can insert collaborateurs"
  ON collaborateurs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Les admins peuvent créer n'importe où
    is_admin_user_simple()
    OR
    -- Les utilisateurs peuvent créer pour leurs entreprises
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = collaborateurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- Policy UPDATE : Les utilisateurs peuvent modifier les collaborateurs de leurs entreprises
CREATE POLICY "Users can update collaborateurs"
  ON collaborateurs
  FOR UPDATE
  TO authenticated
  USING (
    -- Les admins peuvent modifier n'importe quoi
    is_admin_user_simple()
    OR
    -- Les utilisateurs peuvent modifier les collaborateurs de leurs entreprises
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = collaborateurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    -- L'utilisateur peut modifier son propre profil
    collaborateurs.user_id = auth.uid()
  )
  WITH CHECK (
    -- Mêmes conditions pour WITH CHECK
    is_admin_user_simple()
    OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = collaborateurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    collaborateurs.user_id = auth.uid()
  );

-- Policy DELETE : Les utilisateurs peuvent supprimer les collaborateurs de leurs entreprises
CREATE POLICY "Users can delete collaborateurs"
  ON collaborateurs
  FOR DELETE
  TO authenticated
  USING (
    -- Les admins peuvent supprimer n'importe quoi
    is_admin_user_simple()
    OR
    -- Les utilisateurs peuvent supprimer les collaborateurs de leurs entreprises
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = collaborateurs.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PARTIE 4 : Vérifier que RLS est activé sur collaborateurs
-- ============================================================================

DO $$
BEGIN
  -- Activer RLS si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaborateurs') THEN
    ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

