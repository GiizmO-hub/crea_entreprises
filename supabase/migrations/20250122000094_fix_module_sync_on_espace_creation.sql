/*
  # FIX: Synchronisation des modules lors de la création d'espace membre
  
  PROBLÈME:
  - Quand on crée un espace membre avec un plan_id, les modules ne s'affichent pas
  - La fonction sync_client_modules_from_plan est appelée mais peut-être trop tôt
  - L'abonnement_id n'est peut-être pas encore correctement lié
  
  SOLUTION:
  - S'assurer que la synchronisation se fait APRÈS la création de l'espace membre
  - Utiliser l'abonnement_id directement au lieu de le chercher dans l'espace membre
  - Ajouter une fonction qui synchronise directement depuis un plan_id
  
  MÉTHODOLOGIE: CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD
*/

-- ✅ FONCTION : Synchroniser les modules directement depuis un plan_id (nouvelle fonction)
CREATE OR REPLACE FUNCTION sync_modules_from_plan_id(
  p_espace_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
  v_module_count integer := 0;
BEGIN
  -- Vérifier que l'espace existe
  IF NOT EXISTS (SELECT 1 FROM espaces_membres_clients WHERE id = p_espace_id) THEN
    RAISE NOTICE '⚠️ Espace membre % non trouvé', p_espace_id;
    RETURN;
  END IF;
  
  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) THEN
    RAISE NOTICE '⚠️ Plan % non trouvé', p_plan_id;
    RETURN;
  END IF;
  
  -- Construire le JSON des modules actifs depuis plans_modules
  FOR v_module_record IN
    SELECT pm.module_code, ma.module_nom
    FROM plans_modules pm
    JOIN modules_activation ma ON ma.module_code = pm.module_code
    WHERE pm.plan_id = p_plan_id
      AND pm.inclus = true
      AND ma.est_cree = true
      AND ma.actif = true
    ORDER BY ma.module_nom
  LOOP
    v_modules_json := jsonb_set(
      v_modules_json,
      ARRAY[v_module_record.module_code],
      'true'::jsonb,
      true -- créer si n'existe pas
    );
    v_module_count := v_module_count + 1;
  END LOOP;
  
  -- Toujours ajouter les modules de base
  v_modules_json := v_modules_json || jsonb_build_object(
    'dashboard', true,
    'mon_entreprise', true,
    'settings', true
  );
  
  -- Mettre à jour modules_actifs dans l'espace client
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = NOW()
  WHERE id = p_espace_id;
  
  RAISE NOTICE '✅ Modules synchronisés pour l''espace client % : % modules depuis le plan %', 
    p_espace_id, 
    v_module_count,
    p_plan_id;
    
  -- Log pour debug
  RAISE NOTICE '📦 Modules JSON: %', v_modules_json::text;
END;
$$;

COMMENT ON FUNCTION sync_modules_from_plan_id IS 'Synchronise les modules d''un espace client directement depuis un plan_id. Utilisé lors de la création d''espace membre.';

