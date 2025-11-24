/*
  # Consolidation et nettoyage : Administrateur principal de la plateforme
  
  OBJECTIF:
  - Nettoyer toutes les adresses email hardcodées sauf meddecyril@icloud.com
  - S'assurer que meddecyril@icloud.com est le SEUL administrateur principal
  - Séparer clairement les rôles PLATEFORME et CLIENTS
  - Donner les droits maximaux à l'administrateur principal
  
  ACTIONS:
  1. Supprimer les configurations des autres emails (cyrilmedde@icloud.com, roellingercyril@gmail.com, etc.)
  2. Configurer meddecyril@icloud.com comme super admin PLATEFORME unique
  3. S'assurer qu'il n'a pas d'espace membre client (critère super admin PLATEFORME)
  4. Nettoyer toutes les références aux anciens emails
*/

-- ============================================================================
-- PARTIE 1 : Nettoyer les anciennes configurations d'emails
-- ============================================================================

-- Supprimer les rôles super_admin des anciens emails (sauf meddecyril@icloud.com)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"client"'::jsonb
)
WHERE email IN ('cyrilmedde@icloud.com', 'roellingercyril@gmail.com')
AND email != 'meddecyril@icloud.com';

-- Supprimer les entrées dans utilisateurs pour les anciens emails (sauf meddecyril@icloud.com)
DELETE FROM utilisateurs
WHERE email IN ('cyrilmedde@icloud.com', 'roellingercyril@gmail.com')
AND email != 'meddecyril@icloud.com';

-- S'assurer qu'aucun ancien email n'a d'espace membre client avec super_admin
UPDATE espaces_membres_clients
SET modules_actifs = jsonb_set(
  COALESCE(modules_actifs, '{}'::jsonb),
  '{role}',
  '"client"'::jsonb
)
WHERE EXISTS (
  SELECT 1 FROM auth.users
  WHERE auth.users.id = espaces_membres_clients.user_id
  AND auth.users.email IN ('cyrilmedde@icloud.com', 'roellingercyril@gmail.com')
  AND auth.users.email != 'meddecyril@icloud.com'
);

-- ============================================================================
-- PARTIE 2 : Configurer meddecyril@icloud.com comme super admin PLATEFORME unique
-- ============================================================================

-- S'assurer que meddecyril@icloud.com n'a PAS d'espace membre client
-- (Un super admin PLATEFORME ne doit JAMAIS avoir d'espace membre client)
DELETE FROM espaces_membres_clients
WHERE EXISTS (
  SELECT 1 FROM auth.users
  WHERE auth.users.id = espaces_membres_clients.user_id
  AND auth.users.email = 'meddecyril@icloud.com'
);

-- Supprimer les références client pour meddecyril@icloud.com
DELETE FROM clients
WHERE email = 'meddecyril@icloud.com';

-- Mettre à jour auth.users pour que meddecyril@icloud.com soit super_admin PLATEFORME
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'::jsonb
),
raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'::jsonb
)
WHERE email = 'meddecyril@icloud.com';

-- S'assurer que l'entrée existe dans utilisateurs avec le rôle super_admin
INSERT INTO utilisateurs (id, email, role, nom, prenom, created_at, updated_at)
SELECT 
  id,
  email,
  'super_admin'::text,
  COALESCE(raw_user_meta_data->>'nom', 'Admin'),
  COALESCE(raw_user_meta_data->>'prenom', 'Plateforme'),
  created_at,
  updated_at
FROM auth.users
WHERE email = 'meddecyril@icloud.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  email = EXCLUDED.email,
  nom = COALESCE(EXCLUDED.nom, utilisateurs.nom),
  prenom = COALESCE(EXCLUDED.prenom, utilisateurs.prenom),
  updated_at = now();

-- ============================================================================
-- PARTIE 3 : Fonction pour vérifier si un user est super admin PLATEFORME
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_platform_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Si pas d'user_id, retourner false
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- CRITÈRE ABSOLU : Un super admin PLATEFORME n'a JAMAIS d'espace membre client
  -- Si l'utilisateur a un espace membre client, c'est un CLIENT, pas un super admin plateforme
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = p_user_id
  ) THEN
    RETURN false; -- C'est un client, donc pas super admin plateforme
  END IF;
  
  -- Vérifier le rôle dans auth.users (doit être 'super_admin', pas 'client_super_admin')
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND (raw_user_meta_data->>'role')::text = 'super_admin'
  ) THEN
    -- Vérifier aussi dans utilisateurs pour confirmer (pas 'client_super_admin')
    IF NOT EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = p_user_id
      AND role = 'client_super_admin'
    ) THEN
      RETURN true; -- C'est un super admin PLATEFORME
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION is_user_platform_super_admin(uuid) IS 'Vérifie si un user_id est super_admin PLATEFORME. Un super admin PLATEFORME n''a JAMAIS d''espace membre client et a le rôle ''super_admin'' (pas ''client_super_admin'').';

