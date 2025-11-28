/*
  # Ajouter des logs détaillés dans toutes les fonctions RPC du workflow
  
  PROBLÈME:
  - Le workflow ne fonctionne pas mais tout est en place
  - Besoin de logs détaillés pour diagnostiquer où ça bloque
  
  SOLUTION:
  - Ajouter des RAISE NOTICE dans chaque étape critique
  - Logger les valeurs des variables importantes
  - Logger les résultats des opérations
  
  Les logs apparaîtront dans:
  - Supabase Dashboard → Logs
  - Ou via SELECT pg_stat_activity
*/

-- ============================================================================
-- PARTIE 1 : Ajouter des logs dans create_complete_entreprise_automated
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
BEGIN
  RAISE NOTICE '🚀 [create_complete_entreprise_automated] DÉBUT - Nom entreprise: %', p_nom_entreprise;
  
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  RAISE NOTICE '🔍 [create_complete_entreprise_automated] User ID: %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE WARNING '❌ [create_complete_entreprise_automated] Utilisateur non authentifié';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  -- 2. Déterminer le statut de paiement
  RAISE NOTICE '🔍 [create_complete_entreprise_automated] Vérification plan_id: %', p_plan_id;
  
  IF p_plan_id IS NOT NULL THEN
    SELECT prix_mensuel INTO v_plan_montant_mensuel
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    RAISE NOTICE '💰 [create_complete_entreprise_automated] Plan trouvé - Montant mensuel: %', v_plan_montant_mensuel;
    
    IF v_plan_montant_mensuel IS NULL THEN
      v_plan_montant_mensuel := 0;
      RAISE WARNING '⚠️ [create_complete_entreprise_automated] Plan non trouvé, montant = 0';
    END IF;
    
    IF v_plan_montant_mensuel > 0 THEN
      v_statut_paiement := 'en_attente';
      v_montant_ttc := v_plan_montant_mensuel * 1.20;
      RAISE NOTICE '💳 [create_complete_entreprise_automated] Paiement requis - Montant TTC: %', v_montant_ttc;
    ELSE
      v_statut_paiement := 'non_requis';
      RAISE NOTICE '✅ [create_complete_entreprise_automated] Pas de paiement requis (montant = 0)';
    END IF;
  ELSE
    v_statut_paiement := 'non_requis';
    RAISE NOTICE '✅ [create_complete_entreprise_automated] Pas de plan sélectionné, pas de paiement requis';
  END IF;

  -- 3. Créer l'entreprise
  RAISE NOTICE '📝 [create_complete_entreprise_automated] Création de l''entreprise...';
  
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

  RAISE NOTICE '✅ [create_complete_entreprise_automated] Entreprise créée - ID: %, Statut paiement: %', v_entreprise_id, v_statut_paiement;

  -- 4. Si un plan est choisi avec montant > 0, créer le paiement en attente
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    RAISE NOTICE '💳 [create_complete_entreprise_automated] Création du paiement en attente...';
    
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
      now(),
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'entreprise_id', v_entreprise_id::text,
        'client_id', NULL,
        'options_ids', COALESCE(p_options_ids::text[], ARRAY[]::text[]),
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise)
      )::text
    )
    RETURNING id INTO v_paiement_id;
    
    RAISE NOTICE '✅ [create_complete_entreprise_automated] Paiement créé - ID: %, Montant TTC: %', v_paiement_id, v_montant_ttc;
  END IF;

  -- 5. Si un email client est fourni, créer le client et l'espace membre
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    RAISE NOTICE '👤 [create_complete_entreprise_automated] Création du client - Email: %', p_email_client;
    
    -- Générer ou utiliser le mot de passe fourni
    IF p_password_client IS NOT NULL AND p_password_client != '' THEN
      v_password := p_password_client;
      RAISE NOTICE '🔑 [create_complete_entreprise_automated] Mot de passe fourni par l''utilisateur';
    ELSE
      -- Générer un mot de passe temporaire automatiquement
      v_password := substr(
        md5(random()::text || clock_timestamp()::text),
        1,
        12
      ) || upper(substr(md5(random()::text), 1, 2)) || '!';
      RAISE NOTICE '🔑 [create_complete_entreprise_automated] Mot de passe généré automatiquement';
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

    RAISE NOTICE '✅ [create_complete_entreprise_automated] Client créé - ID: %, Statut: %', 
      v_client_id, 
      CASE WHEN v_statut_paiement = 'en_attente' THEN 'en_attente' ELSE 'actif' END;

    -- Mettre à jour le paiement avec le client_id si créé
    IF v_paiement_id IS NOT NULL AND v_client_id IS NOT NULL THEN
      RAISE NOTICE '📝 [create_complete_entreprise_automated] Mise à jour du paiement avec client_id: %', v_client_id;
      
      UPDATE paiements
      SET notes = jsonb_set(
        COALESCE(notes::jsonb, '{}'::jsonb),
        '{client_id}',
        to_jsonb(v_client_id::text)
      )::text
      WHERE id = v_paiement_id;
    END IF;

    -- Créer l'utilisateur auth pour le client
    v_auth_user_id := gen_random_uuid();
    v_role := CASE WHEN p_creer_client_super_admin THEN 'client_super_admin' ELSE 'client' END;
    
    RAISE NOTICE '👤 [create_complete_entreprise_automated] Création utilisateur auth - ID: %, Rôle: %', v_auth_user_id, v_role;
      
    -- Vérifier si l'utilisateur existe déjà
    DECLARE
      v_existing_user_id uuid;
    BEGIN
      SELECT id INTO v_existing_user_id
      FROM auth.users
      WHERE email = p_email_client;
      
      IF v_existing_user_id IS NOT NULL THEN
        RAISE NOTICE 'ℹ️ [create_complete_entreprise_automated] Utilisateur auth existe déjà - ID: %', v_existing_user_id;
        v_auth_user_id := v_existing_user_id;
        
        -- Mettre à jour le rôle
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
          COALESCE(raw_user_meta_data, '{}'::jsonb),
          '{role}',
          to_jsonb(v_role)
        ),
        raw_app_meta_data = jsonb_set(
          COALESCE(raw_app_meta_data, '{}'::jsonb),
          '{role}',
          to_jsonb(v_role)
        ),
        updated_at = now()
        WHERE id = v_existing_user_id;
        
        RAISE NOTICE '✅ [create_complete_entreprise_automated] Utilisateur auth mis à jour avec rôle: %', v_role;
      ELSE
        -- Créer l'utilisateur dans auth.users
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
        );
        
        RAISE NOTICE '✅ [create_complete_entreprise_automated] Utilisateur auth créé - ID: %', v_auth_user_id;
      END IF;
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

    RAISE NOTICE '✅ [create_complete_entreprise_automated] Entrée utilisateurs créée/mise à jour';

    -- Créer l'espace membre client (en attente si paiement requis)
    DECLARE
      v_espace_id uuid;
      v_espace_statut text;
      v_espace_actif boolean;
    BEGIN
      v_espace_statut := CASE WHEN v_statut_paiement = 'en_attente' THEN 'en_attente' ELSE 'actif' END;
      v_espace_actif := CASE WHEN v_statut_paiement = 'en_attente' THEN false ELSE true END;
      
      RAISE NOTICE '🏠 [create_complete_entreprise_automated] Création espace membre - Statut: %, Actif: %', v_espace_statut, v_espace_actif;
      
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
        v_espace_actif,
        v_espace_statut,
        false
      )
      ON CONFLICT (client_id, entreprise_id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        password_temporaire = EXCLUDED.password_temporaire,
        doit_changer_password = true,
        actif = EXCLUDED.actif,
        statut_compte = EXCLUDED.statut_compte
      RETURNING id INTO v_espace_id;
      
      RAISE NOTICE '✅ [create_complete_entreprise_automated] Espace membre créé/mis à jour - ID: %', v_espace_id;
    END;

    v_email_final := p_email_client;
  END IF;

  -- 6. Construire le résultat
  RAISE NOTICE '📦 [create_complete_entreprise_automated] Construction du résultat...';
  RAISE NOTICE '   → entreprise_id: %', v_entreprise_id;
  RAISE NOTICE '   → client_id: %', v_client_id;
  RAISE NOTICE '   → paiement_id: %', v_paiement_id;
  RAISE NOTICE '   → montant_ttc: %', v_montant_ttc;
  
  RAISE NOTICE '✅ [create_complete_entreprise_automated] TERMINÉ AVEC SUCCÈS';
  
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
  RAISE WARNING '❌ [create_complete_entreprise_automated] ERREUR: % - %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'message', 'Erreur lors de la création automatisée de l''entreprise'
  );
