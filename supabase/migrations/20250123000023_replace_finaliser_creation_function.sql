/*
  # Remplacer finaliser_creation_apres_paiement sans vérification de permissions
*/

DROP FUNCTION IF EXISTS finaliser_creation_apres_paiement(uuid) CASCADE;

CREATE OR REPLACE FUNCTION finaliser_creation_apres_paiement(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_client_data RECORD;
  v_entreprise_data RECORD;
  v_password text;
  v_auth_user_id uuid;
  v_espace_id uuid;
  v_role text := 'client_super_admin';
  v_existing_email text;
  v_existing_password text;
  v_existing_user_id uuid;
BEGIN
  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise_data
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  -- Récupérer le client de l'entreprise
  SELECT * INTO v_client_data
  FROM clients
  WHERE entreprise_id = p_entreprise_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;

  -- Vérifier si l'espace membre existe déjà
  SELECT emc.id, emc.user_id, emc.password_temporaire, c.email
  INTO v_espace_id, v_existing_user_id, v_existing_password, v_existing_email
  FROM espaces_membres_clients emc
  JOIN clients c ON c.id = emc.client_id
  WHERE emc.client_id = v_client_data.id
  LIMIT 1;

  -- Si l'espace membre existe déjà, le retourner
  IF v_espace_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'espace_membre_id', v_espace_id,
      'email', v_existing_email,
      'password', v_existing_password
    );
  END IF;

  -- Créer le mot de passe temporaire
  v_password := substr(
    md5(random()::text || clock_timestamp()::text),
    1,
    12
  ) || upper(substr(md5(random()::text), 1, 2)) || '!';

  -- Générer l'ID pour auth.users
  v_auth_user_id := gen_random_uuid();

  -- Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  )
  VALUES (
    v_auth_user_id,
    v_client_data.email,
    crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'role', v_role),
    jsonb_build_object(
      'nom', COALESCE(v_client_data.nom, 'Client'),
      'prenom', COALESCE(v_client_data.prenom, ''),
      'role', v_role,
      'type', 'client'
    ),
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (id) DO UPDATE
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(v_role)
  );

  -- Créer ou mettre à jour l'entrée dans utilisateurs
  INSERT INTO utilisateurs (
    id,
    email,
    nom,
    prenom,
    role
  )
  VALUES (
    v_auth_user_id,
    v_client_data.email,
    COALESCE(v_client_data.nom, 'Client'),
    COALESCE(v_client_data.prenom, ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = v_role,
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom;

  -- Créer l'espace membre client
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    password_temporaire,
    doit_changer_password,
    actif,
    statut_compte,
    configuration_validee
  )
  VALUES (
    v_client_data.id,
    p_entreprise_id,
    v_auth_user_id,
    v_password,
    true,
    true,
    'actif',
    false
  )
  ON CONFLICT (client_id, entreprise_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      password_temporaire = EXCLUDED.password_temporaire,
      doit_changer_password = EXCLUDED.doit_changer_password,
      actif = true,
      statut_compte = 'actif'
  RETURNING id INTO v_espace_id;

  RETURN jsonb_build_object(
    'success', true,
    'espace_membre_id', v_espace_id,
    'email', v_client_data.email,
    'password', v_password
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION finaliser_creation_apres_paiement(uuid) TO authenticated;




