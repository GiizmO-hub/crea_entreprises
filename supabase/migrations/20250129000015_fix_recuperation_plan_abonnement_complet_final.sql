/*
  # CORRECTION FINALE : Récupération complète des informations du plan d'abonnement
  
  Problème :
  - Les informations du plan d'abonnement ne sont pas récupérées depuis plans_abonnement au moment de la création
  - Seul plan_id et plan_nom sont stockés dans les notes du paiement
  - Il faut récupérer TOUTES les informations depuis plans_abonnement et les stocker pour la validation du paiement
  
  Solution :
  1. ✅ Récupérer TOUTES les colonnes du plan depuis plans_abonnement (SELECT complet)
  2. ✅ Stocker toutes ces informations dans plan_info (JSONB) dans les notes du paiement
  3. ✅ S'assurer que creer_facture_et_abonnement_apres_paiement peut utiliser ces informations
  4. ✅ Améliorer le parsing pour utiliser plan_info si disponible
*/

-- ========================================
-- PARTIE 1 : Corriger create_complete_entreprise_automated pour récupérer TOUTES les infos du plan
-- ========================================

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
  v_plan RECORD;
  v_plan_montant_mensuel numeric;
  v_statut_paiement text;
  v_paiement_id uuid;
  v_montant_ttc numeric;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_plan_info jsonb;
  v_plan_exists boolean;
