/*
  # Fonction pour récupérer/renvoyer les identifiants d'un client
  
  PROBLÈME:
  - Pas de moyen de renvoyer les identifiants après la création initiale
  - Le mot de passe n'est pas stocké en clair (normalement)
  
  SOLUTION:
  - Créer une fonction qui génère un nouveau mot de passe temporaire
  - Mettre à jour l'auth user avec le nouveau mot de passe
  - Retourner les identifiants pour l'envoi par email
  
  MÉTHODOLOGIE: CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD
*/

-- Activer l'extension pgcrypto si nécessaire
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ✅ FONCTION : Récupérer/générer les identifiants d'un client pour renvoi
CREATE OR REPLACE FUNCTION get_or_regenerate_client_credentials(
  p_client_id uuid
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
  v_entreprise_nom text;
  v_entreprise_id uuid;
  v_espace_id uuid;
  v_user_id uuid;
  v_new_password text;
  v_hashed_password text;
BEGIN
  -- Vérifier que l'appelant est un admin plateforme
  IF NOT COALESCE(is_platform_super_admin(), false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
  END IF;

  -- Récupérer les informations du client
  SELECT 
    c.email,
    c.nom,
    c.prenom,
    c.entreprise_id,
    e.nom
  INTO 
    v_client_email,
    v_client_nom,
    v_client_prenom,
    v_entreprise_id,
    v_entreprise_nom
  FROM clients c
  LEFT JOIN entreprises e ON e.id = c.entreprise_id
  WHERE c.id = p_client_id;
  
  IF NOT FOUND OR v_client_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé ou email manquant'
    );
  END IF;
  
  -- Vérifier si un espace membre existe
  SELECT id, user_id
  INTO v_espace_id, v_user_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id;
  
  IF v_espace_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun espace membre trouvé pour ce client'
    );
  END IF;
  
  -- Si l'user_id n'existe pas, essayer de le trouver via l'email
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_client_email
    LIMIT 1;
  END IF;
  
  -- Générer un nouveau mot de passe temporaire
  v_new_password := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'A1!';
  v_hashed_password := crypt(v_new_password, gen_salt('bf'))::text;
  
  -- Si un auth user existe, mettre à jour le mot de passe
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET 
      encrypted_password = v_hashed_password,
      updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    -- Créer un nouvel auth user si il n'existe pas
    INSERT INTO auth.users (
      instance_id,
      id,
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
      v_hashed_password,
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('role', 'client_super_admin'),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;
    
    -- Mettre à jour l'espace membre avec le user_id
    UPDATE espaces_membres_clients
    SET user_id = v_user_id
    WHERE id = v_espace_id;
    
    -- Créer/mettre à jour l'entrée dans utilisateurs
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_user_id, v_client_email, v_client_nom, v_client_prenom, 'client_super_admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'client_super_admin',
        nom = v_client_nom,
        prenom = v_client_prenom;
  END IF;
  
  -- Mettre à jour le flag doit_changer_password dans l'espace membre
  UPDATE espaces_membres_clients
  SET doit_changer_password = true,
      updated_at = NOW()
  WHERE id = v_espace_id;
  
  -- Retourner les identifiants
  RETURN jsonb_build_object(
    'success', true,
    'email', v_client_email,
    'password', v_new_password,
    'client_nom', v_client_nom,
    'client_prenom', v_client_prenom,
    'entreprise_nom', v_entreprise_nom,
    'entreprise_id', v_entreprise_id,
    'espace_id', v_espace_id,
    'message', 'Identifiants générés avec succès'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION get_or_regenerate_client_credentials IS 'Récupère ou régénère les identifiants d''un client pour renvoi par email. Accessible uniquement aux super admins plateforme.';

GRANT EXECUTE ON FUNCTION get_or_regenerate_client_credentials(uuid) TO authenticated;

-- Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ Fonction get_or_regenerate_client_credentials créée avec succès ! ✅✅✅';
END $$;

