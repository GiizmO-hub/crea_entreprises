/*
  # Fix : Client super_admin de son espace sans accès gestion modules
  
  Quand un client est créé avec son entreprise, il doit être automatiquement
  super_admin de SON propre panel, mais SANS accès à la gestion des modules
  (qui est réservée au super_admin de la plateforme).
  
  ## Changements:
  1. Créer une entrée dans utilisateurs avec role='super_admin' lors de la création d'espace membre
  2. La logique de contrôle d'accès distingue :
     - super_admin plateforme : peut gérer les modules
     - super_admin espace client : ne peut pas gérer les modules
*/

-- Fonction pour vérifier si un utilisateur est super_admin plateforme (pas un client)
CREATE OR REPLACE FUNCTION is_platform_super_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_client boolean := false;
BEGIN
  -- Vérifier si l'utilisateur est un client (a un espace membre)
  SELECT EXISTS (
    SELECT 1 
    FROM espaces_membres_clients emc
    WHERE emc.user_id = p_user_id
  ) INTO v_is_client;

  -- Si c'est un client, ce n'est PAS un super_admin de la plateforme
  IF v_is_client THEN
    RETURN false;
  END IF;

  -- Sinon, vérifier si c'est un super_admin dans utilisateurs
  RETURN EXISTS (
    SELECT 1 
    FROM utilisateurs u
    WHERE u.id = p_user_id
    AND u.role = 'super_admin'
  );
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin IS 'Vérifie si un utilisateur est super_admin de la plateforme (pas un client). Les clients même super_admin de leur espace ne sont pas considérés comme super_admin plateforme.';

-- Mettre à jour la fonction create_espace_membre_from_client pour créer une entrée dans utilisateurs avec role='super_admin'
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

  -- ✅ NOUVEAU : Créer ou mettre à jour l'entrée dans utilisateurs avec role='super_admin'
  -- Cela permet au client d'être super_admin de son espace
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
    'super_admin', -- ✅ Client est super_admin de SON espace
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = 'super_admin', -- Mettre à jour pour s'assurer qu'il est super_admin
    email = EXCLUDED.email,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    updated_at = now();

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
      WHEN v_existing_user_id IS NOT NULL THEN 'Espace membre mis à jour - Les identifiants existants sont conservés. Le client est maintenant super_admin de son espace.'
      WHEN v_password_generated THEN 'Espace membre créé avec succès. Un mot de passe sécurisé a été généré automatiquement. Le client est super_admin de son espace.'
      ELSE 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users avec le mot de passe fourni. Le client est super_admin de son espace.'
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

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client existant avec un abonnement et des options. Génère automatiquement un mot de passe sécurisé si aucun mot de passe n''est fourni. Retourne toujours le mot de passe dans le résultat. Le client créé est automatiquement super_admin de son espace (mais pas de la plateforme).';




