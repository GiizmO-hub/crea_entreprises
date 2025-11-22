/*
  # Fix: Gestion espace membre existant
  
  Modifie la fonction create_espace_membre_from_client pour retourner
  l'espace membre existant au lieu de lever une exception si un espace
  existe déjà pour cet email.
*/

CREATE OR REPLACE FUNCTION create_espace_membre_from_client(
  p_client_id uuid,
  p_entreprise_id uuid,
  p_password text,
  p_plan_id uuid,
  p_options_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
  v_user_id uuid;
  v_abonnement_id uuid;
  v_espace_exists boolean;
  v_existing_user_id uuid;
  v_existing_espace_id uuid;
  v_password_final text;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel peut créer un espace membre pour ce client
  IF NOT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de créer un espace membre pour ce client';
  END IF;

  -- Récupérer les informations du client
  SELECT email, nom, prenom
  INTO v_client_email, v_client_nom, v_client_prenom
  FROM clients
  WHERE id = p_client_id
  AND entreprise_id = p_entreprise_id;

  IF v_client_email IS NULL OR v_client_email = '' THEN
    RAISE EXCEPTION 'Le client doit avoir un email pour créer un espace membre';
  END IF;

  -- Vérifier si un utilisateur avec cet email existe déjà dans auth.users
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE email = v_client_email
  LIMIT 1;

  -- Si l'utilisateur existe déjà, vérifier s'il y a un espace membre associé
  IF v_existing_user_id IS NOT NULL THEN
    -- Vérifier si un espace membre existe déjà pour ce client
    SELECT id INTO v_existing_espace_id
    FROM espaces_membres_clients
    WHERE client_id = p_client_id
    LIMIT 1;

    IF v_existing_espace_id IS NOT NULL THEN
      -- Espace membre existe déjà, retourner les informations existantes
      SELECT id INTO v_abonnement_id
      FROM abonnements
      WHERE entreprise_id = p_entreprise_id
      AND statut = 'actif'
      ORDER BY created_at DESC
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', true,
        'already_exists', true,
        'user_id', v_existing_user_id,
        'client_id', p_client_id,
        'entreprise_id', p_entreprise_id,
        'abonnement_id', v_abonnement_id,
        'email', v_client_email,
        'password', NULL,
        'message', 'Un espace membre existe déjà pour ce client avec l''email ' || v_client_email || '. Les identifiants existants peuvent être récupérés depuis la fiche client.'
      );
    END IF;
  END IF;

  -- Vérifier que le plan existe si fourni
  IF p_plan_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
      RAISE EXCEPTION 'Le plan d''abonnement sélectionné n''existe pas ou n''est pas actif';
    END IF;
  END IF;

  -- Générer un mot de passe si non fourni
  IF p_password IS NULL OR p_password = '' THEN
    v_password_final := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'A1!';
  ELSE
    v_password_final := p_password;
  END IF;

  -- Si l'utilisateur existe déjà dans auth.users, utiliser son ID
  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
  ELSE
    -- Générer l'UUID pour le nouvel utilisateur
    v_user_id := gen_random_uuid();

    -- Créer l'utilisateur dans auth.users avec extensions.crypt et extensions.gen_salt
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        raw_app_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_client_email,
        extensions.crypt(v_password_final, extensions.gen_salt('bf')),
        now(),
        jsonb_build_object('role', 'client', 'nom', v_client_nom, 'prenom', v_client_prenom),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        now(),
        now(),
        '', '', '', ''
      );
      
    EXCEPTION WHEN unique_violation THEN
      -- Si l'utilisateur existe maintenant (race condition), le récupérer
      SELECT id INTO v_user_id FROM auth.users WHERE email = v_client_email;
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', v_client_email;
      END IF;
    END;
  END IF;

  -- Créer l'abonnement si un plan est fourni
  IF p_plan_id IS NOT NULL THEN
    INSERT INTO abonnements (
      entreprise_id,
      plan_id,
      statut,
      date_debut,
      date_fin,
      date_prochain_paiement,
      montant_mensuel,
      mode_paiement
    )
    SELECT
      p_entreprise_id,
      p_plan_id,
      'actif',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month',
      CURRENT_DATE + INTERVAL '1 month',
      COALESCE(prix_mensuel, 0),
      'mensuel'
    FROM plans_abonnement
    WHERE id = p_plan_id
    RETURNING id INTO v_abonnement_id;

    -- Créer les options souscrites (modules)
    IF array_length(p_options_ids, 1) > 0 THEN
      FOR i IN 1..array_length(p_options_ids, 1) LOOP
        IF EXISTS (
          SELECT 1 FROM options_supplementaires
          WHERE id = p_options_ids[i] AND actif = true
        ) THEN
          INSERT INTO abonnement_options (
            abonnement_id,
            option_id,
            date_activation,
            actif
          )
          VALUES (
            v_abonnement_id,
            p_options_ids[i],
            CURRENT_DATE,
            true
          )
          ON CONFLICT (abonnement_id, option_id) DO UPDATE
          SET actif = true,
              date_activation = CURRENT_DATE,
              date_desactivation = NULL;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Créer l'utilisateur dans la table utilisateurs
  INSERT INTO utilisateurs (
    id,
    email,
    role,
    entreprise_id,
    nom,
    prenom,
    statut,
    created_by
  ) VALUES (
    v_user_id,
    v_client_email,
    'client',
    p_entreprise_id,
    v_client_nom,
    v_client_prenom,
    'active',
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    entreprise_id = EXCLUDED.entreprise_id,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    updated_at = NOW();

  -- Créer l'espace membre client
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    abonnement_id,
    actif,
    modules_actifs,
    preferences,
    email
  )
  VALUES (
    p_client_id,
    p_entreprise_id,
    v_user_id,
    v_abonnement_id,
    true,
    '{
      "tableau_de_bord": true,
      "mon_entreprise": true,
      "facturation": true,
      "documents": true
    }'::jsonb,
    jsonb_build_object(
      'theme', 'dark',
      'langue', 'fr',
      'notifications', true
    ),
    v_client_email
  )
  ON CONFLICT (client_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    abonnement_id = COALESCE(EXCLUDED.abonnement_id, espaces_membres_clients.abonnement_id),
    actif = true,
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING id INTO v_existing_espace_id;

  -- Retourner les identifiants
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', CASE WHEN v_existing_user_id IS NULL THEN v_password_final ELSE NULL END,
    'message', CASE 
      WHEN v_existing_user_id IS NOT NULL THEN 'Espace membre mis à jour - Les identifiants existants sont conservés'
      ELSE 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users.'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client existant avec un abonnement et des options. Si un espace membre existe déjà, retourne les informations existantes au lieu de lever une exception.';

