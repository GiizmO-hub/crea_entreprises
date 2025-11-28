/*
  # Corriger l'erreur "column reference 'raw_user_meta_data' is ambiguous"
  
  PROBLÈME:
  - Dans finaliser_creation_apres_paiement, l'erreur "column reference 'raw_user_meta_data' is ambiguous"
  - Se produit dans le ON CONFLICT DO UPDATE de l'INSERT INTO auth.users
  
  SOLUTION:
  - Préfixer explicitement la colonne avec le nom de la table (auth.users.raw_user_meta_data)
  - Ou utiliser EXCLUDED pour référencer les valeurs insérées
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

  -- Vérifier si l'utilisateur existe déjà dans auth.users
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_client_data.email
  LIMIT 1;

  -- Si l'utilisateur n'existe pas, le créer
  IF v_auth_user_id IS NULL THEN
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
    );
  ELSE
    -- Mettre à jour l'utilisateur existant avec le rôle client_super_admin
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_role)
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(auth.users.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_role)
    ),
    updated_at = now()
    WHERE auth.users.id = v_auth_user_id;
  END IF;

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

  -- Vérifier si l'espace membre existe déjà
  SELECT id INTO v_espace_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_data.id
    AND entreprise_id = p_entreprise_id
  LIMIT 1;
  
  -- Si l'espace n'existe pas, le créer
  IF v_espace_id IS NULL THEN
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
    RETURNING id INTO v_espace_id;
  ELSE
    -- Mettre à jour l'espace existant
    UPDATE espaces_membres_clients
    SET user_id = v_auth_user_id,
        password_temporaire = v_password,
        doit_changer_password = true,
        actif = true,
        statut_compte = 'actif'
    WHERE id = v_espace_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'espace_membre_id', v_espace_id::text,
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

COMMENT ON FUNCTION finaliser_creation_apres_paiement IS 
  'Cree lespace client avec Super Admin automatique apres validation du paiement. Appelable depuis un trigger SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION finaliser_creation_apres_paiement(uuid) TO authenticated;

