/*
  # SOLUTION : Table provisoire pour stocker les données du workflow
  
  Problème :
  - Les informations du workflow (plan_id, entreprise_id, client_id, etc.) sont stockées dans notes (TEXT)
  - Le parsing est complexe et peut échouer
  - Difficulté à récupérer ces informations de manière fiable
  
  Solution :
  1. ✅ Créer une table provisoire workflow_data pour stocker toutes les infos nécessaires
  2. ✅ Modifier create_complete_entreprise_automated pour stocker les infos dans cette table
  3. ✅ Modifier creer_facture_et_abonnement_apres_paiement pour lire depuis cette table
  4. ✅ Nettoyer la table après traitement (ou garder pour historique)
*/

-- ========================================
-- PARTIE 1 : Créer la table workflow_data
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid NOT NULL REFERENCES paiements(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES plans_abonnement(id) ON DELETE SET NULL,
  plan_info jsonb, -- Toutes les infos du plan
  traite boolean DEFAULT false, -- Si le workflow a été traité
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(paiement_id) -- Un seul workflow_data par paiement
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_workflow_data_paiement_id ON workflow_data(paiement_id);
CREATE INDEX IF NOT EXISTS idx_workflow_data_entreprise_id ON workflow_data(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_workflow_data_traite ON workflow_data(traite);

-- RLS activé
ALTER TABLE workflow_data ENABLE ROW LEVEL SECURITY;

-- Politique RLS : les utilisateurs voient uniquement leurs données
CREATE POLICY "Users can view own workflow_data"
  ON workflow_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM paiements p
      WHERE p.id = workflow_data.paiement_id
      AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM entreprises e
      WHERE e.id = workflow_data.entreprise_id
      AND e.user_id = auth.uid()
    )
  );

-- Politique RLS : service role peut tout faire
CREATE POLICY "Service role can do everything"
  ON workflow_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Commentaire
COMMENT ON TABLE workflow_data IS 
  'Table provisoire pour stocker les données nécessaires au workflow de création d''entreprise (plan_id, entreprise_id, client_id, etc.). Simplifie la récupération des informations au lieu de parser les notes.';

-- ========================================
-- PARTIE 2 : Modifier create_complete_entreprise_automated
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

  -- 2. ✅ NOUVEAU : Récupérer les informations du plan depuis plans_abonnement
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
    
    -- Récupérer les colonnes du plan (uniquement celles qui existent)
    SELECT 
      id, nom, description, prix_mensuel, prix_annuel,
      fonctionnalites, max_entreprises, max_utilisateurs,
      actif, ordre, created_at
    INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text
      );
    END IF;
    
    IF v_plan.actif IS FALSE THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement inactif',
        'plan_id', p_plan_id::text,
        'plan_nom', v_plan.nom
      );
    END IF;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Plan trouvé: % (ID: %)', v_plan.nom, v_plan.id;
    
    v_plan_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
    IF v_plan_montant_mensuel = 0 AND v_plan.prix_annuel IS NOT NULL AND v_plan.prix_annuel > 0 THEN
      v_plan_montant_mensuel := v_plan.prix_annuel / 12;
    END IF;
    
    v_montant_ht := v_plan_montant_mensuel;
    v_montant_tva := v_montant_ht * 0.20;
    v_montant_ttc := v_montant_ht + v_montant_tva;
    
    -- Construire plan_info avec toutes les infos (uniquement colonnes existantes)
    v_plan_info := jsonb_build_object(
      'plan_id', v_plan.id::text,
      'plan_nom', v_plan.nom,
      'plan_description', v_plan.description,
      'prix_mensuel', v_plan.prix_mensuel,
      'prix_annuel', v_plan.prix_annuel,
      'fonctionnalites', COALESCE(v_plan.fonctionnalites, '{}'::jsonb),
      'max_entreprises', v_plan.max_entreprises,
      'max_utilisateurs', v_plan.max_utilisateurs,
      'actif', v_plan.actif,
      'ordre', v_plan.ordre
    );
    
    v_statut_paiement := 'en_attente';
  ELSE
    v_statut_paiement := 'non_requis';
    v_plan_montant_mensuel := 0;
  END IF;

  -- 3. Créer l'entreprise
  INSERT INTO entreprises (
    nom, user_id, forme_juridique, siret, email, telephone,
    adresse, code_postal, ville, capital, rcs, site_web, statut
  )
  VALUES (
    p_nom_entreprise, v_user_id, COALESCE(p_forme_juridique, 'SARL'),
    p_siret, p_email_entreprise, p_telephone_entreprise,
    p_adresse, p_code_postal, p_ville, COALESCE(p_capital, 0),
    p_rcs, p_site_web, 'en_creation'
  )
  RETURNING id INTO v_entreprise_id;
  
  RAISE NOTICE '[create_complete_entreprise_automated] ✅ Entreprise créée: %', v_entreprise_id;

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
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(v_role))
      WHERE id = v_auth_user_id;
    END;
    
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, p_email_client, COALESCE(NULLIF(p_nom_client, ''), 'Client'), COALESCE(NULLIF(p_prenom_client, ''), ''), v_role)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, role = EXCLUDED.role;
    
    v_email_final := p_email_client;
  END IF;

  -- 5. Créer le paiement
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    INSERT INTO paiements (
      user_id, entreprise_id, type_paiement,
      montant_ht, montant_tva, montant_ttc,
      methode_paiement, statut, date_echeance
    )
    VALUES (
      v_user_id, v_entreprise_id, 'autre',
      v_montant_ht, v_montant_tva, v_montant_ttc,
      'stripe', 'en_attente', CURRENT_DATE + INTERVAL '30 days'
    )
    RETURNING id INTO v_paiement_id;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Paiement créé: %', v_paiement_id;
    
    -- 6. ✅ NOUVEAU : Stocker toutes les infos dans workflow_data
    INSERT INTO workflow_data (
      paiement_id,
      entreprise_id,
      client_id,
      auth_user_id,
      plan_id,
      plan_info,
      traite
    )
    VALUES (
      v_paiement_id,
      v_entreprise_id,
      v_client_id,
      v_auth_user_id,
      p_plan_id,
      v_plan_info,
      false
    )
    ON CONFLICT (paiement_id) DO UPDATE
    SET entreprise_id = EXCLUDED.entreprise_id,
        client_id = EXCLUDED.client_id,
        auth_user_id = EXCLUDED.auth_user_id,
        plan_id = EXCLUDED.plan_id,
        plan_info = EXCLUDED.plan_info,
        traite = false,
        updated_at = now();
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Données stockées dans workflow_data pour paiement: %', v_paiement_id;
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

