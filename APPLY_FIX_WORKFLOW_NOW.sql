/*
  # CORRECTION URGENTE : Erreur ON CONFLICT dans create_complete_entreprise_automated
  
  ERREUR: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
  
  PROBLÈME:
  - ON CONFLICT (email) ne fonctionne pas car auth.users n'a pas de contrainte unique directe sur email
  - Il faut utiliser BEGIN/EXCEPTION au lieu de ON CONFLICT
  
  CORRECTION:
  - Remplacer ON CONFLICT par un bloc BEGIN/EXCEPTION
  - Ajouter tous les champs obligatoires pour auth.users
*/

-- ============================================================================
-- CORRECTION DE LA FONCTION create_complete_entreprise_automated
-- ============================================================================

CREATE OR REPLACE FUNCTION create_complete_entreprise_automated(
  -- Informations entreprise
  p_nom_entreprise text,
  p_forme_juridique text DEFAULT 'SARL',
  p_siret text DEFAULT NULL,
  p_email_entreprise text DEFAULT NULL,
  p_telephone_entreprise text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_capital numeric DEFAULT 0,
  p_rcs text DEFAULT NULL,
  p_site_web text DEFAULT NULL,
  
  -- Informations client (optionnel)
  p_email_client text DEFAULT NULL,
  p_nom_client text DEFAULT NULL,
  p_prenom_client text DEFAULT NULL,
  p_telephone_client text DEFAULT NULL,
  p_adresse_client text DEFAULT NULL,
  p_code_postal_client text DEFAULT NULL,
  p_ville_client text DEFAULT NULL,
  p_password_client text DEFAULT NULL,
  
  -- Abonnement
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL,
  
  -- Options
  p_creer_client_super_admin boolean DEFAULT true,
  p_envoyer_email boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_password text;
  v_email_final text;
  v_auth_user_id uuid;
  v_role text;
  v_plan_montant_mensuel numeric;
  v_statut_paiement text;
  v_paiement_id uuid;
  v_montant_ttc numeric;
  v_plan RECORD;
BEGIN
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié',
      'hint', 'Vous devez être connecté pour créer une entreprise'
    );
  END IF;

  -- 2. Vérifier si un plan est fourni et récupérer ses informations
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id AND (actif = true OR actif IS NULL);
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé ou inactif',
        'hint', 'Vérifiez que le plan existe et est actif'
      );
    END IF;
    
    v_plan_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
    
    IF v_plan_montant_mensuel > 0 THEN
      v_statut_paiement := 'en_attente';
      v_montant_ttc := v_plan_montant_mensuel * 1.20;
    ELSE
      v_statut_paiement := 'non_requis';
    END IF;
  ELSE
    v_statut_paiement := 'non_requis';
    v_plan_montant_mensuel := 0;
  END IF;

  -- 3. Créer l'entreprise
  INSERT INTO entreprises (
    user_id,
    nom,
    forme_juridique,
    siret,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    capital,
    rcs,
    site_web,
    statut,
    statut_paiement
  )
  VALUES (
    v_user_id,
    p_nom_entreprise,
    p_forme_juridique,
    NULLIF(p_siret, ''),
    NULLIF(p_email_entreprise, ''),
    NULLIF(p_telephone_entreprise, ''),
    NULLIF(p_adresse, ''),
    NULLIF(p_code_postal, ''),
    NULLIF(p_ville, ''),
    COALESCE(p_capital, 0),
    NULLIF(p_rcs, ''),
    NULLIF(p_site_web, ''),
    'active',
    v_statut_paiement
  )
  RETURNING id INTO v_entreprise_id;

  -- 4. Créer le client AVANT le paiement (nécessaire pour le workflow)
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    -- Générer ou utiliser le mot de passe fourni
    IF p_password_client IS NOT NULL AND p_password_client != '' THEN
      v_password := p_password_client;
    ELSE
      v_password := substr(
        md5(random()::text || clock_timestamp()::text),
        1,
        12
      ) || upper(substr(md5(random()::text), 1, 2)) || '!';
    END IF;
    
    -- Créer le client
    INSERT INTO clients (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      adresse,
      code_postal,
      ville,
      statut,
      entreprise_nom
    )
    VALUES (
      v_entreprise_id,
      COALESCE(NULLIF(p_nom_client, ''), 'Client'),
      COALESCE(NULLIF(p_prenom_client, ''), ''),
      p_email_client,
      NULLIF(p_telephone_client, ''),
      NULLIF(p_adresse_client, ''),
      NULLIF(p_code_postal_client, ''),
      NULLIF(p_ville_client, ''),
      CASE WHEN v_statut_paiement = 'en_attente' THEN 'en_attente' ELSE 'actif' END,
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;

    -- Créer l'utilisateur auth pour le client (SANS ON CONFLICT)
    v_auth_user_id := gen_random_uuid();
    v_role := CASE WHEN p_creer_client_super_admin THEN 'client_super_admin' ELSE 'client' END;
      
    -- ✅ CORRECTION : Utiliser BEGIN/EXCEPTION au lieu de ON CONFLICT
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
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
        v_auth_user_id,
        'authenticated',
        'authenticated',
        p_email_client,
        crypt(v_password, gen_salt('bf')),
        now(),
        jsonb_build_object(
          'nom', COALESCE(NULLIF(p_nom_client, ''), 'Client'),
          'prenom', COALESCE(NULLIF(p_prenom_client, ''), ''),
          'role', v_role,
          'type', 'client'
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
      
    EXCEPTION WHEN unique_violation THEN
      -- Email existe déjà, récupérer l'ID de l'utilisateur existant
      SELECT id INTO v_auth_user_id
      FROM auth.users
      WHERE email = p_email_client
      LIMIT 1;
      
      IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', p_email_client;
      END IF;
      
      -- Mettre à jour les métadonnées de l'utilisateur existant
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(v_role)
      )
      WHERE id = v_auth_user_id;
    END;

    -- Créer l'entrée dans utilisateurs
    INSERT INTO utilisateurs (
      id,
      email,
      nom,
      prenom,
      role
    )
    VALUES (
      v_auth_user_id,
      p_email_client,
      COALESCE(NULLIF(p_nom_client, ''), 'Client'),
      COALESCE(NULLIF(p_prenom_client, ''), ''),
      v_role
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom,
      role = EXCLUDED.role;

    v_email_final := p_email_client;
  END IF;

  -- 5. Si un plan est choisi avec montant > 0, créer le paiement en attente
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    INSERT INTO paiements (
      user_id,
      entreprise_id,
      type_paiement,
      montant_ht,
      montant_tva,
      montant_ttc,
      methode_paiement,
      statut,
      date_echeance,
      notes
    )
    VALUES (
      v_user_id,
      v_entreprise_id,
      'autre',
      v_plan_montant_mensuel,
      v_plan_montant_mensuel * 0.20,
      v_montant_ttc,
      'stripe',
      'en_attente',
      CURRENT_DATE + INTERVAL '30 days',
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'entreprise_id', v_entreprise_id::text,
        'client_id', COALESCE(v_client_id::text, NULL),
        'auth_user_id', COALESCE(v_auth_user_id::text, NULL),
        'options_ids', COALESCE(
          CASE 
            WHEN p_options_ids IS NOT NULL THEN array_to_string(p_options_ids::text[], ',')
            ELSE NULL
          END,
          NULL
        ),
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise),
        'plan_nom', v_plan.nom
      )::text
    )
    RETURNING id INTO v_paiement_id;
  END IF;

  -- 6. Construire le résultat
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'entreprise_nom', p_nom_entreprise,
    'client_id', v_client_id,
    'email', v_email_final,
    'password', CASE WHEN v_email_final IS NOT NULL THEN v_password ELSE NULL END,
    'paiement_id', v_paiement_id,
    'montant_ttc', CASE WHEN v_paiement_id IS NOT NULL THEN v_montant_ttc ELSE NULL END,
    'message', CASE 
      WHEN v_paiement_id IS NOT NULL THEN 'Entreprise créée. Sélectionnez votre méthode de paiement.'
      ELSE 'Entreprise créée avec succès'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'message', 'Erreur lors de la création automatisée de l''entreprise'
  );
END;
$$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
'Crée une entreprise et un client. Si un plan est sélectionné, crée un paiement en attente avec toutes les infos nécessaires dans les notes. Retourne paiement_id et montant_ttc pour afficher la modal de paiement. Version corrigée sans ON CONFLICT.';

GRANT EXECUTE ON FUNCTION create_complete_entreprise_automated TO authenticated;

-- Vérification
SELECT '✅ Fonction create_complete_entreprise_automated corrigée !' as resultat;

