/*
  # Restauration de la fonction create_espace_membre_from_client_unified
  
  PROBLÈME:
  - La fonction create_espace_membre_from_client_unified n'existe pas
  - L'application l'utilise dans Entreprises.tsx
  - Cela cause une erreur runtime quand on clique sur "Mon Entreprise"
  - Erreur: function gen_salt(unknown) does not exist
  
  SOLUTION:
  - Activer l'extension pgcrypto pour gen_salt
  - Créer la fonction avec la signature attendue par le frontend
  - Utiliser la logique consolidée existante
*/

-- Activer l'extension pgcrypto pour le hashage de mot de passe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
      prix_mensuel
    FROM plans_abonnement
    WHERE id = p_plan_id
    RETURNING id INTO v_abonnement_id;
  END IF;
  
  -- 6. Créer l'espace membre
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    email,
    abonnement_id,
    actif,
    statut_compte,
    configuration_validee
  )
  VALUES (
    p_client_id,
    p_entreprise_id,
    v_auth_user_id,
    v_client_email,
    v_abonnement_id,
    true,
    'actif',
    false
  )
  RETURNING id INTO v_espace_id;
  
  -- 7. Synchroniser les modules depuis le plan
  IF v_abonnement_id IS NOT NULL THEN
    PERFORM sync_client_modules_from_plan(v_espace_id);
  END IF;
  
  -- 8. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'espace_id', v_espace_id,
    'email', v_client_email,
    'password', v_password_to_use,
    'message', 'Espace membre créé avec succès'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION create_espace_membre_from_client_unified IS 'Crée un espace membre client avec auth user, abonnement et synchronisation des modules. Version unifiée consolidée.';

GRANT EXECUTE ON FUNCTION create_espace_membre_from_client_unified(uuid, uuid, text, uuid, uuid[]) TO authenticated;