END;
$$;

-- ============================================================================
-- PARTIE 2 : Ajouter des logs dans valider_paiement_carte_immediat
-- ============================================================================

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_old_statut text;
BEGIN
  RAISE NOTICE '🚀 [valider_paiement_carte_immediat] DÉBUT - Paiement ID: %, Stripe ID: %', p_paiement_id, p_stripe_payment_id;
  
  -- Récupérer le statut actuel
  SELECT statut INTO v_old_statut
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  RAISE NOTICE '📊 [valider_paiement_carte_immediat] Statut actuel: % → paye', v_old_statut;
  
  -- Marquer le paiement comme payé
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  RAISE NOTICE '🔄 [valider_paiement_carte_immediat] Le trigger va maintenant créer facture + abonnement + espace client automatiquement';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement par carte validé. Génération automatique en cours...'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- PARTIE 3 : Ajouter des logs dans le trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_creer_facture_abonnement_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_methode_paiement text;
BEGIN
  RAISE NOTICE '🔄 [trigger_creer_facture_abonnement_apres_paiement] DÉCLENCHÉ';
  RAISE NOTICE '   → Paiement ID: %', NEW.id;
  RAISE NOTICE '   → Ancien statut: %', COALESCE(OLD.statut::text, 'NULL');
  RAISE NOTICE '   → Nouveau statut: %', NEW.statut;
  RAISE NOTICE '   → Entreprise ID: %', NEW.entreprise_id;
  
  -- Si le paiement passe à "paye" (et n'était pas déjà payé)
  IF NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') THEN
    RAISE NOTICE '✅ [trigger_creer_facture_abonnement_apres_paiement] Paiement validé !';
    
    -- Vérifier que c'est un paiement pour une entreprise (a un entreprise_id)
    IF NEW.entreprise_id IS NOT NULL THEN
      RAISE NOTICE '🏢 [trigger_creer_facture_abonnement_apres_paiement] Entreprise ID trouvé: %', NEW.entreprise_id;
      
      v_methode_paiement := NEW.methode_paiement;
      RAISE NOTICE '💳 [trigger_creer_facture_abonnement_apres_paiement] Méthode de paiement: %', v_methode_paiement;
      
      -- Si virement, vérifier que 96h se sont écoulées
      IF v_methode_paiement = 'virement' THEN
        DECLARE
          v_heures_ecoulees numeric;
        BEGIN
          -- Calculer les heures écoulées depuis la création du paiement
          v_heures_ecoulees := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.date_creation_paiement, NEW.created_at))) / 3600;
          
          RAISE NOTICE '⏳ [trigger_creer_facture_abonnement_apres_paiement] Heures écoulées: % / 96', v_heures_ecoulees;
          
          IF v_heures_ecoulees < 96 THEN
            RAISE NOTICE '⏸️ [trigger_creer_facture_abonnement_apres_paiement] Pas encore 96h, traitement différé';
            RETURN NEW;
          END IF;
        END;
      END IF;
      
      -- Créer automatiquement facture + abonnement (carte immédiatement, virement après 96h)
      RAISE NOTICE '🏭 [trigger_creer_facture_abonnement_apres_paiement] Appel de creer_facture_et_abonnement_apres_paiement...';
      
      BEGIN
        v_result := creer_facture_et_abonnement_apres_paiement(NEW.id);
        
        -- Log le résultat
        IF NOT (v_result->>'success')::boolean THEN
          RAISE WARNING '❌ [trigger_creer_facture_abonnement_apres_paiement] Erreur: %', v_result->>'error';
        ELSE
          RAISE NOTICE '✅ [trigger_creer_facture_abonnement_apres_paiement] Succès !';
          RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
          RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
          RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ [trigger_creer_facture_abonnement_apres_paiement] Exception: % - %', SQLERRM, SQLSTATE;
      END;
    ELSE
      RAISE NOTICE '⚠️ [trigger_creer_facture_abonnement_apres_paiement] Pas d''entreprise_id, trigger ignoré';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ [trigger_creer_facture_abonnement_apres_paiement] Statut non changé ou déjà payé, rien à faire';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PARTIE 4 : Ajouter des logs dans creer_facture_et_abonnement_apres_paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_plan_id uuid;
  v_options_ids uuid[];
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_numero_facture text;
  v_montant_mensuel numeric;
  v_mode_paiement text := 'mensuel';
