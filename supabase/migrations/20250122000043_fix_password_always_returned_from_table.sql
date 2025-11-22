/*
  # Fix : Retourner toujours le mot de passe, même si l'espace existe déjà
  
  Problème : Quand un espace membre existe déjà, la fonction retourne password: NULL
  Solution : Récupérer le password_temporaire stocké dans espaces_membres_clients
  ou générer un nouveau mot de passe si aucun n'est stocké.
*/

-- Supprimer d'abord la fonction existante pour éviter les conflits
DROP FUNCTION IF EXISTS create_espace_membre_from_client(uuid, uuid, text, uuid, uuid[]);

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
  v_stored_password text;
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

  -- Vérifier si un espace membre existe déjà pour ce client
  SELECT id, password_temporaire INTO v_existing_espace_id, v_stored_password
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  LIMIT 1;

  -- Vérifier si un utilisateur avec cet email existe déjà dans auth.users
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE email = v_client_email
  LIMIT 1;

  -- Si un espace membre existe déjà
  IF v_existing_espace_id IS NOT NULL THEN
    -- Récupérer l'abonnement actif
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Déterminer quel mot de passe retourner :
    -- 1. Si un mot de passe est fourni dans la requête, l'utiliser
    -- 2. Sinon, utiliser le password_temporaire stocké
    -- 3. Si aucun n'est disponible, générer un nouveau mot de passe
    IF p_password IS NOT NULL AND trim(p_password) != '' THEN
      v_password_final := p_password;
      v_password_generated := false;
    ELSIF v_stored_password IS NOT NULL AND trim(v_stored_password) != '' THEN
      v_password_final := v_stored_password;
      v_password_generated := false;
    ELSE
      -- Générer un nouveau mot de passe sécurisé
      v_password_final := substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 12) || 'A1!';
      v_password_generated := true;
      
      -- Mettre à jour le password_temporaire dans la table
      UPDATE espaces_membres_clients
      SET password_temporaire = v_password_final,
          updated_at = NOW()
      WHERE id = v_existing_espace_id;
    END IF;

    -- Si l'utilisateur existe, utiliser son ID, sinon il sera créé plus tard
    IF v_existing_user_id IS NOT NULL THEN
      v_user_id := v_existing_user_id;
    ELSE
      v_user_id := gen_random_uuid();
    END IF;

    -- Toujours retourner le mot de passe (stocké, fourni ou généré)
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'user_id', v_user_id,
      'client_id', p_client_id,
      'entreprise_id', p_entreprise_id,
      'abonnement_id', v_abonnement_id,
      'email', v_client_email,
      'password', v_password_final, -- TOUJOURS retourner un mot de passe
      'password_generated', v_password_generated,
      'message', CASE 
        WHEN v_password_generated THEN 'Espace membre existant. Nouveau mot de passe généré et mis à jour.'
        WHEN v_stored_password IS NOT NULL THEN 'Espace membre existant. Mot de passe récupéré depuis la base de données.'
        ELSE 'Espace membre existant. Mot de passe mis à jour avec celui fourni.'
      END
    );
  END IF;

  -- Si on arrive ici, c'est qu'aucun espace membre n'existe encore
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
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        last_sign_in_at,
        confirmed_at
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
        now(),
        now()
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

  -- Créer l'espace membre (ON CONFLICT va gérer le cas où il existe déjà)
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
    password_temporaire = EXCLUDED.password_temporaire, -- Mettre à jour le mot de passe temporaire
    doit_changer_password = true,
    updated_at = NOW()
  RETURNING id INTO v_existing_espace_id;

  -- TOUJOURS retourner le mot de passe (généré ou fourni) dans le résultat
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final, -- TOUJOURS retourner le mot de passe
    'password_generated', v_password_generated,
    'message', CASE 
      WHEN v_existing_user_id IS NOT NULL THEN 'Espace membre créé/mis à jour - Les identifiants existants sont conservés'
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

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client. Retourne TOUJOURS un mot de passe : soit celui fourni, soit celui stocké dans la table, soit un nouveau mot de passe généré automatiquement.';

