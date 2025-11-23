/*
  # Création du rôle spécifique client_super_admin
  
  Création d'un rôle distinct pour les clients super_admin de leur espace,
  différent du rôle super_admin de la plateforme.
  
  ## Changements:
  1. Ajouter 'client_super_admin' aux valeurs autorisées pour la colonne role dans utilisateurs
  2. Mettre à jour toggle_client_super_admin pour utiliser 'client_super_admin'
  3. Mettre à jour check_my_super_admin_status pour vérifier 'client_super_admin'
  4. Mettre à jour get_client_super_admin_status pour retourner le bon statut
  5. Mettre à jour create_espace_membre_from_client pour créer avec 'client_super_admin'
  6. S'assurer que is_platform_super_admin exclut 'client_super_admin'
*/

-- ✅ 1. Modifier la contrainte CHECK pour accepter 'client_super_admin'
ALTER TABLE utilisateurs
DROP CONSTRAINT IF EXISTS utilisateurs_role_check;

ALTER TABLE utilisateurs
ADD CONSTRAINT utilisateurs_role_check 
CHECK (role IN ('super_admin', 'admin', 'collaborateur', 'client', 'manager', 'comptable', 'commercial', 'client_super_admin'));

-- ✅ 2. Mettre à jour toggle_client_super_admin pour utiliser 'client_super_admin'
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
    SELECT 
      v_user_id,
      au.email,
      c.nom,
      c.prenom,
      'client_super_admin', -- ✅ Nouveau rôle spécifique
      now(),
      now()
    FROM clients c
    LEFT JOIN auth.users au ON au.id = v_user_id
    WHERE c.id = p_client_id
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'client_super_admin', -- ✅ Nouveau rôle spécifique
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Client défini comme super_admin de son espace',
      'is_super_admin', true
    );
  ELSE
    -- Désactiver client_super_admin (retour à client)
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

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut client_super_admin d''un client dans son espace. Utilise le rôle client_super_admin (différent de super_admin plateforme).';

-- ✅ 3. Mettre à jour check_my_super_admin_status pour vérifier 'client_super_admin'
CREATE OR REPLACE FUNCTION check_my_super_admin_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_super_admin boolean := false;
BEGIN
  -- Cette fonction permet à un utilisateur de vérifier son propre statut client_super_admin
  -- Vérifier si le rôle est 'client_super_admin'
  SELECT COALESCE(u.role = 'client_super_admin', false)
  INTO v_is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.user_id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

COMMENT ON FUNCTION check_my_super_admin_status IS 'Permet à un client de vérifier s''il est client_super_admin de son espace. Vérifie le rôle client_super_admin (différent de super_admin plateforme).';

-- ✅ 4. Mettre à jour get_client_super_admin_status pour vérifier 'client_super_admin'
CREATE OR REPLACE FUNCTION get_client_super_admin_status(p_entreprise_id uuid)
RETURNS TABLE (
  client_id uuid,
  is_super_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  -- Retourner le statut client_super_admin de tous les clients de l'entreprise
  RETURN QUERY
  SELECT 
    emc.client_id,
    COALESCE(u.role = 'client_super_admin', false) as is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.entreprise_id = p_entreprise_id;
END;
$$;

COMMENT ON FUNCTION get_client_super_admin_status IS 'Récupère le statut client_super_admin de tous les clients d''une entreprise. Utilise le rôle client_super_admin (différent de super_admin plateforme).';

-- ✅ 5. Mettre à jour create_espace_membre_from_client pour créer avec 'client_super_admin'
-- (Cette fonction est déjà longue, on va juste modifier la partie pertinente)
-- La fonction sera mise à jour dans une migration séparée si nécessaire, 
-- mais on peut déjà mettre à jour le rôle ici dans la section INSERT

-- Note: La fonction create_espace_membre_from_client est dans une autre migration
-- On va créer une version mise à jour ici
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
        jsonb_build_object('nom', v_client_nom, 'prenom', v_client_prenom, 'role', 'client'),
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

  -- ✅ Créer ou mettre à jour l'entrée dans utilisateurs avec role='client_super_admin'
  INSERT INTO utilisateurs (
    id, email, nom, prenom, role, created_at, updated_at
  )
  VALUES (
    v_user_id, v_client_email, v_client_nom, v_client_prenom,
    'client_super_admin', -- ✅ Nouveau rôle spécifique
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = 'client_super_admin', -- ✅ Nouveau rôle spécifique
    email = EXCLUDED.email,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    updated_at = now();

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

  -- Créer ou mettre à jour l'espace membre
  INSERT INTO espaces_membres_clients (
    client_id, entreprise_id, user_id, abonnement_id,
    actif, modules_actifs, preferences, email,
    password_temporaire, doit_changer_password
  )
  VALUES (
    p_client_id, p_entreprise_id, v_user_id, v_abonnement_id,
    true, v_modules_json,
    jsonb_build_object('theme', 'dark', 'langue', 'fr', 'notifications', true),
    v_client_email, v_password_final, true
  )
  ON CONFLICT (client_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    abonnement_id = COALESCE(EXCLUDED.abonnement_id, espaces_membres_clients.abonnement_id),
    actif = true,
    modules_actifs = EXCLUDED.modules_actifs,
    email = EXCLUDED.email,
    password_temporaire = EXCLUDED.password_temporaire,
    doit_changer_password = true,
    updated_at = NOW()
  RETURNING id INTO v_existing_espace_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final,
    'password_generated', v_password_generated,
    'message', CASE 
      WHEN v_existing_user_id IS NOT NULL THEN 'Espace membre mis à jour - Les identifiants existants sont conservés. Le client est maintenant client_super_admin de son espace.'
      WHEN v_password_generated THEN 'Espace membre créé avec succès. Un mot de passe sécurisé a été généré automatiquement. Le client est client_super_admin de son espace.'
      ELSE 'Espace membre créé avec succès. L''utilisateur a été créé dans auth.users avec le mot de passe fourni. Le client est client_super_admin de son espace.'
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

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée ou met à jour un espace membre pour un client existant. Le client créé est automatiquement client_super_admin de son espace (différent de super_admin plateforme).';

-- ✅ 6. S'assurer que is_platform_super_admin exclut 'client_super_admin'
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

  -- Sinon, vérifier si c'est un super_admin dans utilisateurs (pas client_super_admin)
  RETURN EXISTS (
    SELECT 1 
    FROM utilisateurs u
    WHERE u.id = p_user_id
    AND u.role = 'super_admin' -- ✅ Seul super_admin plateforme, pas client_super_admin
  );
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin IS 'Vérifie si un utilisateur est super_admin de la plateforme. Exclut les client_super_admin.';