-- ========================================
-- PARTIE 3 : Modifier creer_facture_et_abonnement_apres_paiement
-- ========================================

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_workflow_data RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_plan_id uuid;
  v_plan RECORD;
  v_facture_id uuid;
  v_facture_existante uuid;
  v_numero_facture text;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
BEGIN
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Paiement trouvé - Statut: %, Entreprise: %, Montant: %', 
    v_paiement.statut, v_paiement.entreprise_id, v_paiement.montant_ttc;
  
  -- 2. ✅ NOUVEAU : Récupérer les données depuis workflow_data
  SELECT * INTO v_workflow_data
  FROM workflow_data
  WHERE paiement_id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ workflow_data non trouvé pour paiement: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Données du workflow non trouvées',
      'message', 'Les données nécessaires au workflow ne sont pas disponibles dans workflow_data'
    );
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data trouvé - Entreprise: %, Client: %, Plan: %', 
    v_workflow_data.entreprise_id, v_workflow_data.client_id, v_workflow_data.plan_id;
  
  -- 3. ✅ NOUVEAU : Utiliser les données de workflow_data directement
  v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_paiement.entreprise_id);
  v_client_id := v_workflow_data.client_id;
  v_auth_user_id := v_workflow_data.auth_user_id;
  v_plan_id := v_workflow_data.plan_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Données récupérées - Entreprise: %, Client: %, User: %, Plan: %', 
    v_entreprise_id, v_client_id, v_auth_user_id, v_plan_id;
  
  -- 4. Si entreprise_id toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant',
      'message', 'Paiement validé mais erreur lors de la création automatique'
    );
  END IF;
  
  -- 5. Vérifier si une facture existe déjà
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante: %', v_facture_existante;
    v_facture_id := v_facture_existante;
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
    
    -- Vérifier si l'abonnement existe déjà
    SELECT id INTO v_abonnement_id 
    FROM abonnements 
    WHERE facture_id = v_facture_id
    LIMIT 1;
    
    -- Si abonnement existe, retourner
    IF v_abonnement_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant: %', v_abonnement_id;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Facture et abonnement déjà créés',
        'facture_id', v_facture_id,
        'abonnement_id', v_abonnement_id,
        'already_exists', true,
        'entreprise_id', v_entreprise_id
      );
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture existe mais abonnement manquant - On continue';
    END IF;
  END IF;
  
  -- 6. Forcer le statut à 'paye' si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Statut paiement mis à jour à "paye"';
  END IF;
  
  -- 7. Extraire les montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  -- 8. Créer la facture si elle n'existe pas
  IF v_facture_id IS NULL THEN
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
    
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
    END LOOP;
    
    INSERT INTO factures (
      entreprise_id, client_id, numero, montant_ht, tva, montant_ttc,
      date_emission, date_echeance, statut, paiement_id
    )
    VALUES (
      v_entreprise_id, v_client_id, v_numero_facture,
      v_montant_ht, v_montant_tva, v_montant_ttc,
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'payee', p_paiement_id
    )
    RETURNING id, numero INTO v_facture_id, v_numero_facture;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  END IF;
  
  -- 9. Récupérer le plan
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
    IF NOT FOUND THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé', v_plan_id;
      v_plan_id := NULL;
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
    END IF;
  END IF;
  
  -- 10. ✅ CRÉER L'ABONNEMENT avec les données de workflow_data
  IF v_plan_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
    BEGIN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Création abonnement - Plan: %, User: %, Entreprise: %', 
        v_plan_id, v_auth_user_id, v_entreprise_id;
      
      INSERT INTO abonnements (
        entreprise_id, client_id, plan_id, 
        date_debut, date_fin, statut, facture_id
      )
      VALUES (
        v_entreprise_id, v_auth_user_id, v_plan_id,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif', v_facture_id
      )
      ON CONFLICT (entreprise_id, plan_id) DO UPDATE
      SET statut = 'actif', 
          date_debut = CURRENT_DATE, 
          date_fin = CURRENT_DATE + INTERVAL '1 month', 
          facture_id = v_facture_id,
          client_id = COALESCE(v_auth_user_id, abonnements.client_id)
      RETURNING id INTO v_abonnement_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé/mis à jour: %', v_abonnement_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création abonnement: % - %', SQLERRM, SQLSTATE;
        v_abonnement_id := NULL;
    END;
  ELSE
    IF v_plan_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL depuis workflow_data';
    END IF;
    IF v_auth_user_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Auth User ID NULL depuis workflow_data';
    END IF;
  END IF;
  
  -- 11. Créer l'espace membre
  IF v_client_id IS NOT NULL THEN
    BEGIN
      SELECT id INTO v_espace_membre_id
      FROM espaces_membres_clients
      WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id;
      
      IF v_espace_membre_id IS NULL THEN
        INSERT INTO espaces_membres_clients (
          client_id, entreprise_id, user_id, actif,
          modules_actifs, statut_compte, abonnement_id
        )
        VALUES (
          v_client_id, v_entreprise_id, v_auth_user_id, true,
          jsonb_build_object(
            'tableau_de_bord', true, 'mon_entreprise', true,
            'factures', true, 'documents', true, 'abonnements', true
          ),
          'actif', v_abonnement_id
        )
        RETURNING id INTO v_espace_membre_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
      ELSE
        UPDATE espaces_membres_clients
        SET actif = true,
            statut_compte = 'actif',
            user_id = COALESCE(v_auth_user_id, user_id),
            abonnement_id = COALESCE(v_abonnement_id, abonnement_id)
        WHERE id = v_espace_membre_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création espace membre: %', SQLERRM;
        v_espace_membre_id := NULL;
    END;
  END IF;
  
  -- 12. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND v_client_id IS NOT NULL;
  
  -- 13. Mettre à jour le rôle du client
  IF v_auth_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
        UPDATE utilisateurs
        SET role = 'client_super_admin'
        WHERE id = v_auth_user_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin mis à jour';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur mise à jour rôle: %', SQLERRM;
    END;
  END IF;
  
  -- 14. ✅ Marquer workflow_data comme traité
  UPDATE workflow_data
  SET traite = true, updated_at = now()
  WHERE paiement_id = p_paiement_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data marqué comme traité';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'entreprise_id', v_entreprise_id,
    'numero_facture', v_numero_facture,
    'plan_id', v_plan_id,
    'plan_id_found', v_plan_id IS NOT NULL,
    'auth_user_id', v_auth_user_id,
    'auth_user_id_found', v_auth_user_id IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'message', 'Paiement validé mais erreur lors de la création automatique'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. NOUVELLE VERSION : lit les données depuis workflow_data au lieu de parser les notes.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000023 appliquée';
  RAISE NOTICE '📋 Table workflow_data créée pour stocker les données du workflow';
  RAISE NOTICE '📋 create_complete_entreprise_automated modifiée pour stocker dans workflow_data';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement modifiée pour lire depuis workflow_data';
END $$;

