/*
  # Diagnostic et nettoyage complet des emails
  
  PROBLÈME:
  - Des emails persistent dans la base de données même après suppression
  - Permet encore de se connecter alors que l'entité est supprimée
  - Besoin de diagnostic et nettoyage complet
  
  SOLUTIONS:
  1. Fonction de diagnostic pour trouver où un email est utilisé
  2. Fonction de nettoyage complet pour supprimer un email partout
  3. Amélioration des triggers de suppression pour éviter les résidus
*/

-- ============================================================================
-- PARTIE 1 : Fonction de diagnostic pour trouver où un email est utilisé
-- ============================================================================

CREATE OR REPLACE FUNCTION diagnostic_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_result jsonb := jsonb_build_object('email', p_email, 'found_in', jsonb_build_array());
  v_count integer := 0;
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('error', 'Email vide');
  END IF;
  
  -- Vérifier dans auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    v_result := jsonb_set(v_result, '{found_in}', 
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'auth.users', 'user_id', v_user_id));
    v_count := v_count + 1;
  END IF;
  
  -- Vérifier dans clients
  IF EXISTS (SELECT 1 FROM clients WHERE email = p_email) THEN
    v_result := jsonb_set(v_result, '{found_in}',
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'clients', 'count', 
        (SELECT COUNT(*) FROM clients WHERE email = p_email)));
    v_count := v_count + 1;
  END IF;
  
  -- Vérifier dans collaborateurs
  IF EXISTS (SELECT 1 FROM collaborateurs WHERE email = p_email) THEN
    v_result := jsonb_set(v_result, '{found_in}',
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'collaborateurs', 'count',
        (SELECT COUNT(*) FROM collaborateurs WHERE email = p_email)));
    v_count := v_count + 1;
  END IF;
  
  -- Vérifier dans espaces_membres_clients
  IF EXISTS (SELECT 1 FROM espaces_membres_clients WHERE email = p_email) THEN
    v_result := jsonb_set(v_result, '{found_in}',
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'espaces_membres_clients', 'count',
        (SELECT COUNT(*) FROM espaces_membres_clients WHERE email = p_email)));
    v_count := v_count + 1;
  END IF;
  
  -- Vérifier dans utilisateurs
  IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_user_id) THEN
    v_result := jsonb_set(v_result, '{found_in}',
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'utilisateurs', 'user_id', v_user_id));
    v_count := v_count + 1;
  END IF;
  
  -- Vérifier dans entreprises (si l'email est utilisé comme user_id)
  IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM entreprises WHERE user_id = v_user_id) THEN
    v_result := jsonb_set(v_result, '{found_in}',
      (v_result->'found_in')::jsonb || jsonb_build_object('table', 'entreprises', 'count',
        (SELECT COUNT(*) FROM entreprises WHERE user_id = v_user_id)));
    v_count := v_count + 1;
  END IF;
  
  v_result := jsonb_set(v_result, '{total_occurrences}', to_jsonb(v_count));
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION diagnostic_email(text) IS 'Diagnostique où un email est utilisé dans la base de données';

GRANT EXECUTE ON FUNCTION diagnostic_email(text) TO authenticated;

-- ============================================================================
-- PARTIE 2 : Fonction de nettoyage complet d'un email
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_email_complete(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_cleaned_tables jsonb := jsonb_build_array();
  v_total_deleted integer := 0;
  v_deleted_count integer;
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT is_admin_user_simple() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Admin requis'
    );
  END IF;
  
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email vide'
    );
  END IF;
  
  -- Récupérer le user_id depuis auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  -- 1. Supprimer les espaces membres clients
  DELETE FROM espaces_membres_clients
  WHERE email = p_email OR user_id = v_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'espaces_membres_clients', 'count', v_deleted_count);
    v_total_deleted := v_total_deleted + v_deleted_count;
  END IF;
  
  -- 2. Supprimer les collaborateurs
  DELETE FROM collaborateurs
  WHERE email = p_email OR user_id = v_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'collaborateurs', 'count', v_deleted_count);
    v_total_deleted := v_total_deleted + v_deleted_count;
  END IF;
  
  -- 3. Supprimer les clients
  DELETE FROM clients
  WHERE email = p_email OR id = v_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'clients', 'count', v_deleted_count);
    v_total_deleted := v_total_deleted + v_deleted_count;
  END IF;
  
  -- 4. Supprimer de utilisateurs
  IF v_user_id IS NOT NULL THEN
    DELETE FROM utilisateurs WHERE id = v_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count > 0 THEN
      v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'utilisateurs', 'count', v_deleted_count);
      v_total_deleted := v_total_deleted + v_deleted_count;
    END IF;
  END IF;
  
  -- 5. Supprimer les entreprises liées (mais pas si c'est un super admin plateforme)
  IF v_user_id IS NOT NULL THEN
    -- Vérifier si c'est un super admin plateforme avant de supprimer les entreprises
    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_user_id
      AND (raw_user_meta_data->>'role')::text = 'super_admin'
    ) OR NOT EXISTS (
      SELECT 1 FROM espaces_membres_clients WHERE user_id = v_user_id
    ) THEN
      -- Ce n'est pas un super admin plateforme, on peut supprimer les entreprises
      DELETE FROM entreprises
      WHERE user_id = v_user_id;
      
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
      IF v_deleted_count > 0 THEN
        v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'entreprises', 'count', v_deleted_count);
        v_total_deleted := v_total_deleted + v_deleted_count;
      END IF;
    END IF;
  END IF;
  
  -- 6. ENFIN, supprimer de auth.users (doit être en dernier pour éviter les erreurs de foreign key)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
      IF v_deleted_count > 0 THEN
        v_cleaned_tables := v_cleaned_tables || jsonb_build_object('table', 'auth.users', 'count', v_deleted_count);
        v_total_deleted := v_total_deleted + v_deleted_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorer les erreurs si l'utilisateur n'existe plus
      NULL;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'email', p_email,
    'total_deleted', v_total_deleted,
    'cleaned_tables', v_cleaned_tables,
    'message', format('Email %s nettoyé de %s table(s)', p_email, v_total_deleted)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION cleanup_email_complete(text) IS 'Supprime complètement un email de TOUTES les tables (sauf super admin plateforme)';

