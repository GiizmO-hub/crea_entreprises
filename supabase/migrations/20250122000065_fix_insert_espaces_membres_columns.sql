/*
  # Correction INSERT espaces_membres_clients - Colonnes manquantes
  
  PROBLÈME:
  - Erreur "INSERT has more target columns than expressions"
  - La fonction create_espace_membre_from_client n'inclut pas toutes les colonnes nécessaires
  
  SOLUTION:
  - Vérifier toutes les colonnes de la table espaces_membres_clients
  - Corriger l'INSERT pour inclure toutes les colonnes obligatoires
*/

-- ✅ Corriger la fonction create_espace_membre_from_client
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
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
  v_existing_role text;
  v_final_role text;
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

  -- Récupérer le rôle existant depuis auth.users.raw_user_meta_data (source de vérité)
  IF v_existing_user_id IS NOT NULL THEN
    SELECT COALESCE(
      (raw_user_meta_data->>'role')::text,
      (SELECT role FROM utilisateurs WHERE id = v_existing_user_id)
    )
    INTO v_existing_role
    FROM auth.users
    WHERE id = v_existing_user_id;
    
    -- Si le rôle existe et est client_super_admin, LE PRÉSERVER
    IF v_existing_role = 'client_super_admin' THEN
      v_final_role := 'client_super_admin';
    ELSE
      v_final_role := 'client_super_admin'; -- Nouveaux clients sont super_admin par défaut
    END IF;
  ELSE
    v_final_role := 'client_super_admin'; -- Nouveaux clients sont super_admin par défaut
  END IF;

  -- Si l'utilisateur existe déjà, vérifier s'il y a un espace membre associé
  IF v_existing_user_id IS NOT NULL THEN
    SELECT id INTO v_existing_espace_id
    FROM espaces_membres_clients
    WHERE client_id = p_client_id
    LIMIT 1;

    IF v_existing_espace_id IS NOT NULL THEN
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
        'preserved_role', v_existing_role,
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
    v_user_id := gen_random_uuid();

    BEGIN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_client_email,
        crypt(v_password_final, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('nom', v_client_nom, 'prenom', v_client_prenom, 'role', v_final_role),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_client_email;
        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', v_client_email;
        END IF;
    END;
  END IF;

  -- Créer ou mettre à jour utilisateurs avec le rôle préservé
  INSERT INTO utilisateurs (
    id, email, nom, prenom, role, created_at, updated_at
  )
  VALUES (
    v_user_id, 
    v_client_email, 
    v_client_nom, 
    v_client_prenom,
    v_final_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = CASE 
      WHEN utilisateurs.role = 'client_super_admin' THEN 'client_super_admin'
      ELSE COALESCE(v_final_role, utilisateurs.role)
    END,
    email = EXCLUDED.email,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    updated_at = now();

  -- Synchroniser vers auth.users.raw_user_meta_data
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(v_final_role)
  ),
  updated_at = now()
  WHERE id = v_user_id
    AND (
      raw_user_meta_data IS NULL 
      OR (raw_user_meta_data->>'role')::text != v_final_role
    );

  -- Créer ou récupérer l'abonnement si un plan est fourni
  IF p_plan_id IS NOT NULL THEN
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_abonnement_id IS NULL THEN
      INSERT INTO abonnements (
        entreprise_id, plan_id, statut, date_debut, montant_mensuel
      )
      SELECT p_entreprise_id, p_plan_id, 'actif', CURRENT_DATE, prix_mensuel
      FROM plans_abonnement
      WHERE id = p_plan_id
      RETURNING id INTO v_abonnement_id;
    END IF;

    -- Construire le JSON des modules actifs pour ce plan
    FOR v_module_record IN
      SELECT pm.module_code
      FROM plans_modules pm
      JOIN modules_activation ma ON ma.module_code = pm.module_code
      WHERE pm.plan_id = p_plan_id
        AND pm.inclus = true
        AND ma.est_cree = true
        AND ma.actif = true
    LOOP
      v_modules_json := jsonb_set(
        v_modules_json,
        ARRAY[v_module_record.module_code],
        'true'::jsonb
      );
    END LOOP;
  END IF;

  -- ✅ CORRECTION: Créer ou mettre à jour l'espace membre avec TOUTES les colonnes nécessaires
  -- Utiliser DEFAULT pour les colonnes optionnelles
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
    -- Les autres colonnes utiliseront leurs valeurs par défaut ou seront NULL
  )
  VALUES (
    p_client_id, 
    p_entreprise_id, 
    v_user_id, 
    v_abonnement_id,
    true, 
    v_modules_json,
    jsonb_build_object('theme', 'dark', 'langue', 'fr', 'notifications', true),
    v_client_email, 
    v_password_final, 
    true
  )
  ON CONFLICT (client_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    abonnement_id = COALESCE(EXCLUDED.abonnement_id, espaces_membres_clients.abonnement_id),
    actif = true,
    modules_actifs = COALESCE(EXCLUDED.modules_actifs, espaces_membres_clients.modules_actifs),
    preferences = COALESCE(EXCLUDED.preferences, espaces_membres_clients.preferences),
    email = EXCLUDED.email,
    password_temporaire = EXCLUDED.password_temporaire,
    doit_changer_password = true,
    updated_at = NOW()
  RETURNING id INTO v_existing_espace_id;

  -- Synchroniser automatiquement les modules depuis l'abonnement
  IF v_existing_espace_id IS NOT NULL THEN
    PERFORM sync_client_space_modules_from_abonnement(v_existing_espace_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final,
    'password_generated', v_password_generated,
    'preserved_role', v_existing_role,
    'final_role', v_final_role,
    'message', 'Espace membre créé/mis à jour avec succès. Le rôle est synchronisé dans auth.users.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'detail', SQLERRM || ' (Code: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client. Corrigé pour gérer toutes les colonnes de la table.';

