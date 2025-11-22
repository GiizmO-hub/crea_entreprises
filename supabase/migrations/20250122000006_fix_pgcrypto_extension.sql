/*
  # Fix: Activation extension pgcrypto et correction utilisation gen_salt
  
  Cette migration corrige l'erreur "function gen_salt(unknown) does not exist"
  
  Problème:
    - L'extension pgcrypto n'est pas activée ou pas accessible
    - gen_salt doit être utilisé avec le préfixe extensions.
    
  Solution:
    1. Activer l'extension pgcrypto explicitement
    2. Corriger la fonction pour utiliser extensions.gen_salt
    3. Ajouter extensions au search_path
*/

-- 1. Activer l'extension pgcrypto (nécessaire pour crypt et gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Corriger la fonction create_espace_membre_from_client
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

  -- Vérifier si un espace membre existe déjà pour ce client
  SELECT EXISTS(
    SELECT 1 FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
  ) INTO v_espace_exists;

  IF v_espace_exists THEN
    RAISE EXCEPTION 'Un espace membre existe déjà pour ce client avec l''email %', v_client_email;
  END IF;

  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE EXCEPTION 'Le plan d''abonnement sélectionné n''existe pas ou n''est pas actif';
  END IF;

  -- Vérifier que l'email n'existe pas déjà dans auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_client_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec l''email % existe déjà', v_client_email;
  END IF;

  -- Générer un mot de passe si non fourni
  IF p_password IS NULL OR p_password = '' THEN
    -- Générer un mot de passe aléatoire de 12 caractères
    v_password_final := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'A1!';
  ELSE
    v_password_final := p_password;
  END IF;

  -- Générer l'UUID pour l'utilisateur
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
      jsonb_build_object(
        'role', 'client',
        'nom', v_client_nom,
        'prenom', v_client_prenom
      ),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Utilisateur créé dans auth.users: %', v_user_id;
    
  EXCEPTION WHEN unique_violation THEN
    -- L'email existe déjà, récupérer l'user_id existant
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_client_email;
    
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', v_client_email;
    END IF;
    
    RAISE NOTICE 'Utilisateur existant trouvé: %', v_user_id;
  END;

  -- Créer l'abonnement
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
    INSERT INTO abonnement_options (
      abonnement_id,
      option_id,
      date_activation,
      actif
    )
    SELECT
      v_abonnement_id,
      unnest(p_options_ids),
      CURRENT_DATE,
      true
    WHERE EXISTS (
      SELECT 1 FROM options_supplementaires
      WHERE id = ANY(p_options_ids)
      AND actif = true
    );
  END IF;

  -- Créer l'utilisateur dans la table utilisateurs (sera synchronisé une fois créé dans auth)
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

  -- Retourner les identifiants
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final,
    'message', 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users.'
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de l''espace membre: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée un espace membre pour un client existant avec un abonnement et des options. Crée l''utilisateur dans auth.users avec cryptage bcrypt et retourne les identifiants (email + password). Nécessite l''extension pgcrypto.';

