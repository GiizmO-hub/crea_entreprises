/*
  # Mettre à jour la fonction create_collaborateur pour inclure les nouveaux champs
  
  Cette migration met à jour la fonction RPC create_collaborateur pour accepter
  les nouveaux champs professionnels détaillés.
*/

-- Supprimer toutes les variantes de la fonction create_collaborateur
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure AS func_name
    FROM pg_proc
    WHERE proname = 'create_collaborateur'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
  END LOOP;
END $$;

-- Créer la nouvelle fonction create_collaborateur avec tous les champs
CREATE OR REPLACE FUNCTION create_collaborateur(
  p_email text,
  p_password text,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_role text DEFAULT 'collaborateur',
  p_entreprise_id uuid DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_poste text DEFAULT NULL,
  p_date_embauche date DEFAULT NULL,
  p_salaire numeric DEFAULT NULL,
  -- Nouveaux champs
  p_numero_securite_sociale text DEFAULT NULL,
  p_code_urssaf text DEFAULT NULL,
  p_emploi text DEFAULT NULL,
  p_statut_professionnel text DEFAULT NULL,
  p_echelon text DEFAULT NULL,
  p_date_entree date DEFAULT NULL,
  p_convention_collective_numero text DEFAULT NULL,
  p_convention_collective_nom text DEFAULT NULL,
  p_matricule text DEFAULT NULL,
  p_coefficient integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_collaborateur_id uuid;
  v_password_hash text;
BEGIN
  -- Vérifier que l'utilisateur est admin ou propriétaire de l'entreprise
  IF NOT is_admin_user_simple() THEN
    IF p_entreprise_id IS NULL THEN
      RAISE EXCEPTION 'Accès non autorisé - Admin requis ou entreprise_id requis';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM entreprises 
      WHERE id = p_entreprise_id 
      AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Accès non autorisé - Vous n''êtes pas propriétaire de cette entreprise';
    END IF;
  END IF;

  -- Vérifier que l'email n'existe pas déjà
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cet email est déjà utilisé'
    );
  END IF;

  -- Créer l'utilisateur dans auth.users
  v_password_hash := crypt(p_password, gen_salt('bf'));
  
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_password_hash,
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('nom', p_nom, 'prenom', p_prenom),
    false,
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Créer l'entrée dans utilisateurs
  INSERT INTO utilisateurs (
    user_id,
    email,
    nom,
    prenom,
    telephone,
    role
  ) VALUES (
    v_user_id,
    p_email,
    p_nom,
    p_prenom,
    p_telephone,
    p_role
  );

  -- Créer le collaborateur avec tous les champs
  INSERT INTO collaborateurs_entreprise (
    entreprise_id,
    user_id,
    email,
    nom,
    prenom,
    telephone,
    role,
    departement,
    poste,
    numero_securite_sociale,
    code_urssaf,
    emploi,
    statut_professionnel,
    echelon,
    date_entree,
    convention_collective_numero,
    convention_collective_nom,
    matricule,
    coefficient
  ) VALUES (
    p_entreprise_id,
    v_user_id,
    p_email,
    p_nom,
    p_prenom,
    p_telephone,
    p_role,
    p_departement,
    p_poste,
    p_numero_securite_sociale,
    p_code_urssaf,
    p_emploi,
    p_statut_professionnel,
    p_echelon,
    p_date_entree,
    p_convention_collective_numero,
    p_convention_collective_nom,
    p_matricule,
    p_coefficient
  ) RETURNING id INTO v_collaborateur_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'collaborateur_id', v_collaborateur_id
  );
END;
$$;

COMMENT ON FUNCTION create_collaborateur IS 'Crée un collaborateur avec tous les champs professionnels détaillés';

