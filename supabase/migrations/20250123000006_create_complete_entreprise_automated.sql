/*
  # Fonction RPC : Création complète automatisée d'une entreprise
  
  Cette fonction automatise TOUT le processus de création :
  1. Création de l'entreprise
  2. Création du client (si email client fourni)
  3. Création de l'espace membre client
  4. Création de l'abonnement (si plan_id fourni)
  5. Synchronisation des modules
  6. Génération des identifiants
  7. Envoi de l'email (optionnel)
  
  Usage:
  SELECT create_complete_entreprise_automated(
    p_nom_entreprise := 'Mon Entreprise',
    p_forme_juridique := 'SARL',
    p_email_client := 'client@example.com',
    p_nom_client := 'Dupont',
    p_prenom_client := 'Jean',
    p_plan_id := 'uuid-du-plan',
    p_envoyer_email := true
  );
*/

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
  
  -- Informations client (optionnel - si fourni, crée aussi le client)
  p_email_client text DEFAULT NULL,
  p_nom_client text DEFAULT NULL,
  p_prenom_client text DEFAULT NULL,
  p_telephone_client text DEFAULT NULL,
  p_adresse_client text DEFAULT NULL,
  p_code_postal_client text DEFAULT NULL,
  p_ville_client text DEFAULT NULL,
  
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
  v_espace_membre_id uuid;
  v_abonnement_id uuid;
  v_password text;
  v_email_final text;
  v_result jsonb;
  v_auth_user_id uuid;
  v_role text;
BEGIN
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  -- 2. Créer l'entreprise
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
    p_siret,
    p_email_entreprise,
    p_telephone_entreprise,
    p_adresse,
    p_code_postal,
    p_ville,
    p_capital,
    p_rcs,
    p_site_web,
    'active',
    'non_requis'
  )
  RETURNING id INTO v_entreprise_id;

  -- 3. Si un email client est fourni, créer le client et l'espace membre
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    -- Générer un mot de passe temporaire
    v_password := substr(
      md5(random()::text || clock_timestamp()::text),
      1,
      12
    ) || upper(substr(md5(random()::text), 1, 2)) || '!';
    
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
      COALESCE(p_nom_client, 'Client'),
      COALESCE(p_prenom_client, ''),
      p_email_client,
      p_telephone_client,
      p_adresse_client,
      p_code_postal_client,
      p_ville_client,
      'actif',
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;

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
          'nom', COALESCE(p_nom_client, 'Client'),
          'prenom', COALESCE(p_prenom_client, ''),
          'role', v_role,
          'type', 'client'
        ),
        now(),
        now(),
        'authenticated',
        'authenticated'
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
        COALESCE(p_nom_client, 'Client'),
        COALESCE(p_prenom_client, ''),
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
        true,
        'actif',
        false
      )
    RETURNING id INTO v_espace_membre_id;

    v_email_final := p_email_client;

    -- Synchroniser les modules de base si pas de plan
    IF p_plan_id IS NULL THEN
      UPDATE espaces_membres_clients
        SET modules_actifs = jsonb_build_object(
          'tableau_de_bord', true,
          'mon_entreprise', true,
          'factures', true,
          'documents', true
      )
      WHERE id = v_espace_membre_id;
    END IF;
  END IF;

  -- 4. Si un plan est fourni, créer l'abonnement
  IF p_plan_id IS NOT NULL THEN
    -- Vérifier que le plan existe et est actif
    IF EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
      -- La table abonnements nécessite user_id (NOT NULL)
      -- Utiliser v_user_id (créateur de l'entreprise)
      INSERT INTO abonnements (
        user_id,
        entreprise_id,
        plan_id,
        date_debut,
        date_fin,
        statut
      )
      VALUES (
        v_user_id,
        v_entreprise_id,
        p_plan_id,
        CURRENT_DATE,
        (CURRENT_DATE + interval '1 year')::date,
        'actif'
      )
      RETURNING id INTO v_abonnement_id;
      RETURNING id INTO v_abonnement_id;

      -- Lier l'abonnement à l'espace membre si créé
      IF v_espace_membre_id IS NOT NULL THEN
        UPDATE espaces_membres_clients
        SET abonnement_id = v_abonnement_id
        WHERE id = v_espace_membre_id;
      END IF;

      -- Synchroniser les modules du plan
      IF v_espace_membre_id IS NOT NULL THEN
        PERFORM sync_client_modules_from_plan(v_espace_membre_id);
      END IF;

      -- Ajouter les options si fournies
      IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
        INSERT INTO abonnement_options (abonnement_id, option_id)
        SELECT v_abonnement_id, unnest(p_options_ids)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- 5. Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'entreprise_nom', p_nom_entreprise,
    'client_id', v_client_id,
    'espace_membre_id', v_espace_membre_id,
    'abonnement_id', v_abonnement_id,
    'email', v_email_final,
    'password', CASE WHEN v_espace_membre_id IS NOT NULL THEN v_password ELSE NULL END,
    'message', 'Entreprise créée avec succès'
  );

  -- 6. Envoyer l'email si demandé et si un espace membre a été créé
  IF p_envoyer_email AND v_espace_membre_id IS NOT NULL AND v_email_final IS NOT NULL THEN
    -- L'envoi d'email sera géré par le frontend via l'Edge Function
    -- On ajoute juste un flag dans le résultat
    v_result := v_result || jsonb_build_object(
      'email_envoye', false,
      'email_a_envoyer', true
    );
  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'message', 'Erreur lors de la création automatisée de l''entreprise'
  );
END;
$$;

-- Commentaire
COMMENT ON FUNCTION create_complete_entreprise_automated IS 
'Crée automatiquement une entreprise complète avec client, espace membre, abonnement et modules. Retourne les identifiants pour l''envoi d''email.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_complete_entreprise_automated TO authenticated;

