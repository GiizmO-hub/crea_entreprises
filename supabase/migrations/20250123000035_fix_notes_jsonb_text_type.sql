/*
  # CORRECTION: Type mismatch entre notes (text) et jsonb
  
  PROBLÈME:
  Erreur: "COALESCE types text and jsonb cannot be matched"
  
  La colonne `notes` dans `paiements` est de type `text`, mais la fonction
  essaie d'insérer/updater avec du `jsonb`. Il faut convertir le jsonb en text.
  
  SOLUTION:
  - Convertir le jsonb en text lors de l'insertion (::text)
  - Parser le text en jsonb lors des updates (si nécessaire)
  - Corriger toutes les fonctions qui utilisent notes
*/

-- ============================================================================
-- PARTIE 1 : Corriger create_complete_entreprise_automated
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
  v_client_statut text;
  v_notes_json jsonb;  -- ✅ Variable pour stocker le jsonb
  v_notes_text text;   -- ✅ Variable pour convertir en text
BEGIN
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  -- 2. Déterminer le statut de paiement
  IF p_plan_id IS NOT NULL THEN
    SELECT prix_mensuel INTO v_plan_montant_mensuel
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF v_plan_montant_mensuel IS NULL THEN
      v_plan_montant_mensuel := 0;
    END IF;
    
    IF v_plan_montant_mensuel > 0 THEN
      v_statut_paiement := 'en_attente';
      v_montant_ttc := v_plan_montant_mensuel * 1.20;
      v_client_statut := 'prospect';
    ELSE
      v_statut_paiement := 'non_requis';
      v_client_statut := 'actif';
    END IF;
  ELSE
    v_statut_paiement := 'non_requis';
    v_client_statut := 'actif';
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

  -- 4. Si un plan est choisi avec montant > 0, créer le paiement en attente
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    -- ✅ Construire le jsonb d'abord
    v_notes_json := jsonb_build_object(
      'plan_id', p_plan_id::text,
      'entreprise_id', v_entreprise_id::text,
      'client_id', NULL,
      'options_ids', COALESCE(p_options_ids::text[], ARRAY[]::text[]),
      'description', format('Paiement pour création entreprise: %s', p_nom_entreprise)
    );
    
    -- ✅ Convertir le jsonb en text pour l'insertion
    v_notes_text := v_notes_json::text;
    
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
      date_creation_paiement,
      notes  -- ✅ notes est de type text
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
      now(),
      v_notes_text  -- ✅ Insérer le text, pas le jsonb
    )
    RETURNING id INTO v_paiement_id;
  END IF;

  -- 5. Si un email client est fourni, créer le client et l'espace membre
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
    
    -- Créer le client avec le bon statut
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
      v_client_statut,
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;

    -- Mettre à jour le paiement avec le client_id si créé
    IF v_paiement_id IS NOT NULL AND v_client_id IS NOT NULL THEN
      -- ✅ Lire les notes existantes comme text, les parser en jsonb, modifier, puis reconvertir en text
      SELECT notes INTO v_notes_text FROM paiements WHERE id = v_paiement_id;
      
      -- Parser le text en jsonb (ou utiliser '{}' si NULL ou invalide)
      BEGIN
        v_notes_json := COALESCE(v_notes_text::jsonb, '{}'::jsonb);
      EXCEPTION WHEN OTHERS THEN
        v_notes_json := '{}'::jsonb;
      END;
      
      -- Mettre à jour avec le client_id
      v_notes_json := jsonb_set(v_notes_json, '{client_id}', to_jsonb(v_client_id::text));
      
      -- Convertir en text et mettre à jour
      UPDATE paiements
      SET notes = v_notes_json::text
      WHERE id = v_paiement_id;
    END IF;

    -- Créer l'utilisateur auth pour le client
    v_auth_user_id := gen_random_uuid();
    v_role := CASE WHEN p_creer_client_super_admin THEN 'client_super_admin' ELSE 'client' END;
      
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role
    )
    VALUES (
      v_auth_user_id,
      p_email_client,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'role', v_role),
      jsonb_build_object(
        'nom', COALESCE(NULLIF(p_nom_client, ''), 'Client'),
        'prenom', COALESCE(NULLIF(p_prenom_client, ''), ''),
        'role', v_role,
        'type', 'client'
      ),
      now(),
      now(),
      'authenticated',
      'authenticated'
    )
    ON CONFLICT (email) DO UPDATE
    SET raw_user_meta_data = jsonb_set(
      COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_role)
    );

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

    -- Créer l'espace membre client
    INSERT INTO espaces_membres_clients (
      client_id,
      entreprise_id,
      user_id,
      password_temporaire,
      doit_changer_password,
      actif,
      statut_compte,
      configuration_validee
    )
    VALUES (
      v_client_id,
      v_entreprise_id,
      v_auth_user_id,
      v_password,
      true,
      CASE WHEN v_statut_paiement = 'en_attente' THEN false ELSE true END,
      CASE WHEN v_statut_paiement = 'en_attente' THEN 'en_attente' ELSE 'actif' END,
      false
    )
    ON CONFLICT (client_id, entreprise_id) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      password_temporaire = EXCLUDED.password_temporaire,
      doit_changer_password = true,
      actif = EXCLUDED.actif,
      statut_compte = EXCLUDED.statut_compte;

    v_email_final := p_email_client;
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
'Crée une entreprise et un client. Si un plan est sélectionné, crée un paiement en attente. Retourne paiement_id et montant_ttc pour afficher la modal de paiement. Les notes sont stockées comme text (jsonb converti).';

GRANT EXECUTE ON FUNCTION create_complete_entreprise_automated TO authenticated;