GRANT EXECUTE ON FUNCTION is_user_platform_super_admin(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Fonction pour vérifier l'utilisateur connecté
-- ============================================================================

CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Utiliser la fonction helper
  RETURN is_user_platform_super_admin(auth.uid());
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin() IS 'Vérifie si l''utilisateur connecté est super_admin PLATEFORME (pas client).';

GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated;

-- ============================================================================
-- PARTIE 5 : Vérifier et logger la configuration
-- ============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_admin_email text;
  v_admin_role text;
  v_has_client_space boolean;
BEGIN
  -- Vérifier que meddecyril@icloud.com existe et est configuré
  SELECT id, email, (raw_user_meta_data->>'role')::text INTO v_admin_id, v_admin_email, v_admin_role
  FROM auth.users
  WHERE email = 'meddecyril@icloud.com'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE NOTICE '⚠️  Attention: meddecyril@icloud.com non trouvé dans auth.users';
    RETURN;
  END IF;
  
  -- Vérifier qu'il n'a pas d'espace membre client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = v_admin_id
  ) INTO v_has_client_space;
  
  IF v_has_client_space THEN
    RAISE NOTICE '⚠️  ATTENTION: meddecyril@icloud.com a un espace membre client ! Ceci est anormal pour un super admin PLATEFORME.';
  END IF;
  
  -- Afficher la configuration
  IF v_admin_role = 'super_admin' AND NOT v_has_client_space THEN
    RAISE NOTICE '✅ Super admin PLATEFORME configuré correctement: % (id: %) - Rôle: % - Pas d''espace membre client', 
      v_admin_email, v_admin_id, v_admin_role;
  ELSIF v_admin_role != 'super_admin' THEN
    RAISE NOTICE '⚠️  ATTENTION: meddecyril@icloud.com n''a pas le rôle super_admin. Rôle actuel: %', v_admin_role;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 6 : Créer une vue pour lister tous les super admins PLATEFORME
-- ============================================================================

CREATE OR REPLACE VIEW super_admins_plateforme AS
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'nom' as nom,
  u.raw_user_meta_data->>'prenom' as prenom,
  u.created_at,
  u.updated_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE user_id = u.id
    ) THEN false
    ELSE true
  END as est_plateforme_super_admin
FROM auth.users u
WHERE (u.raw_user_meta_data->>'role')::text = 'super_admin'
AND NOT EXISTS (
  SELECT 1 FROM espaces_membres_clients
  WHERE user_id = u.id
);

COMMENT ON VIEW super_admins_plateforme IS 'Liste tous les super admins PLATEFORME (pas les clients). Un super admin PLATEFORME n''a JAMAIS d''espace membre client.';

GRANT SELECT ON super_admins_plateforme TO authenticated;

-- ============================================================================
-- PARTIE 7 : Documentation des rôles
-- ============================================================================

/*
  DOCUMENTATION : SÉPARATION DES RÔLES
  
  ========================================
  SUPER ADMIN PLATEFORME
  ========================================
  - Email principal: meddecyril@icloud.com
  - Rôle dans auth.users: 'super_admin'
  - Rôle dans utilisateurs: 'super_admin'
  - CRITÈRE ABSOLU: N'a JAMAIS d'espace membre client
  - Droits:
    * Accès à TOUS les modules et fonctions
    * Peut supprimer TOUTES les entreprises (même les siennes)
    * Gère la plateforme, les clients, les modules
    * Droits maximaux sur toute la plateforme
  
  ========================================
  CLIENT SUPER ADMIN
  ========================================
  - Rôle dans auth.users: 'client_super_admin'
  - Rôle dans utilisateurs: 'client_super_admin'
  - CRITÈRE: A TOUJOURS un espace membre client
  - Droits:
    * Gère son espace client uniquement
    * Accès limité aux modules de son abonnement
    * Peut supprimer son entreprise
    * Pas d'accès aux modules admin plateforme
  
  ========================================
  CLIENT NORMAL
  ========================================
  - Rôle dans auth.users: 'client'
  - Rôle dans utilisateurs: 'client'
  - CRITÈRE: A un espace membre client
  - Droits:
    * Accès limité aux modules de son abonnement
    * Pas de gestion d'administration
*/

