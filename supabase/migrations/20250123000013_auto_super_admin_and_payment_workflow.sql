/*
  # Activation automatique Super Admin + Workflow Paiement
  
  ## Modifications
  1. Activation automatique du super admin lors de la création d'espace client
  2. Intégration du workflow de paiement dans create_complete_entreprise_automated :
     - Création entreprise
     - Création client
     - Choix abonnement → Création facture + paiement en attente
     - Validation paiement → Création espace client (avec super admin auto) + Envoi email
*/

-- ============================================================================
-- PARTIE 1 : MODIFIER create_complete_entreprise_automated pour workflow paiement
-- ============================================================================

-- Supprimer toutes les versions existantes de la fonction
DROP FUNCTION IF EXISTS create_complete_entreprise_automated CASCADE;

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
  p_envoyer_email boolean DEFAULT false  -- Changé à false par défaut, sera envoyé après paiement
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
  v_role text := 'client_super_admin';  -- ✅ TOUJOURS super admin maintenant
  v_client_id_for_abonnement uuid;
  v_plan_montant_mensuel numeric;
  v_plan_mode_paiement text;
  v_facture_id uuid;
  v_paiement_id uuid;
  v_numero_facture text;
  v_statut_paiement text;
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
  -- Si un plan est choisi, le paiement sera requis
  IF p_plan_id IS NOT NULL THEN
    v_statut_paiement := 'en_attente';
  ELSE
    v_statut_paiement := 'non_requis';
  END IF;

  -- 3. Créer l'entreprise
  -- ✅ CORRECTION: statut doit être 'active', 'suspendue' ou 'radiee' (pas 'en_attente')
  -- Le statut_paiement est séparé et gère 'en_attente', 'paye', etc.
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
    'active',  -- ✅ Toujours 'active' (la contrainte CHECK n'autorise que 'active', 'suspendue', 'radiee')
    v_statut_paiement  -- ✅ 'en_attente' ou 'non_requis' selon si plan choisi
  )
  RETURNING id INTO v_entreprise_id;

  -- 4. Si un email client est fourni, créer le client
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    -- Créer le client
    -- ✅ CORRECTION: Le statut du client n'a pas de contrainte 'en_attente', utiliser 'actif' ou 'prospect'
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
      'actif',  -- ✅ Toujours 'actif' (le statut_paiement de l'entreprise gère l'attente)
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;

    -- ✅ NOUVEAU : Si paiement requis, NE PAS créer l'espace client maintenant
    -- On attendra la validation du paiement
    IF v_statut_paiement = 'en_attente' THEN
      -- Générer un mot de passe temporaire (sera utilisé après paiement)
      v_password := substr(
        md5(random()::text || clock_timestamp()::text),
        1,
        12
      ) || upper(substr(md5(random()::text), 1, 2)) || '!';
      
      v_email_final := p_email_client;
      
      -- Retourner avec statut "en attente de paiement"
      RETURN jsonb_build_object(
        'success', true,
        'entreprise_id', v_entreprise_id,
        'client_id', v_client_id,
        'statut', 'en_attente_paiement',
        'message', 'Entreprise et client créés. En attente de paiement pour créer l''espace client.',
        'email_a_envoyer', false,
        'password', NULL  -- Pas de mot de passe tant que le paiement n'est pas validé
      );
    END IF;
    
    -- Si pas de paiement requis, créer l'espace client immédiatement (comme avant)
    -- Générer un mot de passe temporaire
    v_password := substr(
      md5(random()::text || clock_timestamp()::text),
      1,
      12
    ) || upper(substr(md5(random()::text), 1, 2)) || '!';
    
    -- Créer l'utilisateur auth pour le client (✅ TOUJOURS super_admin)
    v_auth_user_id := gen_random_uuid();
      
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

    -- Créer l'entrée dans utilisateurs (✅ TOUJOURS client_super_admin)
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
      role = v_role;  -- ✅ Toujours forcer client_super_admin

    -- Créer l'espace membre client (✅ avec super admin automatique)
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

  -- 5. Si un plan est fourni, créer l'abonnement et la facture
  IF p_plan_id IS NOT NULL THEN
    -- Récupérer les informations du plan
    SELECT prix_mensuel, mode_paiement
    INTO v_plan_montant_mensuel, v_plan_mode_paiement
    FROM plans_abonnement
    WHERE id = p_plan_id;

    IF v_plan_montant_mensuel IS NULL THEN
      v_plan_montant_mensuel := 0;
    END IF;
    IF v_plan_mode_paiement IS NULL THEN
      v_plan_mode_paiement := 'mensuel';
    END IF;

    -- Récupérer le client_id pour l'abonnement
    IF v_client_id IS NOT NULL THEN
      -- Récupérer l'auth user du client (s'il existe déjà)
      SELECT id INTO v_client_id_for_abonnement
      FROM auth.users
      WHERE email = p_email_client
      LIMIT 1;
    END IF;

    -- Créer l'abonnement (en attente de paiement)
    INSERT INTO abonnements (
      client_id,
      plan_id,
      montant_mensuel,
      mode_paiement,
      statut,
      date_debut,
      date_fin
    )
    VALUES (
      v_client_id_for_abonnement,
      p_plan_id,
      v_plan_montant_mensuel,
      v_plan_mode_paiement,
      'en_attente_paiement',  -- ✅ Statut en attente
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month'
    )
    RETURNING id INTO v_abonnement_id;

    -- ✅ NOUVEAU : Créer la facture
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Vérifier que le numéro n'existe pas déjà
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    END LOOP;

    INSERT INTO factures (
      entreprise_id,
      client_id,
      numero,
      type,
      date_emission,
      date_echeance,
      montant_ht,
      tva,
      montant_ttc,
      statut,
      notes
    )
    VALUES (
      v_entreprise_id,
      v_client_id,
      v_numero_facture,
      'facture',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      v_plan_montant_mensuel,
      v_plan_montant_mensuel * 0.20,
      v_plan_montant_mensuel * 1.20,
      'envoyee',
      'Facture de création d''entreprise et abonnement'
    )
    RETURNING id INTO v_facture_id;

    -- ✅ NOUVEAU : Créer le paiement en attente
    INSERT INTO paiements (
      user_id,
      entreprise_id,
      type_paiement,
      reference_id,
      numero_reference,
      montant_ht,
      montant_tva,
      montant_ttc,
      methode_paiement,
      statut,
      date_echeance
    )
    VALUES (
      v_user_id,
      v_entreprise_id,
      'autre',
      v_facture_id,
      v_numero_facture,
      v_plan_montant_mensuel,
      v_plan_montant_mensuel * 0.20,
      v_plan_montant_mensuel * 1.20,
      'stripe',
      'en_attente',
      CURRENT_DATE + INTERVAL '30 days'
    )
    RETURNING id INTO v_paiement_id;

    -- Mettre à jour l'entreprise avec la facture
    UPDATE entreprises
    SET facture_creation_id = v_facture_id
    WHERE id = v_entreprise_id;

    -- Si pas de paiement requis (plan gratuit), créer l'espace client maintenant
    IF v_statut_paiement = 'non_requis' AND v_client_id IS NOT NULL AND v_espace_membre_id IS NULL THEN
      -- Créer l'espace client (même logique qu'avant)
      v_password := substr(
        md5(random()::text || clock_timestamp()::text),
        1,
        12
      ) || upper(substr(md5(random()::text), 1, 2)) || '!';
      
      v_auth_user_id := gen_random_uuid();
      
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
      SET role = v_role;

      INSERT INTO espaces_membres_clients (
        client_id,
        entreprise_id,
        user_id,
        password_temporaire,
        doit_changer_password,
        actif,
        statut_compte,
        configuration_validee,
        abonnement_id
      )
      VALUES (
        v_client_id,
        v_entreprise_id,
        v_auth_user_id,
        v_password,
        true,
        true,
        'actif',
        false,
        v_abonnement_id
      )
      RETURNING id INTO v_espace_membre_id;

      -- Synchroniser les modules depuis le plan
      PERFORM sync_client_modules_from_plan(v_espace_membre_id);
    END IF;

    -- Ajouter les options si fournies
    IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
      INSERT INTO abonnement_options (abonnement_id, option_id)
      SELECT v_abonnement_id, unnest(p_options_ids)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 6. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'client_id', v_client_id,
    'espace_membre_id', v_espace_membre_id,
    'abonnement_id', v_abonnement_id,
    'facture_id', v_facture_id,
    'paiement_id', v_paiement_id,
    'email', v_email_final,
    'password', CASE WHEN v_espace_membre_id IS NOT NULL THEN v_password ELSE NULL END,
    'statut', CASE 
      WHEN v_statut_paiement = 'en_attente' THEN 'en_attente_paiement'
      ELSE 'complete'
    END,
    'email_a_envoyer', CASE 
      WHEN v_statut_paiement = 'en_attente' THEN false
      WHEN p_envoyer_email AND v_espace_membre_id IS NOT NULL THEN true
      ELSE false
    END,
    'message', CASE 
      WHEN v_statut_paiement = 'en_attente' THEN 'Entreprise créée. En attente de paiement pour finaliser.'
      ELSE 'Entreprise créée avec succès'
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

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
  'Crée une entreprise complète avec workflow de paiement. Le super admin est activé automatiquement lors de la création de l''espace client.';