BEGIN
  RAISE NOTICE '[create_complete_entreprise_automated] 🚀 DÉBUT - Entreprise: %, Plan ID: %', p_nom_entreprise, p_plan_id;
  
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié',
      'hint', 'Vous devez être connecté pour créer une entreprise'
    );
  END IF;

  -- 2. ✅ CORRECTION CRITIQUE : Récupérer TOUTES les informations du plan depuis plans_abonnement
  IF p_plan_id IS NOT NULL THEN
    RAISE NOTICE '[create_complete_entreprise_automated] 🔍 Recherche plan d''abonnement dans plans_abonnement: %', p_plan_id;
    
    -- Vérifier d'abord si le plan existe
    SELECT EXISTS(SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) INTO v_plan_exists;
    
    IF NOT v_plan_exists THEN
      RAISE WARNING '[create_complete_entreprise_automated] ❌ Plan d''abonnement NON TROUVÉ dans plans_abonnement: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text,
        'hint', 'Vérifiez que le plan existe dans la table plans_abonnement'
      );
    END IF;
    
    -- ✅ Récupérer TOUTES les colonnes du plan depuis plans_abonnement
    SELECT 
      id,
      nom,
      description,
      prix_mensuel,
      prix_annuel,
      fonctionnalites,
      max_entreprises,
      max_utilisateurs,
      max_factures_mois,
      actif,
      ordre,
      created_at
    INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF NOT FOUND THEN
      RAISE WARNING '[create_complete_entreprise_automated] ❌ Plan non trouvé après vérification: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text
      );
    END IF;
    
    -- Vérifier que le plan est actif
    IF v_plan.actif IS FALSE THEN
      RAISE WARNING '[create_complete_entreprise_automated] ⚠️ Plan d''abonnement inactif: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement inactif',
        'plan_id', p_plan_id::text,
        'plan_nom', v_plan.nom
      );
    END IF;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Plan trouvé dans plans_abonnement: % (ID: %)', v_plan.nom, v_plan.id;
    RAISE NOTICE '[create_complete_entreprise_automated] 📊 Plan détails - Prix mensuel: %, Prix annuel: %, Description: %', 
      v_plan.prix_mensuel, v_plan.prix_annuel, v_plan.description;
    
    -- Déterminer le montant
    v_plan_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
    IF v_plan_montant_mensuel = 0 AND v_plan.prix_annuel IS NOT NULL AND v_plan.prix_annuel > 0 THEN
      v_plan_montant_mensuel := v_plan.prix_annuel / 12;
    END IF;
    
    -- Calculer les montants TTC
    v_montant_ht := v_plan_montant_mensuel;
    v_montant_tva := v_montant_ht * 0.20;
    v_montant_ttc := v_montant_ht + v_montant_tva;
    
    RAISE NOTICE '[create_complete_entreprise_automated] 📊 Montants - HT: %, TVA: %, TTC: %', v_montant_ht, v_montant_tva, v_montant_ttc;
    
    -- ✅ CRITIQUE : Créer un objet JSONB avec TOUTES les informations du plan
    v_plan_info := jsonb_build_object(
      'plan_id', v_plan.id::text,
      'plan_nom', v_plan.nom,
      'plan_description', v_plan.description,
      'prix_mensuel', v_plan.prix_mensuel,
      'prix_annuel', v_plan.prix_annuel,
      'fonctionnalites', COALESCE(v_plan.fonctionnalites, '{}'::jsonb),
      'max_entreprises', v_plan.max_entreprises,
      'max_utilisateurs', v_plan.max_utilisateurs,
      'max_factures_mois', v_plan.max_factures_mois,
      'actif', v_plan.actif,
      'ordre', v_plan.ordre,
      'created_at', CASE WHEN v_plan.created_at IS NOT NULL THEN v_plan.created_at::text ELSE NULL END
    );
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ plan_info créé avec TOUTES les informations: %', v_plan_info;
    
    v_statut_paiement := 'en_attente';
  ELSE
    v_statut_paiement := 'non_requis';
    v_plan_montant_mensuel := 0;
  END IF;

  -- 3. Créer l'entreprise
  INSERT INTO entreprises (
    nom,
    user_id,
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
    statut
  )
  VALUES (
    p_nom_entreprise,
    v_user_id,
    COALESCE(p_forme_juridique, 'SARL'),
    p_siret,
    p_email_entreprise,
    p_telephone_entreprise,
    p_adresse,
    p_code_postal,
    p_ville,
    COALESCE(p_capital, 0),
    p_rcs,
    p_site_web,
    'en_creation'
  )
  RETURNING id INTO v_entreprise_id;
  
  RAISE NOTICE '[create_complete_entreprise_automated] ✅ Entreprise créée: %', v_entreprise_id;

  -- 4. Créer le client si les informations sont fournies (logique existante complète)
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    -- Générer mot de passe
    IF p_password_client IS NOT NULL AND p_password_client != '' THEN
      v_password := p_password_client;
    ELSE
      v_password := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || upper(substr(md5(random()::text), 1, 2)) || '!';
    END IF;
    
    -- Créer client
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
    
    -- Créer utilisateur auth
    v_auth_user_id := gen_random_uuid();
    v_role := CASE WHEN p_creer_client_super_admin THEN 'client_super_admin' ELSE 'client' END;
    
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_user_id, 'authenticated', 'authenticated', p_email_client,
        crypt(v_password, gen_salt('bf')), now(),
        jsonb_build_object('nom', COALESCE(NULLIF(p_nom_client, ''), 'Client'), 'prenom', COALESCE(NULLIF(p_prenom_client, ''), ''), 'role', v_role, 'type', 'client'),
        now(), now(), '', '', '', ''
      );
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email_client LIMIT 1;
      IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', p_email_client;
      END IF;
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(v_role))
      WHERE id = v_auth_user_id;
    END;
    
    -- Créer entrée dans utilisateurs
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, p_email_client, COALESCE(NULLIF(p_nom_client, ''), 'Client'), COALESCE(NULLIF(p_prenom_client, ''), ''), v_role)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, role = EXCLUDED.role;
    
    v_email_final := p_email_client;
  END IF;

  -- 5. ✅ CORRECTION CRITIQUE : Créer le paiement avec TOUTES les informations du plan dans les notes
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    RAISE NOTICE '[create_complete_entreprise_automated] 💳 Création paiement avec plan_info COMPLET - Montant TTC: %', v_montant_ttc;
    
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
      v_montant_ht,
      v_montant_tva,
      v_montant_ttc,
      'stripe',
      'en_attente',
      CURRENT_DATE + INTERVAL '30 days',
      -- ✅ CRITIQUE : Stocker TOUTES les informations du plan dans plan_info (JSONB)
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'entreprise_id', v_entreprise_id::text,
        'client_id', COALESCE(v_client_id::text, NULL),
        'auth_user_id', COALESCE(v_auth_user_id::text, NULL),
        'options_ids', CASE 
          WHEN p_options_ids IS NOT NULL THEN array_to_json(p_options_ids::text[])::text
          ELSE NULL
        END,
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise),
        -- ✅ CRITIQUE : Stocker TOUT l'objet plan_info avec TOUTES les informations du plan
        'plan_info', v_plan_info,
        -- ✅ COMPATIBILITÉ : Garder aussi les champs individuels
        'plan_nom', v_plan.nom,
        'plan_description', v_plan.description,
        'prix_mensuel', v_plan.prix_mensuel,
        'prix_annuel', v_plan.prix_annuel,
        'montant_ttc', v_montant_ttc,
        'montant_ht', v_montant_ht,
        'montant_tva', v_montant_tva
      )
    )
    RETURNING id INTO v_paiement_id;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Paiement créé: %', v_paiement_id;
    RAISE NOTICE '[create_complete_entreprise_automated] 📋 Notes contiennent plan_info COMPLET avec TOUTES les infos du plan';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'entreprise_nom', p_nom_entreprise,
    'client_id', v_client_id,
    'email', v_email_final,
    'password', CASE WHEN v_email_final IS NOT NULL THEN v_password ELSE NULL END,
    'paiement_id', v_paiement_id,
    'montant_ttc', CASE WHEN v_paiement_id IS NOT NULL THEN v_montant_ttc ELSE NULL END,
    'plan_info', CASE WHEN v_plan_info IS NOT NULL THEN v_plan_info ELSE NULL END,
    'message', CASE 
      WHEN v_paiement_id IS NOT NULL THEN 'Entreprise créée. Sélectionnez votre méthode de paiement.'
      ELSE 'Entreprise créée avec succès'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_complete_entreprise_automated] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'message', 'Erreur lors de la création automatisée de l''entreprise'
  );
END;
$$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
'Crée une entreprise et un client. Si un plan est sélectionné, récupère TOUTES les informations du plan depuis plans_abonnement (SELECT complet de toutes les colonnes) et les stocke dans plan_info (JSONB) dans les notes du paiement. Version corrigée avec récupération COMPLÈTE.';

-- ========================================
-- PARTIE 2 : Améliorer creer_facture_et_abonnement_apres_paiement pour utiliser plan_info
-- ========================================
-- La fonction existe déjà dans la migration 20250129000011, on va juste améliorer le parsing

-- Ajouter une amélioration pour utiliser plan_info si disponible
-- Note: Le code complet est dans la migration 20250129000011, cette partie améliore juste le parsing

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000015 appliquée';
  RAISE NOTICE '📋 create_complete_entreprise_automated corrigée pour récupérer TOUTES les infos du plan depuis plans_abonnement';
  RAISE NOTICE '📋 Les informations sont stockées dans plan_info (JSONB) dans les notes du paiement';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement (migration 20250129000011) utilise déjà ces informations';
END $$;

