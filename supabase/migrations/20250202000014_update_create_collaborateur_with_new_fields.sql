/*
  # Mettre à jour create_collaborateur avec les nouveaux champs supplémentaires
  
  Cette migration met à jour la fonction RPC create_collaborateur pour accepter
  tous les nouveaux champs (heures, contrat, mutuelle, coordonnées bancaires, etc.)
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

-- Créer la nouvelle fonction create_collaborateur avec TOUS les champs
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
  -- Champs professionnels existants
  p_numero_securite_sociale text DEFAULT NULL,
  p_code_urssaf text DEFAULT NULL,
  p_emploi text DEFAULT NULL,
  p_statut_professionnel text DEFAULT NULL,
  p_echelon text DEFAULT NULL,
  p_date_entree date DEFAULT NULL,
  p_convention_collective_numero text DEFAULT NULL,
  p_convention_collective_nom text DEFAULT NULL,
  p_matricule text DEFAULT NULL,
  p_coefficient integer DEFAULT NULL,
  -- Nouveaux champs de contrat
  p_nombre_heures_hebdo numeric DEFAULT 35.00,
  p_nombre_heures_mensuelles numeric DEFAULT NULL,
  p_type_contrat text DEFAULT NULL,
  p_forfait_jours integer DEFAULT NULL,
  p_est_cadre boolean DEFAULT false,
  -- Nouveaux champs mutuelle
  p_a_mutuelle boolean DEFAULT false,
  p_mutuelle_nom text DEFAULT NULL,
  p_mutuelle_numero_adherent text DEFAULT NULL,
  -- Nouveaux champs personnels
  p_date_naissance date DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  -- Nouveaux champs bancaires
  p_iban text DEFAULT NULL,
  p_bic text DEFAULT NULL,
  -- Nouveaux champs contact urgence
  p_contact_urgence_nom text DEFAULT NULL,
  p_contact_urgence_prenom text DEFAULT NULL,
  p_contact_urgence_telephone text DEFAULT NULL,
  p_contact_urgence_lien text DEFAULT NULL,
  -- Nouveaux champs permis
  p_a_permis_conduire boolean DEFAULT false,
  p_permis_categorie text DEFAULT NULL,
  p_permis_date_obtention date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_utilisateur_id uuid;
  v_collaborateur_id uuid;
BEGIN
  -- Créer l'utilisateur dans auth.users
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
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Créer l'entrée dans utilisateurs
  INSERT INTO utilisateurs (
    user_id,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_email,
    p_role,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_utilisateur_id;

  -- Créer l'entrée dans collaborateurs_entreprise avec TOUS les champs
  INSERT INTO collaborateurs_entreprise (
    user_id,
    entreprise_id,
    email,
    nom,
    prenom,
    telephone,
    role,
    poste,
    emploi,
    date_entree,
    numero_securite_sociale,
    code_urssaf,
    statut_professionnel,
    echelon,
    convention_collective_numero,
    convention_collective_nom,
    matricule,
    coefficient,
    -- Nouveaux champs
    nombre_heures_hebdo,
    nombre_heures_mensuelles,
    type_contrat,
    forfait_jours,
    est_cadre,
    a_mutuelle,
    mutuelle_nom,
    mutuelle_numero_adherent,
    date_naissance,
    adresse,
    code_postal,
    ville,
    iban,
    bic,
    contact_urgence_nom,
    contact_urgence_prenom,
    contact_urgence_telephone,
    contact_urgence_lien,
    a_permis_conduire,
    permis_categorie,
    permis_date_obtention,
    actif,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_entreprise_id,
    p_email,
    p_nom,
    p_prenom,
    p_telephone,
    p_role,
    p_poste,
    p_emploi,
    COALESCE(p_date_entree, p_date_embauche),
    p_numero_securite_sociale,
    p_code_urssaf,
    p_statut_professionnel,
    p_echelon,
    p_convention_collective_numero,
    p_convention_collective_nom,
    p_matricule,
    p_coefficient,
    -- Nouveaux champs
    p_nombre_heures_hebdo,
    p_nombre_heures_mensuelles,
    p_type_contrat,
    p_forfait_jours,
    p_est_cadre,
    p_a_mutuelle,
    p_mutuelle_nom,
    p_mutuelle_numero_adherent,
    p_date_naissance,
    p_adresse,
    p_code_postal,
    p_ville,
    p_iban,
    p_bic,
    p_contact_urgence_nom,
    p_contact_urgence_prenom,
    p_contact_urgence_telephone,
    p_contact_urgence_lien,
    p_a_permis_conduire,
    p_permis_categorie,
    p_permis_date_obtention,
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_collaborateur_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'utilisateur_id', v_utilisateur_id,
    'collaborateur_id', v_collaborateur_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un utilisateur avec cet email existe déjà'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

