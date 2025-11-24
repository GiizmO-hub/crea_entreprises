/*
  # Correction complète suppression auth.users
  
  PROBLÈME:
  - Les emails restent dans auth.users après suppression d'entreprise/client/collaborateur
  - Les triggers existants sont incomplets ou en conflit
  
  SOLUTION:
  - Supprimer tous les anciens triggers en conflit
  - Créer des triggers unifiés et complets pour supprimer auth.users
  - Gérer tous les cas : entreprise, client, collaborateur, espace membre
*/

-- ============================================================================
-- PARTIE 1 : Nettoyage - Supprimer tous les anciens triggers
-- ============================================================================

-- Supprimer tous les triggers de suppression existants
DROP TRIGGER IF EXISTS on_delete_client_user ON clients;
DROP TRIGGER IF EXISTS on_delete_entreprise_users ON entreprises;
DROP TRIGGER IF EXISTS trigger_delete_client_and_auth ON clients;
DROP TRIGGER IF EXISTS trigger_delete_client_auth ON clients;
DROP TRIGGER IF EXISTS trigger_delete_entreprise_auth ON entreprises;
DROP TRIGGER IF EXISTS trigger_delete_espace_auth ON espaces_membres_clients;
DROP TRIGGER IF EXISTS trigger_delete_espace_member ON espaces_membres_clients;
DROP TRIGGER IF EXISTS trigger_delete_auth_user_espace ON espaces_membres_clients;
DROP TRIGGER IF EXISTS trigger_delete_auth_user_client ON clients;
-- Supprimer toutes les anciennes fonctions
DROP FUNCTION IF EXISTS trigger_delete_client_user() CASCADE;
DROP FUNCTION IF EXISTS trigger_delete_entreprise_users() CASCADE;
DROP FUNCTION IF EXISTS delete_client_cascade_auth() CASCADE;
DROP FUNCTION IF EXISTS delete_entreprise_cascade_auth() CASCADE;
DROP FUNCTION IF EXISTS delete_espace_auth() CASCADE;
DROP FUNCTION IF EXISTS delete_espace_member_auth() CASCADE;
DROP FUNCTION IF EXISTS delete_auth_user_on_espace_delete() CASCADE;
DROP FUNCTION IF EXISTS delete_auth_user_on_client_delete() CASCADE;
DROP FUNCTION IF EXISTS trigger_delete_previsionnel_user() CASCADE;
DROP FUNCTION IF EXISTS delete_auth_user_by_email(text) CASCADE;

-- Supprimer trigger previsionnels si la table existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'previsionnels') THEN
    DROP TRIGGER IF EXISTS on_delete_previsionnel_user ON previsionnels;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Fonction helper pour supprimer auth.user par email
-- ============================================================================

-- Fonction pour supprimer un auth.user par email (tous types)
CREATE OR REPLACE FUNCTION delete_auth_user_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Chercher l'utilisateur avec cet email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  -- Si trouvé, supprimer
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
      RAISE NOTICE 'Auth user supprimé: % (ID: %)', p_email, v_user_id;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur suppression auth user %: %', p_email, SQLERRM;
    END;
  END IF;
END;
$$;

COMMENT ON FUNCTION delete_auth_user_by_email(text) IS 'Supprime un utilisateur auth.users par son email';

-- ============================================================================
-- PARTIE 3 : Fonction helper pour supprimer auth.user par user_id
-- ============================================================================

