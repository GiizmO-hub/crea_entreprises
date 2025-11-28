/*
  # Fix FINAL: Supprimer les triggers BEFORE DELETE problématiques
  
  PROBLÈME IDENTIFIÉ:
  - Erreur: "tuple to be deleted was already modified"
  - Cause: Triggers BEFORE DELETE qui modifient la ligne pendant la suppression
  - Solution: S'assurer que TOUS les triggers sont AFTER DELETE
  
  ACTIONS:
  1. Supprimer TOUS les triggers BEFORE DELETE sur entreprises, clients, espaces
  2. Recréer la fonction delete_entreprise_complete de manière ultra-simple
  3. Laisser CASCADE gérer tout automatiquement
*/

-- ============================================================
-- ÉTAPE 1: SUPPRIMER TOUS LES TRIGGERS BEFORE DELETE
-- ============================================================

-- Supprimer les triggers BEFORE DELETE sur entreprises
DROP TRIGGER IF EXISTS trigger_delete_entreprise_auth ON entreprises;
DROP TRIGGER IF EXISTS on_delete_entreprise_users ON entreprises;
DROP TRIGGER IF EXISTS trigger_delete_entreprise_cascade_auth ON entreprises;

-- Supprimer les triggers BEFORE DELETE sur clients
DROP TRIGGER IF EXISTS trigger_delete_auth_user_client ON clients;
DROP TRIGGER IF EXISTS trigger_delete_auth_user_client_before ON clients;
DROP TRIGGER IF EXISTS on_delete_client_user ON clients;

-- Supprimer les triggers BEFORE DELETE sur espaces_membres_clients
DROP TRIGGER IF EXISTS trigger_delete_auth_user_espace ON espaces_membres_clients;

-- ============================================================
-- ÉTAPE 2: CRÉER UNIQUEMENT DES TRIGGERS AFTER DELETE
-- ============================================================

-- Trigger AFTER DELETE sur espaces_membres_clients (pour supprimer auth.users)
CREATE OR REPLACE FUNCTION delete_espace_auth_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = OLD.user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorer si déjà supprimé
    END;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_delete_espace_auth_after ON espaces_membres_clients;
CREATE TRIGGER trigger_delete_espace_auth_after
  AFTER DELETE ON espaces_membres_clients
  FOR EACH ROW
  WHEN (OLD.user_id IS NOT NULL)
  EXECUTE FUNCTION delete_espace_auth_after();

-- Trigger AFTER DELETE sur clients (pour supprimer auth.users des espaces)
CREATE OR REPLACE FUNCTION delete_client_auth_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Les espaces ont déjà été supprimés par CASCADE
  -- On ne peut plus les récupérer ici
  -- Ce trigger est là au cas où, mais ne devrait pas être nécessaire
  -- car les espaces sont supprimés en premier par CASCADE
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_delete_client_auth_after ON clients;
CREATE TRIGGER trigger_delete_client_auth_after
  AFTER DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION delete_client_auth_after();

-- ============================================================
-- ÉTAPE 3: RECRÉER delete_entreprise_complete - VERSION ULTRA-SIMPLE
-- ============================================================

CREATE OR REPLACE FUNCTION delete_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clients_count integer := 0;
  v_espaces_count integer := 0;
  v_abonnements_count integer := 0;
  v_options_count integer := 0;
  v_is_super_admin boolean := false;
  v_is_owner boolean := false;
  v_is_admin boolean := false;
BEGIN
  -- Vérifier que l'entreprise existe
  IF NOT EXISTS(SELECT 1 FROM entreprises WHERE id = p_entreprise_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise non trouvée');
  END IF;
  
  -- Vérification des droits
  BEGIN
    SELECT check_is_super_admin() INTO v_is_super_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_super_admin := false;
  END;
  
  BEGIN
    SELECT is_admin_user_simple() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  
  SELECT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id AND user_id = auth.uid()
  ) INTO v_is_owner;
  
  IF NOT (v_is_super_admin OR v_is_admin OR v_is_owner) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  
  -- Compter AVANT suppression
  SELECT COUNT(*) INTO v_clients_count FROM clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_espaces_count FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_abonnements_count FROM abonnements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_options_count
  FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  
  -- ============================================================
  -- SUPPRESSION ULTRA-SIMPLE: Seulement ce qui n'a pas CASCADE
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options (pas de CASCADE direct)
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  
  -- 2. Supprimer les abonnements (si pas de CASCADE)
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  
  -- 3. Supprimer l'entreprise (CASCADE supprimera automatiquement):
  --    - clients (CASCADE) → qui supprimera espaces_membres_clients (CASCADE)
  --    - factures (CASCADE)
  --    - transactions (CASCADE)
  --    - etc.
  DELETE FROM entreprises WHERE id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suppression échouée');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée (%s client(s), %s espace(s), %s abonnement(s), %s option(s))',
      v_clients_count, v_espaces_count, v_abonnements_count, v_options_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'options_deleted', v_options_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime une entreprise. Version finale simplifiée - utilise uniquement CASCADE, pas de triggers BEFORE DELETE.';