GRANT EXECUTE ON FUNCTION cleanup_email_complete(text) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Améliorer les triggers de suppression pour éviter les résidus
-- ============================================================================

-- S'assurer que le trigger pour supprimer auth.users lors de la suppression d'un client existe
DO $$
BEGIN
  -- Supprimer le trigger existant s'il existe
  DROP TRIGGER IF EXISTS trigger_delete_client_auth_user ON clients;
  
  -- Créer la fonction trigger si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_client_auth_user_trigger') THEN
    CREATE OR REPLACE FUNCTION delete_client_auth_user_trigger()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $$
    DECLARE
      v_user_id uuid;
    BEGIN
      -- Récupérer le user_id depuis les espaces membres ou clients
      SELECT user_id INTO v_user_id
      FROM espaces_membres_clients
      WHERE client_id = OLD.id
      LIMIT 1;
      
      -- Si pas trouvé, essayer par email dans clients
      IF v_user_id IS NULL AND OLD.email IS NOT NULL THEN
        SELECT id INTO v_user_id
        FROM auth.users
        WHERE email = OLD.email
        LIMIT 1;
      END IF;
      
      -- Supprimer l'auth user si trouvé (sauf si c'est un super admin plateforme)
      IF v_user_id IS NOT NULL THEN
        -- Vérifier si c'est un super admin plateforme
        IF NOT (
          EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = v_user_id
            AND (raw_user_meta_data->>'role')::text = 'super_admin'
          )
          AND NOT EXISTS (
            SELECT 1 FROM espaces_membres_clients WHERE user_id = v_user_id
          )
        ) THEN
          DELETE FROM auth.users WHERE id = v_user_id;
        END IF;
      END IF;
      
      RETURN OLD;
    END;
    $$;
  END IF;
  
  -- Créer le trigger
  CREATE TRIGGER trigger_delete_client_auth_user
    AFTER DELETE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION delete_client_auth_user_trigger();
    
END $$;

-- S'assurer que le trigger pour supprimer auth.users lors de la suppression d'un collaborateur existe
DO $$
BEGIN
  -- Supprimer le trigger existant s'il existe
  DROP TRIGGER IF EXISTS trigger_delete_collaborateur_auth_user ON collaborateurs;
  
  -- Créer la fonction trigger si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_collaborateur_auth_user_trigger') THEN
    CREATE OR REPLACE FUNCTION delete_collaborateur_auth_user_trigger()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $$
    DECLARE
      v_email_user_id uuid;
    BEGIN
      -- Supprimer l'auth user si présent (sauf si c'est un super admin plateforme)
      IF OLD.user_id IS NOT NULL THEN
        -- Vérifier si c'est un super admin plateforme
        IF NOT (
          EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = OLD.user_id
            AND (raw_user_meta_data->>'role')::text = 'super_admin'
          )
          AND NOT EXISTS (
            SELECT 1 FROM espaces_membres_clients WHERE user_id = OLD.user_id
          )
        ) THEN
          DELETE FROM auth.users WHERE id = OLD.user_id;
        END IF;
      END IF;
      
      -- Aussi supprimer par email au cas où
      IF OLD.email IS NOT NULL THEN
        BEGIN
          SELECT id INTO v_email_user_id
          FROM auth.users
          WHERE email = OLD.email
          LIMIT 1;
          
          IF v_email_user_id IS NOT NULL AND v_email_user_id != OLD.user_id THEN
            -- Vérifier si c'est un super admin plateforme
            IF NOT (
              EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = v_email_user_id
                AND (raw_user_meta_data->>'role')::text = 'super_admin'
              )
              AND NOT EXISTS (
                SELECT 1 FROM espaces_membres_clients WHERE user_id = v_email_user_id
              )
            ) THEN
              DELETE FROM auth.users WHERE id = v_email_user_id;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
      
      RETURN OLD;
    END;
    $$;
  END IF;
  
  -- Créer le trigger
  CREATE TRIGGER trigger_delete_collaborateur_auth_user
    AFTER DELETE ON collaborateurs
    FOR EACH ROW
    EXECUTE FUNCTION delete_collaborateur_auth_user_trigger();
    
END $$;