-- Fonction pour supprimer un auth.user par user_id
CREATE OR REPLACE FUNCTION delete_auth_user_by_id(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = p_user_id;
      RAISE NOTICE 'Auth user supprimé: ID %', p_user_id;
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur suppression auth user ID %: %', p_user_id, SQLERRM;
    END;
  END IF;
END;
$$;

COMMENT ON FUNCTION delete_auth_user_by_id(uuid) IS 'Supprime un utilisateur auth.users par son ID';

-- ============================================================================
-- PARTIE 4 : Trigger pour suppression ESPACE MEMBRE
-- ============================================================================

-- Fonction: Supprimer auth.user quand espace membre est supprimé
CREATE OR REPLACE FUNCTION trigger_delete_espace_membre_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Supprimer l'auth user si présent
  IF OLD.user_id IS NOT NULL THEN
    PERFORM delete_auth_user_by_id(OLD.user_id);
  END IF;
  
  -- Aussi supprimer par email si email existe
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM delete_auth_user_by_email(OLD.email);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger sur espaces_membres_clients
CREATE TRIGGER trigger_delete_espace_membre_auth
  AFTER DELETE ON espaces_membres_clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_delete_espace_membre_auth();

-- ============================================================================
-- PARTIE 5 : Trigger pour suppression CLIENT
-- ============================================================================

-- Fonction: Supprimer auth.user quand client est supprimé
CREATE OR REPLACE FUNCTION trigger_delete_client_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Méthode 1: Chercher via espaces_membres_clients (avant suppression par CASCADE)
  SELECT user_id INTO v_user_id
  FROM espaces_membres_clients
  WHERE client_id = OLD.id
  AND user_id IS NOT NULL
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    PERFORM delete_auth_user_by_id(v_user_id);
  END IF;
  
  -- Méthode 2: Supprimer par email du client (si email existe)
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM delete_auth_user_by_email(OLD.email);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger sur clients (AFTER pour laisser le CASCADE se terminer)
CREATE TRIGGER trigger_delete_client_auth
  AFTER DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_delete_client_auth();

-- ============================================================================
-- PARTIE 6 : Trigger pour suppression ENTREPRISE
-- ============================================================================

-- Fonction: Supprimer tous les auth.users liés quand entreprise est supprimée
CREATE OR REPLACE FUNCTION trigger_delete_entreprise_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_record RECORD;
  v_user_id uuid;
  v_espace_record RECORD;
BEGIN
  -- Pour chaque client de cette entreprise (qui sera supprimé par CASCADE)
  -- On doit récupérer les user_id AVANT la suppression
  FOR v_client_record IN 
    SELECT id, email FROM clients WHERE entreprise_id = OLD.id
  LOOP
    -- Supprimer les auth.users via les espaces membres
    FOR v_espace_record IN
      SELECT user_id, email 
      FROM espaces_membres_clients 
      WHERE client_id = v_client_record.id
      AND (user_id IS NOT NULL OR email IS NOT NULL)
    LOOP
      IF v_espace_record.user_id IS NOT NULL THEN
        PERFORM delete_auth_user_by_id(v_espace_record.user_id);
      END IF;
      IF v_espace_record.email IS NOT NULL AND v_espace_record.email != '' THEN
        PERFORM delete_auth_user_by_email(v_espace_record.email);
      END IF;
    END LOOP;
    
    -- Supprimer aussi par email du client
    IF v_client_record.email IS NOT NULL AND v_client_record.email != '' THEN
      PERFORM delete_auth_user_by_email(v_client_record.email);
    END IF;
  END LOOP;
  
  -- Supprimer l'email de l'entreprise aussi si elle en a un
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM delete_auth_user_by_email(OLD.email);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger sur entreprises (BEFORE pour récupérer les données avant CASCADE)
CREATE TRIGGER trigger_delete_entreprise_auth
  BEFORE DELETE ON entreprises
  FOR EACH ROW
  EXECUTE FUNCTION trigger_delete_entreprise_auth();

-- ============================================================================
-- PARTIE 7 : Trigger pour suppression COLLABORATEUR (collaborateurs_entreprise)
-- ============================================================================

-- Fonction: Supprimer auth.user quand collaborateur entreprise est supprimé
CREATE OR REPLACE FUNCTION trigger_delete_collaborateur_entreprise_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Supprimer l'auth user si présent
  IF OLD.user_id IS NOT NULL THEN
    PERFORM delete_auth_user_by_id(OLD.user_id);
  END IF;
  
  -- Supprimer aussi par email
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM delete_auth_user_by_email(OLD.email);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger sur collaborateurs_entreprise (si la table existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_delete_collaborateur_entreprise_auth ON collaborateurs_entreprise';
    
    EXECUTE '
    CREATE TRIGGER trigger_delete_collaborateur_entreprise_auth
      AFTER DELETE ON collaborateurs_entreprise
      FOR EACH ROW
      EXECUTE FUNCTION trigger_delete_collaborateur_entreprise_auth()';
    
    RAISE NOTICE 'Trigger créé pour table collaborateurs_entreprise';
  ELSE
    RAISE NOTICE 'Table collaborateurs_entreprise n''existe pas, trigger non créé';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 8 : Trigger pour suppression COLLABORATEUR ADMIN
-- ============================================================================

-- Fonction: Supprimer auth.user quand collaborateur admin est supprimé
CREATE OR REPLACE FUNCTION trigger_delete_collaborateur_admin_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Supprimer l'auth user si présent
  IF OLD.user_id IS NOT NULL THEN
    PERFORM delete_auth_user_by_id(OLD.user_id);
  END IF;
  
  -- Supprimer aussi par email
  IF OLD.email IS NOT NULL AND OLD.email != '' THEN
    PERFORM delete_auth_user_by_email(OLD.email);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger sur collaborateurs_admin (si la table existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_admin'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_delete_collaborateur_admin_auth ON collaborateurs_admin';
    
    EXECUTE '
    CREATE TRIGGER trigger_delete_collaborateur_admin_auth
      AFTER DELETE ON collaborateurs_admin
      FOR EACH ROW
      EXECUTE FUNCTION trigger_delete_collaborateur_admin_auth()';
    
    RAISE NOTICE 'Trigger créé pour table collaborateurs_admin';
  ELSE
    RAISE NOTICE 'Table collaborateurs_admin n''existe pas, trigger non créé';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 9 : Trigger pour suppression COLLABORATEUR (table collaborateurs)
-- ============================================================================

-- Fonction: Supprimer auth.user quand collaborateur est supprimé
CREATE OR REPLACE FUNCTION trigger_delete_collaborateur_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Supprimer l'auth user si présent
  IF OLD.user_id IS NOT NULL THEN
    PERFORM delete_auth_user_by_id(OLD.user_id);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Vérifier si la table collaborateurs existe et créer le trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'collaborateurs'
  ) THEN
    -- Supprimer l'ancien trigger si existe
    DROP TRIGGER IF EXISTS trigger_delete_collaborateur_auth ON collaborateurs;
    
    -- Créer le nouveau trigger
    EXECUTE '
    CREATE TRIGGER trigger_delete_collaborateur_auth
      AFTER DELETE ON collaborateurs
      FOR EACH ROW
      EXECUTE FUNCTION trigger_delete_collaborateur_auth()';
    
    RAISE NOTICE 'Trigger créé pour table collaborateurs';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 10 : Nettoyage des auth.users orphelins existants (OPTIONNEL)
-- ============================================================================
-- NOTE: Cette partie est commentée car elle peut causer des erreurs si certaines tables n'existent pas
-- Les triggers ci-dessus gèrent déjà la suppression automatique lors des suppressions futures
-- Pour nettoyer les orphelins existants, exécuter manuellement après vérification des tables
/*
-- Supprimer les auth.users qui n'ont plus de référence
-- À exécuter manuellement après vérification que toutes les tables existent
*/

-- ============================================================================
-- PARTIE 11 : Commentaires et documentation
-- ============================================================================

COMMENT ON FUNCTION delete_auth_user_by_email(text) IS 'Supprime un utilisateur auth.users par son email (utilisé dans les triggers de suppression)';
COMMENT ON FUNCTION delete_auth_user_by_id(uuid) IS 'Supprime un utilisateur auth.users par son ID (utilisé dans les triggers de suppression)';
COMMENT ON FUNCTION trigger_delete_espace_membre_auth() IS 'Trigger: Supprime auth.user quand un espace membre est supprimé';
COMMENT ON FUNCTION trigger_delete_client_auth() IS 'Trigger: Supprime auth.user quand un client est supprimé';
COMMENT ON FUNCTION trigger_delete_entreprise_auth() IS 'Trigger: Supprime tous les auth.users liés quand une entreprise est supprimée';
COMMENT ON FUNCTION trigger_delete_collaborateur_entreprise_auth() IS 'Trigger: Supprime auth.user quand un collaborateur entreprise est supprimé';
COMMENT ON FUNCTION trigger_delete_collaborateur_admin_auth() IS 'Trigger: Supprime auth.user quand un collaborateur admin est supprimé';
COMMENT ON FUNCTION trigger_delete_collaborateur_auth() IS 'Trigger: Supprime auth.user quand un collaborateur est supprimé';

