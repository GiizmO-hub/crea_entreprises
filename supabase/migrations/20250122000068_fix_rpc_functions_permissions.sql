/*
  # Correction des fonctions RPC manquantes ou avec permissions incorrectes
  
  PROBLÈMES IDENTIFIÉS:
  1. is_platform_super_admin() n'existe pas ou n'est pas accessible
  2. get_client_super_admin_status() retourne erreur P0001 (permissions)
  
  SOLUTIONS:
  1. Créer/corriger is_platform_super_admin() avec SECURITY DEFINER
  2. Corriger get_client_super_admin_status() pour gérer les permissions correctement
  3. S'assurer que les fonctions sont exposées en RPC
*/

-- ============================================================================
-- PARTIE 1 : Créer/corriger is_platform_super_admin()
-- ============================================================================

-- Supprimer toutes les versions existantes (avec IF EXISTS pour éviter erreurs)
DO $$
BEGIN
  -- Supprimer toutes les signatures possibles
  DROP FUNCTION IF EXISTS is_platform_super_admin(uuid) CASCADE;
  DROP FUNCTION IF EXISTS is_platform_super_admin() CASCADE;
  DROP FUNCTION IF EXISTS is_platform_super_admin(text) CASCADE;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorer les erreurs si la fonction n'existe pas
    NULL;
END $$;

-- Créer la fonction avec paramètre optionnel
CREATE OR REPLACE FUNCTION is_platform_super_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  target_user_id uuid;
  user_role text;
BEGIN
  -- Si aucun user_id fourni, utiliser l'utilisateur connecté
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Si pas d'utilisateur, retourner false
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier si l'utilisateur est un client (a un espace membre)
  -- Si c'est un client, il n'est JAMAIS super_admin plateforme
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = target_user_id
  ) THEN
    RETURN false;
  END IF;
  
  -- Récupérer le rôle depuis utilisateurs ou auth.users
  SELECT COALESCE(
    (SELECT role FROM utilisateurs WHERE id = target_user_id),
    (SELECT (raw_user_meta_data->>'role')::text FROM auth.users WHERE id = target_user_id),
    ''
  ) INTO user_role;
  
  -- Retourner true seulement si c'est 'super_admin' (pas 'client_super_admin')
  RETURN user_role = 'super_admin';
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin(uuid) IS 'Vérifie si un utilisateur est super_admin de la plateforme (exclut les clients)';

-- ============================================================================
-- PARTIE 2 : Corriger get_client_super_admin_status()
-- ============================================================================

-- Supprimer l'ancienne version
DROP FUNCTION IF EXISTS get_client_super_admin_status(uuid) CASCADE;

-- Recréer avec gestion d'erreur améliorée
CREATE OR REPLACE FUNCTION get_client_super_admin_status(p_entreprise_id uuid)
RETURNS TABLE (
  client_id uuid,
  is_super_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  current_user_id uuid;
  is_platform_admin boolean;
BEGIN
  -- Récupérer l'utilisateur connecté
  current_user_id := auth.uid();
  
  -- Si pas d'utilisateur connecté, retourner vide
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Accès non autorisé - Utilisateur non connecté';
  END IF;
  
  -- Vérifier si l'utilisateur est super_admin plateforme
  is_platform_admin := is_platform_super_admin(current_user_id);
  
  -- Si ce n'est pas un super_admin plateforme, vérifier si c'est le propriétaire de l'entreprise
  IF NOT is_platform_admin THEN
    -- Vérifier si l'utilisateur est propriétaire de l'entreprise
    IF NOT EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = p_entreprise_id
      AND user_id = current_user_id
    ) THEN
      -- Ni super_admin, ni propriétaire : accès refusé
      RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
    END IF;
  END IF;
  
  -- Retourner les statuts super_admin des clients de l'entreprise
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    COALESCE(
      (SELECT role FROM utilisateurs WHERE id = c.id) = 'client_super_admin',
      false
    ) AS is_super_admin
  FROM clients c
  WHERE c.entreprise_id = p_entreprise_id
  AND c.email IS NOT NULL; -- Seulement les clients avec email (qui peuvent avoir un espace)
END;
$$;

COMMENT ON FUNCTION get_client_super_admin_status(uuid) IS 'Retourne le statut super_admin des clients d''une entreprise (accessible par super_admin plateforme ou propriétaire entreprise)';

-- ============================================================================
-- PARTIE 3 : S'assurer que les fonctions sont exposées en RPC
-- ============================================================================

-- Les fonctions avec SECURITY DEFINER sont automatiquement exposées en RPC
-- Vérifier que les permissions sont correctes
GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_super_admin_status(uuid) TO authenticated;

