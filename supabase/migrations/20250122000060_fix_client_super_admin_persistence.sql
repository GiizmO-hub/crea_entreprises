/*
  # Correction de la persistance du rôle client_super_admin
  
  Problème: Le statut client_super_admin ne persiste pas après déconnexion/reconnexion.
  
  Causes possibles:
  1. La fonction check_my_super_admin_status ne trouve pas le rôle
  2. Le rôle est écrasé quelque part
  3. L'enregistrement dans utilisateurs n'existe pas ou est supprimé
  
  Solution:
  1. Améliorer check_my_super_admin_status pour être plus robuste
  2. S'assurer que toggle_client_super_admin crée toujours l'enregistrement dans utilisateurs
  3. Ajouter une vérification de persistance
*/

-- ✅ 1. Améliorer check_my_super_admin_status pour être plus robuste
CREATE OR REPLACE FUNCTION check_my_super_admin_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_is_super_admin boolean := false;
  v_user_id uuid;
BEGIN
  -- Récupérer l'ID de l'utilisateur connecté
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier d'abord si l'utilisateur a un espace membre (est un client)
  IF NOT EXISTS (
    SELECT 1 
    FROM espaces_membres_clients 
    WHERE user_id = v_user_id
  ) THEN
    -- Pas un client, donc pas client_super_admin
    RETURN false;
  END IF;
  
  -- Vérifier le rôle dans utilisateurs
  -- Si l'enregistrement n'existe pas, le créer avec le rôle par défaut 'client'
  SELECT COALESCE(u.role = 'client_super_admin', false)
  INTO v_is_super_admin
  FROM utilisateurs u
  WHERE u.id = v_user_id;
  
  -- Si l'enregistrement n'existe pas dans utilisateurs, le créer
  IF NOT FOUND THEN
    -- Créer l'enregistrement avec le rôle 'client' par défaut
    INSERT INTO utilisateurs (id, email, role, created_at, updated_at)
    SELECT 
      v_user_id,
      au.email,
      'client',
      now(),
      now()
    FROM auth.users au
    WHERE au.id = v_user_id
    ON CONFLICT (id) DO NOTHING;
    
    RETURN false;
  END IF;
  
  RETURN v_is_super_admin;
END;
$$;

COMMENT ON FUNCTION check_my_super_admin_status IS 'Vérifie si l''utilisateur connecté est client_super_admin. Crée l''enregistrement dans utilisateurs si nécessaire.';

-- ✅ 2. Améliorer toggle_client_super_admin pour garantir la persistance
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
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
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

  -- Récupérer le user_id et les infos du client depuis espaces_membres_clients
  SELECT 
    emc.user_id,
    c.email,
    c.nom,
    c.prenom
  INTO 
    v_user_id,
    v_client_email,
    v_client_nom,
    v_client_prenom
  FROM espaces_membres_clients emc
  JOIN clients c ON c.id = emc.client_id
  WHERE emc.client_id = p_client_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun espace membre trouvé pour ce client'
    );
  END IF;

  -- Mettre à jour ou créer l'enregistrement dans utilisateurs
  IF p_is_super_admin THEN
    -- Activer client_super_admin (role spécifique pour les clients)
    INSERT INTO utilisateurs (
      id,
      email,
      nom,
      prenom,
      role,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_client_email,
      v_client_nom,
      v_client_prenom,
      'client_super_admin', -- ✅ Rôle spécifique pour les clients
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'client_super_admin', -- ✅ Toujours mettre à jour le rôle
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom,
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client défini comme super_admin de son espace',
      'is_super_admin', true,
      'user_id', v_user_id
    );
  ELSE
    -- Désactiver client_super_admin (retour à client)
    INSERT INTO utilisateurs (
      id,
      email,
      nom,
      prenom,
      role,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_client_email,
      v_client_nom,
      v_client_prenom,
      'client', -- ✅ Retour au rôle client normal
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'client', -- ✅ Toujours mettre à jour le rôle
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom,
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Statut super_admin retiré du client',
      'is_super_admin', false,
      'user_id', v_user_id
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut client_super_admin d''un client. Garantit la persistance du rôle dans utilisateurs.';

-- ✅ 3. Créer une fonction de vérification pour diagnostiquer les problèmes
CREATE OR REPLACE FUNCTION verify_client_super_admin_status(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_has_espace boolean;
  v_has_utilisateur boolean;
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

  -- Récupérer le user_id
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

  -- Vérifier si l'espace membre existe
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients WHERE client_id = p_client_id
  ) INTO v_has_espace;

  -- Vérifier si l'enregistrement utilisateur existe
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs WHERE id = v_user_id
  ) INTO v_has_utilisateur;

  -- Récupérer le rôle
  SELECT role INTO v_role
  FROM utilisateurs
  WHERE id = v_user_id;

  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'client_id', p_client_id,
    'user_id', v_user_id,
    'has_espace', v_has_espace,
    'has_utilisateur', v_has_utilisateur,
    'role', COALESCE(v_role, 'NULL'),
    'is_client_super_admin', COALESCE(v_role = 'client_super_admin', false)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION verify_client_super_admin_status IS 'Fonction de diagnostic pour vérifier le statut client_super_admin d''un client.';

