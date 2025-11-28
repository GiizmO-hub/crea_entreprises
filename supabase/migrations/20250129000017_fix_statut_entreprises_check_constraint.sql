/*
  # CORRECTION : Contrainte CHECK sur entreprises.statut
  
  Problème :
  - Erreur: "new row for relation "entreprises" violates check constraint "entreprises_statut_check""
  - La fonction create_complete_entreprise_automated essaie d'insérer statut = 'en_creation'
  - Mais la contrainte CHECK autorise uniquement: ('active', 'suspendue', 'radiee')
  
  Solution :
  1. Vérifier la contrainte actuelle
  2. Soit modifier la contrainte pour accepter 'en_creation', soit utiliser 'active'
  3. Corriger create_complete_entreprise_automated pour utiliser une valeur valide
*/

-- ========================================
-- PARTIE 1 : Vérifier et corriger la contrainte CHECK
-- ========================================

-- Vérifier quelle contrainte existe actuellement
DO $$
DECLARE
  v_constraint_name text;
  v_constraint_def text;
BEGIN
  SELECT conname, pg_get_constraintdef(oid) 
  INTO v_constraint_name, v_constraint_def
  FROM pg_constraint 
  WHERE conrelid = 'entreprises'::regclass 
    AND contype = 'c'
    AND conname LIKE '%statut%';
  
  IF v_constraint_name IS NOT NULL THEN
    RAISE NOTICE '📋 Contrainte CHECK actuelle: % = %', v_constraint_name, v_constraint_def;
  ELSE
    RAISE NOTICE '⚠️ Aucune contrainte CHECK trouvée sur entreprises.statut';
  END IF;
END $$;

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_statut_check;

-- Créer/modifier la contrainte pour accepter 'en_creation' également
DO $$
BEGIN
  ALTER TABLE entreprises 
  ADD CONSTRAINT entreprises_statut_check 
  CHECK (statut IN ('active', 'suspendue', 'radiee', 'en_creation'));
  
  RAISE NOTICE '✅ Contrainte CHECK mise à jour pour accepter: active, suspendue, radiee, en_creation';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ Contrainte entreprises_statut_check existe déjà';
END $$;

-- ========================================
-- PARTIE 2 : Corriger create_complete_entreprise_automated pour utiliser 'active' par défaut
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

  -- 2. Récupérer le plan avec sélection adaptative des colonnes
  IF p_plan_id IS NOT NULL THEN
    RAISE NOTICE '[create_complete_entreprise_automated] 🔍 Recherche plan d''abonnement: %', p_plan_id;
    
    SELECT EXISTS(SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) INTO v_plan_exists;
    
    IF NOT v_plan_exists THEN
      RAISE WARNING '[create_complete_entreprise_automated] ❌ Plan d''abonnement NON TROUVÉ: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text
      );
    END IF;
    
    -- Sélectionner uniquement les colonnes de base
    SELECT 
      id, nom, description, prix_mensuel, prix_annuel,
      COALESCE(fonctionnalites, '{}'::jsonb) as fonctionnalites,
      COALESCE(max_entreprises, 1) as max_entreprises,
      COALESCE(max_utilisateurs, 1) as max_utilisateurs,
      COALESCE(actif, true) as actif,
      COALESCE(ordre, 0) as ordre,
      created_at
    INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Plan d''abonnement non trouvé', 'plan_id', p_plan_id::text);
    END IF;
    
    IF v_plan.actif IS FALSE THEN
      RETURN jsonb_build_object('success', false, 'error', 'Plan d''abonnement inactif', 'plan_id', p_plan_id::text, 'plan_nom', v_plan.nom);
    END IF;
    
    v_plan_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
    IF v_plan_montant_mensuel = 0 AND v_plan.prix_annuel IS NOT NULL AND v_plan.prix_annuel > 0 THEN
      v_plan_montant_mensuel := v_plan.prix_annuel / 12;
    END IF;
    
    v_montant_ht := v_plan_montant_mensuel;
    v_montant_tva := v_montant_ht * 0.20;
    v_montant_ttc := v_montant_ht + v_montant_tva;
    
    v_plan_info := jsonb_build_object(
      'plan_id', v_plan.id::text,
      'plan_nom', v_plan.nom,
      'plan_description', v_plan.description,
      'prix_mensuel', v_plan.prix_mensuel,
      'prix_annuel', v_plan.prix_annuel,
      'fonctionnalites', v_plan.fonctionnalites,
      'max_entreprises', v_plan.max_entreprises,
      'max_utilisateurs', v_plan.max_utilisateurs,
      'actif', v_plan.actif,
      'ordre', v_plan.ordre,
      'created_at', CASE WHEN v_plan.created_at IS NOT NULL THEN v_plan.created_at::text ELSE NULL END
    );
    
    v_statut_paiement := 'en_attente';
  ELSE
    v_statut_paiement := 'non_requis';
    v_plan_montant_mensuel := 0;
  END IF;

  -- 3. ✅ CORRECTION : Créer l'entreprise avec statut = 'active' (valeur autorisée par la contrainte CHECK)
  INSERT INTO entreprises (
    nom, user_id, forme_juridique, siret, email, telephone,
    adresse, code_postal, ville, capital, rcs, site_web, statut
  )
  VALUES (
    p_nom_entreprise, v_user_id, COALESCE(p_forme_juridique, 'SARL'), p_siret,
    p_email_entreprise, p_telephone_entreprise, p_adresse, p_code_postal, p_ville,
    COALESCE(p_capital, 0), p_rcs, p_site_web,
    'active'  -- ✅ CORRECTION : Utiliser 'active' au lieu de 'en_creation'
  )
  RETURNING id INTO v_entreprise_id;

  -- 4. Créer le client si les informations sont fournies
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    IF p_password_client IS NOT NULL AND p_password_client != '' THEN
      v_password := p_password_client;
    ELSE
      v_password := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || upper(substr(md5(random()::text), 1, 2)) || '!';
    END IF;
    
    INSERT INTO clients (
      entreprise_id, nom, prenom, email, telephone,
      adresse, code_postal, ville, statut, entreprise_nom
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
    END;
    
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, p_email_client, COALESCE(NULLIF(p_nom_client, ''), 'Client'), COALESCE(NULLIF(p_prenom_client, ''), ''), v_role)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, role = EXCLUDED.role;
    
    v_email_final := p_email_client;
  END IF;

  -- 5. Créer le paiement avec plan_info
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    INSERT INTO paiements (
      user_id, entreprise_id, type_paiement,
      montant_ht, montant_tva, montant_ttc,
      methode_paiement, statut, date_echeance, notes
    )
    VALUES (
      v_user_id, v_entreprise_id, 'autre',
      v_montant_ht, v_montant_tva, v_montant_ttc,
      'stripe', 'en_attente', CURRENT_DATE + INTERVAL '30 days',
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
        'plan_info', v_plan_info,
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
'Crée une entreprise et un client. Si un plan est sélectionné, récupère les informations du plan depuis plans_abonnement. CORRECTION: Utilise statut = ''active'' qui est une valeur autorisée par la contrainte CHECK.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000017 appliquée';
  RAISE NOTICE '📋 Contrainte CHECK entreprises.statut mise à jour pour accepter: active, suspendue, radiee, en_creation';
  RAISE NOTICE '📋 create_complete_entreprise_automated corrigée pour utiliser statut = ''active''';
END $$;

