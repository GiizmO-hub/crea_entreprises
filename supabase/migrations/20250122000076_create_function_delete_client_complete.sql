/*
  # Fonction pour supprimer complètement un client
  
  Crée une fonction RPC pour supprimer un client et tout ce qui est lié
*/

CREATE OR REPLACE FUNCTION delete_client_complete_unified(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_record RECORD;
  v_user_id uuid;
  v_email text;
  v_auth_users_count integer := 0;
BEGIN
  -- Vérifier si l'utilisateur est admin
  IF NOT is_admin_user_simple() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Admin requis'
    );
  END IF;
  
  -- Vérifier que le client existe
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = p_client_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;
  
  -- Récupérer l'email du client
  SELECT email INTO v_email FROM clients WHERE id = p_client_id;
  
  -- Supprimer l'espace membre (cascade supprimera l'auth user via trigger)
  FOR v_espace_record IN
    SELECT id, user_id FROM espaces_membres_clients WHERE client_id = p_client_id
  LOOP
    -- Supprimer l'auth user si présent (via trigger après suppression espace)
    -- Mais on le fait manuellement ici aussi pour être sûr
    IF v_espace_record.user_id IS NOT NULL THEN
      BEGIN
        DELETE FROM auth.users WHERE id = v_espace_record.user_id;
        v_auth_users_count := v_auth_users_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
    
    -- Supprimer l'espace membre
    DELETE FROM espaces_membres_clients WHERE id = v_espace_record.id;
  END LOOP;
  
  -- Supprimer aussi l'auth user par email (au cas où)
  IF v_email IS NOT NULL AND v_email != '' THEN
    BEGIN
      PERFORM delete_auth_user_by_email(v_email);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  
  -- Supprimer le client (cascade supprimera les autres éléments liés)
  DELETE FROM clients WHERE id = p_client_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Client supprimé définitivement (%s auth.user(s) supprimé(s))', v_auth_users_count),
    'auth_users_deleted', v_auth_users_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION delete_client_complete_unified(uuid) IS 'Supprime définitivement un client et tout ce qui est lié : espace membre, auth.user, etc.';

GRANT EXECUTE ON FUNCTION delete_client_complete_unified(uuid) TO authenticated;