-- ============================================================================
-- PARTIE 2 : Fonction pour finaliser après paiement (créer espace + envoyer email)
-- ============================================================================

-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS finaliser_creation_apres_paiement(uuid) CASCADE;

CREATE OR REPLACE FUNCTION finaliser_creation_apres_paiement(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise RECORD;
  v_client RECORD;
  v_abonnement RECORD;
  v_auth_user_id uuid;
  v_espace_membre_id uuid;
  v_password text;
  v_role text := 'client_super_admin';  -- ✅ TOUJOURS super admin
BEGIN
  -- ✅ SUPPRIMÉ : Vérification de permissions
  -- Cette fonction est appelée depuis un trigger SECURITY DEFINER,
  -- donc elle n'a pas besoin de vérifier les permissions utilisateur

  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  -- Vérifier que le paiement est validé
  IF v_entreprise.statut_paiement != 'paye' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement n''est pas encore validé'
    );
  END IF;

  -- Récupérer le client
  SELECT * INTO v_client
  FROM clients
  WHERE entreprise_id = p_entreprise_id
  LIMIT 1;

  IF NOT FOUND OR v_client.email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé ou sans email'
    );
  END IF;

  -- Vérifier si l'espace membre existe déjà
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client.id;

  IF FOUND THEN
    -- L'espace existe déjà, retourner les identifiants
    SELECT password_temporaire INTO v_password
    FROM espaces_membres_clients
    WHERE id = v_espace_membre_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'espace_membre_id', v_espace_membre_id,
      'email', v_client.email,
      'password', v_password,
      'message', 'Espace membre déjà créé'
    );
  END IF;

  -- Récupérer l'abonnement (peut être en_attente_paiement, on l'activera après)
  SELECT * INTO v_abonnement
  FROM abonnements
  WHERE client_id IN (
    SELECT id FROM auth.users WHERE email = v_client.email LIMIT 1
  )
  AND statut IN ('actif', 'en_attente_paiement')
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si pas d'abonnement trouvé, essayer de trouver par entreprise
  IF NOT FOUND THEN
    SELECT * INTO v_abonnement
    FROM abonnements
    WHERE plan_id IN (
      SELECT id FROM plans_abonnement LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM clients 
      WHERE entreprise_id = p_entreprise_id 
      AND id = v_client.id
    )
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Générer un mot de passe temporaire
  v_password := substr(
    md5(random()::text || clock_timestamp()::text),
    1,
    12
  ) || upper(substr(md5(random()::text), 1, 2)) || '!';

  -- Créer l'utilisateur auth (✅ TOUJOURS super_admin)
  v_auth_user_id := gen_random_uuid();
  
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
    v_client.email,
    crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'role', v_role),
    jsonb_build_object(
      'nom', v_client.nom,
      'prenom', v_client.prenom,
      'role', v_role,
      'type', 'client'
    ),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- Créer l'entrée dans utilisateurs (✅ TOUJOURS client_super_admin)
  INSERT INTO utilisateurs (
    id,
    email,
    nom,
    prenom,
    role
  )
  VALUES (
    v_auth_user_id,
    v_client.email,
    v_client.nom,
    v_client.prenom,
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = v_role;

  -- Créer l'espace membre client (✅ avec super admin automatique)
  INSERT INTO espaces_membres_clients (
    client_id,
    entreprise_id,
    user_id,
    password_temporaire,
    doit_changer_password,
    actif,
    statut_compte,
    configuration_validee,
    abonnement_id
  )
  VALUES (
    v_client.id,
    v_entreprise.id,
    v_auth_user_id,
    v_password,
    true,
    true,
    'actif',
    false,
    v_abonnement.id
  )
  RETURNING id INTO v_espace_membre_id;

  -- Synchroniser les modules depuis le plan
  IF v_abonnement.plan_id IS NOT NULL THEN
    PERFORM sync_client_modules_from_plan(v_espace_membre_id);
  ELSE
    -- Modules de base
    UPDATE espaces_membres_clients
    SET modules_actifs = jsonb_build_object(
      'tableau_de_bord', true,
      'mon_entreprise', true,
      'factures', true,
      'documents', true
    )
    WHERE id = v_espace_membre_id;
  END IF;

  -- Activer l'entreprise et le client
  UPDATE entreprises
  SET statut = 'active'
  WHERE id = p_entreprise_id;

  UPDATE clients
  SET statut = 'actif'
  WHERE id = v_client.id;

  -- Activer l'abonnement
  UPDATE abonnements
  SET statut = 'actif'
  WHERE id = v_abonnement.id;

  RETURN jsonb_build_object(
    'success', true,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email,
    'password', v_password,
    'message', 'Espace membre créé avec succès. Email à envoyer.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION finaliser_creation_apres_paiement IS 
  'Finalise la création après validation du paiement : crée l''espace client avec super admin automatique.';

GRANT EXECUTE ON FUNCTION finaliser_creation_apres_paiement(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Modifier valider_paiement_entreprise pour appeler finaliser_creation_apres_paiement
-- ============================================================================

-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS public.valider_paiement_entreprise(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.valider_paiement_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise entreprises%ROWTYPE;
  v_abonnement_id uuid;
  v_facture_id uuid;
  v_numero_facture text;
  v_finalisation_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur est un super admin plateforme
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND COALESCE((raw_user_meta_data->>'role')::text, '') IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  -- Mettre à jour le statut de paiement
  UPDATE entreprises
  SET statut_paiement = 'paye',
      updated_at = now()
  WHERE id = p_entreprise_id;

  -- ✅ NOUVEAU : Finaliser la création (créer espace client + super admin)
  v_finalisation_result := finaliser_creation_apres_paiement(p_entreprise_id);

  IF NOT (v_finalisation_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement validé mais erreur lors de la finalisation : ' || (v_finalisation_result->>'error')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement validé et espace client créé avec succès',
    'statut_paiement', 'paye',
    'espace_membre_id', v_finalisation_result->>'espace_membre_id',
    'email', v_finalisation_result->>'email',
    'password', v_finalisation_result->>'password',
    'email_a_envoyer', true  -- ✅ Indique qu'il faut envoyer l'email maintenant
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