BEGIN
  RAISE NOTICE '🚀 [creer_facture_et_abonnement_apres_paiement] DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- Récupérer les informations du paiement
  SELECT 
    p.*,
    p.entreprise_id as ent_id,
    (p.notes::jsonb->>'plan_id')::uuid as plan_id_from_notes,
    (p.notes::jsonb->>'client_id')::text as client_id_from_notes,
    COALESCE(
      (SELECT array_agg(elem::uuid) FROM jsonb_array_elements_text(p.notes::jsonb->'options_ids') elem),
      ARRAY[]::uuid[]
    ) as options_ids_from_notes
  INTO v_paiement
  FROM paiements p
  WHERE p.id = p_paiement_id;

  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  RAISE NOTICE '📊 [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Statut: %, Entreprise ID: %', 
    v_paiement.statut, v_paiement.entreprise_id;

  IF v_paiement.statut != 'paye' THEN
    RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Le paiement n''est pas validé - Statut: %', v_paiement.statut;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement n''est pas validé'
    );
  END IF;

  v_entreprise_id := v_paiement.entreprise_id;
  v_plan_id := v_paiement.plan_id_from_notes;
  
  RAISE NOTICE '🏢 [creer_facture_et_abonnement_apres_paiement] Entreprise ID: %, Plan ID: %', v_entreprise_id, v_plan_id;
  
  -- Récupérer le client_id depuis les notes ou depuis l'entreprise
  IF v_paiement.client_id_from_notes != 'null' AND v_paiement.client_id_from_notes IS NOT NULL THEN
    v_client_id := v_paiement.client_id_from_notes::uuid;
    RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Client ID depuis notes: %', v_client_id;
  ELSE
    RAISE NOTICE '🔍 [creer_facture_et_abonnement_apres_paiement] Client ID non dans notes, recherche dans entreprise...';
    SELECT id INTO v_client_id
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    LIMIT 1;
    RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Client ID trouvé: %', v_client_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Aucun plan associé au paiement';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun plan associé au paiement'
    );
  END IF;

  -- Récupérer les informations du plan
  SELECT prix_mensuel
  INTO v_montant_mensuel
  FROM plans_abonnement
  WHERE id = v_plan_id;

  IF v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 0;
    RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Plan non trouvé, montant = 0';
  ELSE
    RAISE NOTICE '💰 [creer_facture_et_abonnement_apres_paiement] Plan trouvé - Montant mensuel: %', v_montant_mensuel;
  END IF;

  -- 1. Créer la facture automatiquement
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Création de la facture...';
  
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
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
    v_montant_mensuel,
    v_montant_mensuel * 0.20,
    v_montant_mensuel * 1.20,
    'payee',
    format('Facture générée automatiquement après validation du paiement pour: %s', (SELECT nom FROM entreprises WHERE id = v_entreprise_id))
  )
  RETURNING id INTO v_facture_id;

  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée - ID: %, Numéro: %', v_facture_id, v_numero_facture;

  -- Mettre à jour l'entreprise avec le statut de paiement
  RAISE NOTICE '🏢 [creer_facture_et_abonnement_apres_paiement] Mise à jour statut paiement entreprise...';
  
  UPDATE entreprises
  SET statut_paiement = 'paye'
  WHERE id = v_entreprise_id;

  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Statut paiement entreprise mis à jour';

  -- 4. CRÉER L'ESPACE CLIENT AVANT L'ABONNEMENT
  RAISE NOTICE '🏠 [creer_facture_et_abonnement_apres_paiement] Création de l''espace client via finaliser_creation_apres_paiement...';
  
  DECLARE
    v_finalisation_result jsonb;
    v_client_auth_user_id uuid;
  BEGIN
    v_finalisation_result := finaliser_creation_apres_paiement(v_entreprise_id);
    
    IF NOT (v_finalisation_result->>'success')::boolean THEN
      RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Erreur finalisation: %', v_finalisation_result->>'error';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Erreur lors de la création de l''espace client: ' || (v_finalisation_result->>'error')
      );
    END IF;

    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace client créé - ID: %', v_finalisation_result->>'espace_membre_id';

    -- Récupérer l'auth.user_id du client depuis l'espace membre créé
    SELECT user_id INTO v_client_auth_user_id
    FROM espaces_membres_clients
    WHERE id = (v_finalisation_result->>'espace_membre_id')::uuid;

    RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Auth User ID client: %', v_client_auth_user_id;

    -- 5. Créer l'abonnement (actif) avec l'auth.user_id du client
    RAISE NOTICE '📋 [creer_facture_et_abonnement_apres_paiement] Création de l''abonnement...';
    
    INSERT INTO abonnements (
      client_id,
      plan_id,
      montant_mensuel,
      statut,
      date_debut,
      date_fin
    )
    VALUES (
      v_client_auth_user_id,
      v_plan_id,
      v_montant_mensuel,
      'actif',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month'
    )
    RETURNING id INTO v_abonnement_id;

    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé - ID: %', v_abonnement_id;

    -- Lier l'abonnement à l'espace membre
    RAISE NOTICE '🔗 [creer_facture_et_abonnement_apres_paiement] Liaison abonnement à l''espace membre...';
    
    UPDATE espaces_membres_clients
    SET abonnement_id = v_abonnement_id,
        updated_at = NOW()
    WHERE id = (v_finalisation_result->>'espace_membre_id')::uuid;

    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement lié à l''espace membre';

    -- Synchroniser les modules depuis le plan
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '🔄 [creer_facture_et_abonnement_apres_paiement] Synchronisation des modules...';
      PERFORM sync_client_modules_from_plan((v_finalisation_result->>'espace_membre_id')::uuid);
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés';
    END IF;

    -- Ajouter les options si fournies
    IF v_paiement.options_ids_from_notes IS NOT NULL AND array_length(v_paiement.options_ids_from_notes, 1) > 0 THEN
      RAISE NOTICE '⚙️ [creer_facture_et_abonnement_apres_paiement] Ajout des options: %', v_paiement.options_ids_from_notes;
      INSERT INTO abonnement_options (abonnement_id, option_id)
      SELECT v_abonnement_id, unnest(v_paiement.options_ids_from_notes)
      ON CONFLICT DO NOTHING;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Options ajoutées';
    END IF;

    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] TERMINÉ AVEC SUCCÈS';
    RAISE NOTICE '   → Facture ID: %', v_facture_id;
    RAISE NOTICE '   → Abonnement ID: %', v_abonnement_id;
    RAISE NOTICE '   → Espace membre ID: %', v_finalisation_result->>'espace_membre_id';

    RETURN jsonb_build_object(
      'success', true,
      'facture_id', v_facture_id,
      'numero_facture', v_numero_facture,
      'abonnement_id', v_abonnement_id,
      'espace_membre_id', v_finalisation_result->>'espace_membre_id',
      'email', v_finalisation_result->>'email',
      'password', v_finalisation_result->>'password',
      'message', 'Facture, abonnement et espace client créés automatiquement après validation du paiement.'
    );
  END;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- PARTIE 5 : Ajouter des logs dans finaliser_creation_apres_paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION finaliser_creation_apres_paiement(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_client_data RECORD;
  v_entreprise_data RECORD;
  v_password text;
  v_auth_user_id uuid;
  v_espace_id uuid;
  v_role text := 'client_super_admin';
  v_existing_email text;
  v_existing_password text;
  v_existing_user_id uuid;
BEGIN
  RAISE NOTICE '🚀 [finaliser_creation_apres_paiement] DÉBUT - Entreprise ID: %', p_entreprise_id;
  
  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise_data
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RAISE WARNING '❌ [finaliser_creation_apres_paiement] Entreprise non trouvée - ID: %', p_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  RAISE NOTICE '🏢 [finaliser_creation_apres_paiement] Entreprise trouvée - Nom: %', v_entreprise_data.nom;

  -- Récupérer le client de l'entreprise
  SELECT * INTO v_client_data
  FROM clients
  WHERE entreprise_id = p_entreprise_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE WARNING '❌ [finaliser_creation_apres_paiement] Aucun client trouvé pour cette entreprise';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;

  RAISE NOTICE '👤 [finaliser_creation_apres_paiement] Client trouvé - ID: %, Email: %', v_client_data.id, v_client_data.email;

  -- Vérifier si l'espace membre existe déjà
  SELECT emc.id, emc.user_id, emc.password_temporaire, c.email
  INTO v_espace_id, v_existing_user_id, v_existing_password, v_existing_email
  FROM espaces_membres_clients emc
  JOIN clients c ON c.id = emc.client_id
  WHERE emc.client_id = v_client_data.id
  LIMIT 1;

  -- Si l'espace membre existe déjà, le retourner
  IF v_espace_id IS NOT NULL THEN
    RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Espace membre existe déjà - ID: %', v_espace_id;
    RETURN jsonb_build_object(
      'success', true,
      'espace_membre_id', v_espace_id,
      'email', v_existing_email,
      'password', v_existing_password
    );
  END IF;

  RAISE NOTICE '🔑 [finaliser_creation_apres_paiement] Génération du mot de passe...';

  -- Créer le mot de passe temporaire
  v_password := substr(
    md5(random()::text || clock_timestamp()::text),
    1,
    12
  ) || upper(substr(md5(random()::text), 1, 2)) || '!';

  -- Vérifier si l'utilisateur existe déjà dans auth.users
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_client_data.email
  LIMIT 1;

  -- Si l'utilisateur n'existe pas, le créer
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE '👤 [finaliser_creation_apres_paiement] Création nouvel utilisateur auth...';
    v_auth_user_id := gen_random_uuid();
    
    -- Créer l'utilisateur dans auth.users
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
      v_client_data.email,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'role', v_role),
      jsonb_build_object(
        'nom', COALESCE(v_client_data.nom, 'Client'),
        'prenom', COALESCE(v_client_data.prenom, ''),
        'role', v_role,
        'type', 'client'
      ),
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
    
    RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Utilisateur auth créé - ID: %', v_auth_user_id;
  ELSE
    RAISE NOTICE '👤 [finaliser_creation_apres_paiement] Utilisateur auth existe déjà - ID: %', v_auth_user_id;
    
    -- Mettre à jour l'utilisateur existant avec le rôle client_super_admin
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_role)
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(auth.users.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_role)
    ),
    updated_at = now()
    WHERE auth.users.id = v_auth_user_id;
    
    RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Utilisateur auth mis à jour avec rôle: %', v_role;
  END IF;

  -- Créer ou mettre à jour l'entrée dans utilisateurs
  RAISE NOTICE '📝 [finaliser_creation_apres_paiement] Création/mise à jour entrée utilisateurs...';
  
  INSERT INTO utilisateurs (
    id,
    email,
    nom,
    prenom,
    role
  )
  VALUES (
    v_auth_user_id,
    v_client_data.email,
    COALESCE(v_client_data.nom, 'Client'),
    COALESCE(v_client_data.prenom, ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = v_role,
      email = EXCLUDED.email,
      nom = EXCLUDED.nom,
      prenom = EXCLUDED.prenom;

  RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Entrée utilisateurs créée/mise à jour';

  -- Vérifier si l'espace membre existe déjà
  SELECT id INTO v_espace_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_data.id
    AND entreprise_id = p_entreprise_id
  LIMIT 1;
  
  -- Si l'espace n'existe pas, le créer
  IF v_espace_id IS NULL THEN
    RAISE NOTICE '🏠 [finaliser_creation_apres_paiement] Création de l''espace membre...';
    
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
      v_client_data.id,
      p_entreprise_id,
      v_auth_user_id,
      v_password,
      true,
      true,
      'actif',
      false
    )
    RETURNING id INTO v_espace_id;
    
    RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Espace membre créé - ID: %', v_espace_id;
  ELSE
    RAISE NOTICE '🏠 [finaliser_creation_apres_paiement] Espace membre existe déjà - ID: %, mise à jour...', v_espace_id;
    
    -- Mettre à jour l'espace existant
    UPDATE espaces_membres_clients
    SET user_id = v_auth_user_id,
        password_temporaire = v_password,
        doit_changer_password = true,
        actif = true,
        statut_compte = 'actif'
    WHERE id = v_espace_id;
    
    RAISE NOTICE '✅ [finaliser_creation_apres_paiement] Espace membre mis à jour';
  END IF;

  RAISE NOTICE '✅ [finaliser_creation_apres_paiement] TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '   → Espace membre ID: %', v_espace_id;
  RAISE NOTICE '   → Email: %', v_client_data.email;

  RETURN jsonb_build_object(
    'success', true,
    'espace_membre_id', v_espace_id::text,
    'email', v_client_data.email,
    'password', v_password
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [finaliser_creation_apres_paiement] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture et active l''abonnement après validation d''un paiement. Avec logs détaillés pour diagnostic.';

COMMENT ON FUNCTION finaliser_creation_apres_paiement IS 
  'Crée l''espace client avec Super Admin automatique après validation du paiement. Avec logs détaillés pour diagnostic.';

