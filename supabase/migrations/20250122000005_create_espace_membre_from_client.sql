/*
  # Création d'Espace Membre à partir d'un Client Existant
  
  ## Fonctionnalités
  
  1. Crée un espace membre pour un client existant :
     - Création d'un compte utilisateur dans auth.users
     - Création dans la table utilisateurs avec role 'client'
     - Création d'un abonnement avec le plan choisi
     - Création des options souscrites (modules)
     - Retourne les identifiants (email + password)
     
  2. Vérifie que :
     - Le client existe
     - Le client a un email
     - L'espace membre n'existe pas déjà
*/

-- Fonction pour créer un espace membre à partir d'un client existant
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
SET search_path = public, auth
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

  -- NOTE: La création d'un utilisateur dans auth.users nécessite l'API Supabase Admin
  -- Pour l'instant, on génère un UUID qui sera utilisé lors de la création via l'API
  v_user_id := gen_random_uuid();

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

  -- Mettre à jour le client pour lier l'abonnement (si la colonne existe)
  -- Note: Ceci est optionnel selon votre schéma

  -- Retourner les identifiants
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', p_client_id,
    'entreprise_id', p_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', v_client_email,
    'password', v_password_final,
    'message', 'Espace membre créé. L''utilisateur doit être créé dans auth.users via l''API Supabase Admin avec cet email et ce mot de passe.'
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de l''espace membre: %', SQLERRM;
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée un espace membre pour un client existant avec un abonnement et des options. Retourne les identifiants (email + password).';

-- Fonction pour récupérer les identifiants d'un client (email uniquement, pas le mot de passe)
CREATE OR REPLACE FUNCTION get_client_credentials(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email text;
  v_user_exists boolean;
  v_espace_actif boolean;
BEGIN
  -- Vérifier les permissions
  IF NOT EXISTS (
    SELECT 1 FROM clients c
    JOIN entreprises e ON e.id = c.entreprise_id
    WHERE c.id = p_client_id
    AND e.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit d''accéder aux identifiants de ce client';
  END IF;

  -- Récupérer l'email du client
  SELECT email INTO v_client_email
  FROM clients
  WHERE id = p_client_id;

  IF v_client_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client sans email'
    );
  END IF;

  -- Vérifier si un utilisateur existe dans auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE email = v_client_email
  ) INTO v_user_exists;

  -- Vérifier si l'espace membre est actif
  SELECT EXISTS(
    SELECT 1 FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
    AND statut = 'active'
  ) INTO v_espace_actif;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_client_email,
    'user_exists', v_user_exists,
    'espace_actif', v_espace_actif,
    'message', CASE 
      WHEN v_user_exists AND v_espace_actif THEN 'Espace membre actif'
      WHEN v_user_exists AND NOT v_espace_actif THEN 'Utilisateur créé mais espace inactif'
      ELSE 'Espace membre non créé'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION get_client_credentials IS 'Récupère les informations d''identification d''un client (email uniquement, pas le mot de passe pour des raisons de sécurité).';