-- ✅ AMÉLIORER la fonction create_espace_membre_from_client_unified
-- pour utiliser la nouvelle fonction de synchronisation
CREATE OR REPLACE FUNCTION create_espace_membre_from_client_unified(
  p_client_id uuid,
  p_entreprise_id uuid,
  p_password text,
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
  v_existing_espace_id uuid;
  v_auth_user_id uuid;
  v_espace_id uuid;
  v_password_to_use text;
  v_abonnement_id uuid;
BEGIN
  -- 1. Récupérer les informations du client
  SELECT email, nom, prenom
  INTO v_client_email, v_client_nom, v_client_prenom
  FROM clients
  WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;
  
  IF v_client_email IS NULL OR v_client_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le client doit avoir un email pour créer un espace membre'
    );
  END IF;
  
  -- 2. Vérifier si un espace membre existe déjà
  SELECT id INTO v_existing_espace_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id;
  
  IF v_existing_espace_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'espace_id', v_existing_espace_id,
      'message', 'Un espace membre existe déjà pour ce client'
    );
  END IF;
  
  -- 3. Utiliser le mot de passe fourni ou en générer un
  v_password_to_use := COALESCE(NULLIF(p_password, ''), 
    substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'A1!');
  
  -- 4. Vérifier/créer l'auth user
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_client_email;
  
  IF v_auth_user_id IS NULL THEN
    -- Créer l'auth user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_client_email,
      crypt(v_password_to_use, gen_salt('bf'))::text,
      NOW(),
      NULL,
      NULL,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('role', 'client_super_admin'),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_auth_user_id;
    
    -- Créer l'entrée dans utilisateurs
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, v_client_email, v_client_nom, v_client_prenom, 'client_super_admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'client_super_admin',
        nom = v_client_nom,
        prenom = v_client_prenom;
  ELSE
    -- Mettre à jour le rôle dans utilisateurs si nécessaire
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, v_client_email, v_client_nom, v_client_prenom, 'client_super_admin')
    ON CONFLICT (id) DO UPDATE
    SET role = CASE 
      WHEN utilisateurs.role = 'client_super_admin' THEN 'client_super_admin'
      ELSE 'client_super_admin'
    END,
    nom = v_client_nom,
    prenom = v_client_prenom;
  END IF;
  
  -- 5. Créer l'abonnement si un plan est fourni
  IF p_plan_id IS NOT NULL THEN
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
      NOW(),
      COALESCE(prix_mensuel, 0)
    FROM plans_abonnement
    WHERE id = p_plan_id
    RETURNING id INTO v_abonnement_id;
    
    IF v_abonnement_id IS NULL THEN
      RAISE NOTICE '⚠️ Erreur création abonnement pour plan %', p_plan_id;
    ELSE
      RAISE NOTICE '✅ Abonnement créé: % pour plan %', v_abonnement_id, p_plan_id;
    END IF;
  END IF;
  
  -- 6. Créer l'espace membre avec modules_actifs initialisé vide (sera rempli ensuite)
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    email,
    abonnement_id,
    actif,
    statut_compte,
    configuration_validee,
    modules_actifs
  )
  VALUES (
    p_client_id,
    p_entreprise_id,
    v_auth_user_id,
    v_client_email,
    v_abonnement_id,
    true,
    'actif',
    false,
    '{}'::jsonb -- Modules vides, seront synchronisés ensuite
  )
  RETURNING id INTO v_espace_id;
  
  RAISE NOTICE '✅ Espace membre créé: % avec abonnement_id: %', v_espace_id, v_abonnement_id;
  
  -- 7. ✅ CORRECTION: Synchroniser les modules DEPUIS LE PLAN_ID directement (si plan fourni)
  IF p_plan_id IS NOT NULL THEN
    PERFORM sync_modules_from_plan_id(v_espace_id, p_plan_id);
    RAISE NOTICE '✅ Modules synchronisés depuis le plan %', p_plan_id;
  ELSE
    -- Si pas de plan, mettre les modules de base
    UPDATE espaces_membres_clients
    SET modules_actifs = jsonb_build_object(
      'dashboard', true,
      'mon_entreprise', true,
      'settings', true
    )
    WHERE id = v_espace_id;
    RAISE NOTICE '✅ Modules de base assignés (pas de plan)';
  END IF;
  
  -- 8. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'espace_id', v_espace_id,
    'email', v_client_email,
    'password', v_password_to_use,
    'abonnement_id', v_abonnement_id,
    'plan_id', p_plan_id,
    'message', 'Espace membre créé avec succès et modules synchronisés'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE,
    'detail', 'Erreur lors de la création de l''espace membre'
  );
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client_unified IS 'Crée un espace membre client avec auth user, abonnement et synchronisation des modules. Version corrigée avec synchronisation directe depuis plan_id.';

GRANT EXECUTE ON FUNCTION create_espace_membre_from_client_unified(uuid, uuid, text, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_modules_from_plan_id(uuid, uuid) TO authenticated;

-- Log final
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ FONCTION DE SYNCHRONISATION DES MODULES CORRIGÉE ! ✅✅✅';
  RAISE NOTICE '📦 La fonction sync_modules_from_plan_id synchronise directement depuis un plan_id';
  RAISE NOTICE '📦 La fonction create_espace_membre_from_client_unified utilise maintenant cette nouvelle fonction';
END $$;

