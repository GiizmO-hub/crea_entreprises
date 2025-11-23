/*
  # Fix : Erreur "cannot insert a non-DEFAULT value into column confirmed_at"
  
  La colonne `confirmed_at` dans `auth.users` ne peut pas recevoir une valeur
  explicite lors de l'insertion. Elle doit être omise de la liste des colonnes
  et utiliser sa valeur par défaut.
*/

-- Mettre à jour la fonction pour retirer confirmed_at de l'INSERT
CREATE OR REPLACE FUNCTION create_espace_membre_from_client(
  p_client_id uuid,
  p_entreprise_id uuid,
  p_password text DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
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
  v_password_generated boolean := false;
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

  -- Générer un mot de passe si non fourni ou vide
  IF p_password IS NULL OR trim(p_password) = '' THEN
    -- Générer un mot de passe sécurisé : 12 caractères aléatoires + caractères spéciaux
    v_password_final := substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 12) || 'A1!';
    v_password_generated := true;
  ELSE
    v_password_final := p_password;
    v_password_generated := false;
  END IF;

  -- Si l'utilisateur existe déjà dans auth.users, utiliser son ID
  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
  ELSE
    -- Générer l'UUID pour le nouvel utilisateur
    v_user_id := gen_random_uuid();

    -- Créer l'utilisateur dans auth.users SANS confirmed_at (utilise la valeur par défaut)
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        last_sign_in_at
        -- confirmed_at est omis - utilise la valeur par défaut
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_client_email,
        crypt(v_password_final, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('nom', v_client_nom, 'prenom', v_client_prenom, 'role', 'client'),
        now(),
        now(),
        '',
        '',
        '',
        '',
        now()
        -- confirmed_at omis - utilise la valeur par défaut
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- L'utilisateur existe déjà (race condition), récupérer son ID
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_client_email;
        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', v_client_email;
        END IF;
    END;
  END IF;

  -- Créer ou récupérer l'abonnement si un plan est fourni
  IF p_plan_id IS NOT NULL THEN
    -- Vérifier si un abonnement actif existe déjà pour cette entreprise
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Si pas d'abonnement actif, créer un nouvel abonnement
    IF v_abonnement_id IS NULL THEN
      INSERT INTO abonnements (
        entreprise_id,
        plan_id,
        statut,
        date_debut,
        montant_mensuel
      )
      SELECT
        p_entreprise_id,
        p_plan_id,
        'actif',
        CURRENT_DATE,
        prix_mensuel
      FROM plans_abonnement
      WHERE id = p_plan_id
      RETURNING id INTO v_abonnement_id;
    END IF;
  END IF;

  -- Créer ou mettre à jour l'espace membre
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    abonnement_id,
    actif,
    modules_actifs,
    preferences,
    email,
    password_temporaire,
    doit_changer_password
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
    v_client_email,
    v_password_final,
    true
  )
  ON CONFLICT (client_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    abonnement_id = COALESCE(EXCLUDED.abonnement_id, espaces_membres_clients.abonnement_id),
    actif = true,
    email = EXCLUDED.email,
    password_temporaire = EXCLUDED.password_temporaire,
    doit_changer_password = true,
    updated_at = NOW()
  RETURNING id INTO v_existing_espace_id;

  -- Toujours retourner le mot de passe généré ou fourni dans le résultat
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final, -- TOUJOURS retourner le mot de passe (généré ou fourni)
    'password_generated', v_password_generated, -- Indiquer si le mot de passe a été généré automatiquement
    'message', CASE 
      WHEN v_existing_user_id IS NOT NULL THEN 'Espace membre mis à jour - Les identifiants existants sont conservés'
      WHEN v_password_generated THEN 'Espace membre créé avec succès. Un mot de passe sécurisé a été généré automatiquement.'
      ELSE 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users avec le mot de passe fourni.'
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

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client existant avec un abonnement et des options. Génère automatiquement un mot de passe sécurisé si aucun mot de passe n''est fourni. Retourne toujours le mot de passe dans le résultat. La colonne confirmed_at est omise pour utiliser la valeur par défaut.';

