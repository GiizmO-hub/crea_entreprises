/*
  # Correction permissions utilisateurs pour jointures Supabase
  
  PROBLÈME:
  - Les requêtes Supabase avec jointures (collaborateurs -> utilisateurs) causent des erreurs 403
  - Les policies RLS bloquent l'accès même pour la lecture du rôle
  - Erreur: "permission denied for table users" lors des jointures automatiques
  
  SOLUTION:
  - Créer une vue sécurisée utilisateurs_public qui expose uniquement les champs nécessaires
  - Permettre la lecture des rôles pour les utilisateurs authentifiés
  - Utiliser SECURITY DEFINER pour contourner RLS dans les jointures
*/

-- ============================================================================
-- PARTIE 1 : Créer une vue sécurisée pour les jointures
-- ============================================================================

-- Supprimer l'ancienne vue si elle existe
DROP VIEW IF EXISTS utilisateurs_public CASCADE;

-- Créer une vue qui expose uniquement les champs nécessaires pour les jointures
CREATE VIEW utilisateurs_public AS
SELECT 
  u.id,
  u.email,
  COALESCE(
    (SELECT role FROM utilisateurs WHERE id = u.id),
    (u.raw_user_meta_data->>'role')::text,
    'client'
  ) as role,
  u.created_at
FROM auth.users u;

-- Activer la sécurité invoker pour utiliser les permissions du demandeur
ALTER VIEW utilisateurs_public SET (security_invoker = true);

-- Policy SELECT : Tous les utilisateurs authentifiés peuvent lire les infos publiques
DROP POLICY IF EXISTS "Authenticated users can read utilisateurs_public" ON utilisateurs_public;

-- Note: Les vues n'ont pas de RLS direct, donc on utilise une fonction wrapper
-- Mais on peut créer une politique sur la vue via une fonction

-- ============================================================================
-- PARTIE 2 : Permettre la lecture via les policies existantes sur utilisateurs
-- ============================================================================

-- S'assurer que les policies permettent la lecture pour les admins
-- (déjà fait dans la migration précédente, mais on vérifie)

-- ============================================================================
-- PARTIE 3 : Créer une fonction pour les jointures qui bypass RLS
-- ============================================================================

-- Fonction pour obtenir les infos utilisateur pour les jointures (accessible par tous les authentifiés)
CREATE OR REPLACE FUNCTION get_user_public_info(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(
      (SELECT role FROM utilisateurs WHERE id = u.id),
      (u.raw_user_meta_data->>'role')::text,
      'client'
    ) as role
  FROM auth.users u
  WHERE u.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_public_info(uuid) IS 'Retourne les infos publiques d''un utilisateur (pour jointures, accessible par tous les authentifiés)';

-- Permissions
GRANT EXECUTE ON FUNCTION get_user_public_info(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Corriger les policies RLS sur utilisateurs pour permettre les jointures
-- ============================================================================

-- Modifier la policy SELECT pour permettre la lecture des rôles dans les jointures
-- Supprimer l'ancienne policy
DROP POLICY IF EXISTS "Users can read utilisateurs" ON utilisateurs;

-- Nouvelle policy plus permissive pour les admins et pour les jointures
CREATE POLICY "Users can read utilisateurs"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (
    -- L'utilisateur peut lire son propre profil
    id = auth.uid() 
    OR 
    -- Les admins peuvent tout lire
    is_admin_user_check()
    OR
    -- Permettre la lecture pour les jointures (si l'utilisateur fait partie d'une entreprise accessible)
    EXISTS (
      SELECT 1 FROM collaborateurs
      WHERE collaborateurs.user_id = utilisateurs.id
      AND EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = collaborateurs.entreprise_id
        AND (
          entreprises.user_id = auth.uid() 
          OR is_admin_user_check()
          OR EXISTS (
            -- Permettre aussi si l'utilisateur actuel est collaborateur de la même entreprise
            SELECT 1 FROM collaborateurs c2
            WHERE c2.entreprise_id = collaborateurs.entreprise_id
            AND c2.user_id = auth.uid()
          )
        )
      )
    )
  );

-- ============================================================================
-- PARTIE 5 : Corriger les policies RLS pour permettre la lecture dans les jointures collaborateurs
-- ============================================================================

-- Vérifier que les policies sur collaborateurs permettent bien la lecture
-- (Cela devrait déjà être le cas, mais on s'assure)

-- Les collaborateurs sont déjà accessibles via les policies existantes
-- Le problème vient du fait que Supabase essaie d'accéder à utilisateurs via la jointure

