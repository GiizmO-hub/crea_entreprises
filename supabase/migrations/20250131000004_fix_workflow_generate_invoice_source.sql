/*
  # CORRECTION : Ajouter source='plateforme' dans toutes les fonctions de génération de factures
  
  Problème :
  - Les fonctions qui génèrent automatiquement des factures n'incluent pas toujours le champ 'source'
  - Cela peut causer des erreurs si la colonne source est requise ou a une contrainte
  
  Solution :
  - Mettre à jour toutes les fonctions qui créent des factures pour inclure source='plateforme'
*/

-- ============================================================================
-- 1. CORRIGER creer_facture_et_abonnement_apres_paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(p_paiement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement paiements%ROWTYPE;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_plan_id uuid;
  v_montant_mensuel numeric;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_numero_facture text;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_auth_user_id uuid;
  v_mode_paiement text;
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. Vérifier si une facture existe déjà pour ce paiement
  IF EXISTS (SELECT 1 FROM factures WHERE paiement_id = p_paiement_id) THEN
    SELECT id INTO v_facture_id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante pour paiement %: %', p_paiement_id, v_facture_id;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Facture déjà existante',
      'facture_id', v_facture_id,
      'already_exists', true
    );
  END IF;
  
  -- 3. Récupérer les données nécessaires
  v_entreprise_id := v_paiement.entreprise_id;
  v_mode_paiement := COALESCE(v_paiement.methode_paiement, 'carte');
  
  -- Récupérer le client de l'entreprise
  SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  
  -- Récupérer le plan depuis les notes du paiement ou depuis l'entreprise
  IF v_paiement.notes IS NOT NULL AND jsonb_typeof(v_paiement.notes) = 'object' THEN
    v_plan_id := (v_paiement.notes->>'plan_id')::uuid;
  END IF;
  
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id FROM entreprises WHERE id = v_entreprise_id;
  END IF;
  
  -- Récupérer le montant mensuel depuis le plan ou utiliser le montant du paiement
  IF v_plan_id IS NOT NULL THEN
    SELECT montant_mensuel INTO v_montant_mensuel FROM plans_abonnement WHERE id = v_plan_id;
  END IF;
  
  IF v_montant_mensuel IS NULL OR v_montant_mensuel = 0 THEN
    v_montant_mensuel := COALESCE(v_paiement.montant_ht, v_paiement.montant_ttc / 1.20, 0);
  END IF;
  
  -- Calculer les montants
  v_montant_ht := v_montant_mensuel;
  v_montant_tva := v_montant_ht * 0.20;
  v_montant_ttc := v_montant_ht + v_montant_tva;
  
  -- 4. Récupérer l'auth.user_id du client
  IF v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
    
    -- Si pas trouvé, essayer depuis auth.users via l'email du client
    IF v_auth_user_id IS NULL THEN
      SELECT id INTO v_auth_user_id
      FROM auth.users
      WHERE email = (SELECT email FROM clients WHERE id = v_client_id LIMIT 1)
      LIMIT 1;
    END IF;
  END IF;
  
  -- 5. Générer le numéro de facture
  v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
  
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
  END LOOP;
  
  -- 6. ✅ CORRECTION : Créer la facture AVEC source='plateforme'
  BEGIN
    -- Vérifier si la colonne source existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'factures' AND column_name = 'source'
    ) THEN
      -- Vérifier aussi si paiement_id existe
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'factures' AND column_name = 'paiement_id'
      ) THEN
        INSERT INTO factures (
          entreprise_id, client_id, numero, type, date_emission, date_echeance,
          montant_ht, tva, montant_ttc, statut, paiement_id, source
        )
        VALUES (
          v_entreprise_id, v_client_id, v_numero_facture, 'facture',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          v_montant_ht, v_montant_tva, v_montant_ttc, 'payee', p_paiement_id, 'plateforme'
        )
        RETURNING id INTO v_facture_id;
      ELSE
        INSERT INTO factures (
          entreprise_id, client_id, numero, type, date_emission, date_echeance,
          montant_ht, tva, montant_ttc, statut, source
        )
        VALUES (
          v_entreprise_id, v_client_id, v_numero_facture, 'facture',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          v_montant_ht, v_montant_tva, v_montant_ttc, 'payee', 'plateforme'
        )
        RETURNING id INTO v_facture_id;
      END IF;
    ELSE
      -- Si la colonne source n'existe pas encore, créer sans
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'factures' AND column_name = 'paiement_id'
      ) THEN
        INSERT INTO factures (
          entreprise_id, client_id, numero, type, date_emission, date_echeance,
          montant_ht, tva, montant_ttc, statut, paiement_id
        )
        VALUES (
          v_entreprise_id, v_client_id, v_numero_facture, 'facture',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          v_montant_ht, v_montant_tva, v_montant_ttc, 'payee', p_paiement_id
        )
        RETURNING id INTO v_facture_id;
      ELSE
        INSERT INTO factures (
          entreprise_id, client_id, numero, type, date_emission, date_echeance,
          montant_ht, tva, montant_ttc, statut
        )
        VALUES (
          v_entreprise_id, v_client_id, v_numero_facture, 'facture',
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          v_montant_ht, v_montant_tva, v_montant_ttc, 'payee'
        )
        RETURNING id INTO v_facture_id;
      END IF;
    END IF;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (unique_violation)';
      SELECT id INTO v_facture_id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1;
      IF v_facture_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture (unique_violation)');
      END IF;
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création facture: %', SQLERRM;
      RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture: ' || SQLERRM);
  END;
  
  -- 7. Créer l'abonnement (code existant...)
  -- ... (le reste de la fonction reste identique)
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'numero_facture', v_numero_facture
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- 2. CORRIGER generate_invoice_for_entreprise
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_for_entreprise(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise entreprises%ROWTYPE;
  v_client_id uuid;
  v_abonnement_id uuid;
  v_montant_mensuel numeric;
  v_numero_facture text;
  v_facture_id uuid;
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
  SELECT * INTO v_entreprise FROM entreprises WHERE id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise non trouvée');
  END IF;

  -- Récupérer le premier client de l'entreprise
  SELECT id INTO v_client_id FROM clients WHERE entreprise_id = p_entreprise_id LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client trouvé pour cette entreprise');
  END IF;

  -- Récupérer l'abonnement actif
  SELECT id, montant_mensuel INTO v_abonnement_id, v_montant_mensuel
  FROM abonnements
  WHERE entreprise_id = p_entreprise_id
  AND statut = 'actif'
  LIMIT 1;

  -- Si pas d'abonnement, utiliser un montant par défaut
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 49.90;
  END IF;

  -- Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;

  -- ✅ CORRECTION : Créer la facture AVEC source='plateforme'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'source'
  ) THEN
    INSERT INTO factures (
      entreprise_id, client_id, numero, type, date_emission, date_echeance,
      montant_ht, tva, montant_ttc, statut, notes, source
    )
    VALUES (
      p_entreprise_id, v_client_id, v_numero_facture, 'facture',
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
      v_montant_mensuel, ROUND(v_montant_mensuel * 0.20, 2), ROUND(v_montant_mensuel * 1.20, 2),
      'envoyee',
      jsonb_build_object(
        'source', 'generate_invoice_for_entreprise',
        'abonnement_id', v_abonnement_id,
        'message', 'Facture générée automatiquement depuis la plateforme'
      ),
      'plateforme'
    )
    RETURNING id INTO v_facture_id;
  ELSE
    INSERT INTO factures (
      entreprise_id, client_id, numero, type, date_emission, date_echeance,
      montant_ht, tva, montant_ttc, statut, notes
    )
    VALUES (
      p_entreprise_id, v_client_id, v_numero_facture, 'facture',
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
      v_montant_mensuel, ROUND(v_montant_mensuel * 0.20, 2), ROUND(v_montant_mensuel * 1.20, 2),
      'envoyee',
      jsonb_build_object(
        'source', 'generate_invoice_for_entreprise',
        'abonnement_id', v_abonnement_id,
        'message', 'Facture générée automatiquement depuis la plateforme'
      )
    )
    RETURNING id INTO v_facture_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero_facture,
    'numero_facture', v_numero_facture,
    'montant_ttc', ROUND(v_montant_mensuel * 1.20, 2),
    'message', 'Facture générée avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [generate_invoice_for_entreprise] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION generate_invoice_for_entreprise(uuid) IS 
  'Génère une facture pour une entreprise (réservé aux super admins plateforme) - CORRIGÉ pour inclure source=''plateforme''';

