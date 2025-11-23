/*
  # Fonction pour activer/désactiver le statut super_admin d'un client dans son espace
  
  Permet à l'administrateur de la plateforme de définir un client comme
  super_admin de son propre espace client (sans accès à la gestion des modules).
*/

-- Fonction pour activer/désactiver le statut super_admin d'un client
CREATE OR REPLACE FUNCTION toggle_client_super_admin(
  p_client_id uuid,
  p_is_super_admin boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND NOT EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Récupérer le user_id du client depuis espaces_membres_clients
  SELECT user_id INTO v_user_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun espace membre trouvé pour ce client'
    );
  END IF;

  -- Mettre à jour le rôle dans utilisateurs
  IF p_is_super_admin THEN
    -- Activer super_admin
    INSERT INTO utilisateurs (
      id,
      email,
      nom,
      prenom,
      role,
      created_at,
      updated_at
    )
    SELECT 
      v_user_id,
      au.email,
      c.nom,
      c.prenom,
      'super_admin',
      now(),
      now()
    FROM clients c
    LEFT JOIN auth.users au ON au.id = v_user_id
    WHERE c.id = p_client_id
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'super_admin',
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client défini comme super_admin de son espace',
      'is_super_admin', true
    );
  ELSE
    -- Désactiver super_admin (retour à client)
    UPDATE utilisateurs
    SET role = 'client',
        updated_at = now()
    WHERE id = v_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Statut super_admin retiré du client',
      'is_super_admin', false
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut super_admin d''un client dans son espace. Seuls les super_admin de la plateforme peuvent utiliser cette fonction.';

