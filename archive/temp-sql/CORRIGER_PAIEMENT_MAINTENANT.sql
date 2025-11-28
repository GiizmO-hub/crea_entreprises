/*
  ============================================================================
  🔧 CORRECTION IMMÉDIATE - PAIEMENT BLOQUÉ À 60%
  ============================================================================
  
  PAIEMENT_ID: eee79728-5520-4220-984d-a577614a67f3
  
  Ce script :
  1. Vérifie l'état actuel
  2. Marque le paiement comme payé
  3. Crée la facture
  4. Crée l'abonnement
  5. Crée l'espace client avec droits admin
  6. Active l'entreprise et le client
  
  Instructions:
    1. Copiez TOUT ce fichier
    2. Ouvrez Supabase Dashboard > SQL Editor
    3. Collez et exécutez
    4. Vérifiez le résultat
  ============================================================================
*/

-- ============================================================================
-- ÉTAPE 1 : VÉRIFIER L'ÉTAT ACTUEL
-- ============================================================================

SELECT 
  '📊 ÉTAT ACTUEL DU PAIEMENT' as etape,
  p.id as paiement_id,
  p.statut as statut_paiement,
  p.montant_ttc,
  p.entreprise_id,
  e.nom as entreprise_nom,
  e.statut as statut_entreprise,
  e.statut_paiement as statut_paiement_entreprise,
  (SELECT COUNT(*) FROM factures WHERE notes->>'paiement_id' = p.id::text) as nb_factures,
  (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = p.entreprise_id) as nb_abonnements,
  (SELECT COUNT(*) FROM espaces_membres_clients emc 
   JOIN clients c ON c.id = emc.client_id 
   WHERE c.entreprise_id = p.entreprise_id) as nb_espaces_membres
FROM paiements p
LEFT JOIN entreprises e ON e.id = p.entreprise_id
WHERE p.id = 'eee79728-5520-4220-984d-a577614a67f3';

-- ============================================================================
-- ÉTAPE 2 : ESSAYER D'APPELER LA FONCTION AUTOMATIQUE
-- ============================================================================

DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- Vérifier si la fonction existe
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_carte_immediat trouvée. Appel en cours...';
    
    -- Appeler la fonction
    SELECT valider_paiement_carte_immediat(
      'eee79728-5520-4220-984d-a577614a67f3'::uuid,
      NULL
    ) INTO v_result;
    
    RAISE NOTICE '📋 Résultat: %', v_result;
    
    IF (v_result->>'success')::boolean THEN
      RAISE NOTICE '✅ SUCCÈS ! Workflow complété automatiquement.';
    ELSE
      RAISE WARNING '⚠️ Erreur dans la fonction: %', v_result->>'error';
      RAISE NOTICE '🔄 Passage à la création manuelle...';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Fonction valider_paiement_carte_immediat non trouvée.';
    RAISE NOTICE '🔄 Passage à la création manuelle...';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erreur lors de l''appel automatique: %', SQLERRM;
    RAISE NOTICE '🔄 Passage à la création manuelle...';
END $$;

-- ============================================================================
-- ÉTAPE 3 : CRÉATION MANUELLE (SI NÉCESSAIRE)
-- ============================================================================

DO $$
DECLARE
  v_paiement RECORD;
  v_client RECORD;
  v_plan RECORD;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_numero_facture text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_id uuid;
  v_client_id uuid;
  v_entreprise_id uuid;
  v_user_id uuid;
  v_facture_count int;
  v_abonnement_count int;
BEGIN
  -- Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = 'eee79728-5520-4220-984d-a577614a67f3';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement non trouvé';
  END IF;
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  -- Vérifier si facture et abonnement existent déjà
  SELECT COUNT(*) INTO v_facture_count
  FROM factures
  WHERE notes->>'paiement_id' = 'eee79728-5520-4220-984d-a577614a67f3';
  
  SELECT COUNT(*) INTO v_abonnement_count
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id;
  
  IF v_facture_count > 0 AND v_abonnement_count > 0 THEN
    RAISE NOTICE '✅ Facture et abonnement existent déjà. Pas de création nécessaire.';
    RETURN;
  END IF;
  
  RAISE NOTICE '🔄 Début de la création manuelle...';
  RAISE NOTICE '   Entreprise ID: %', v_entreprise_id;
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Montant TTC: %', v_montant_ttc;
  
  -- 1. Marquer le paiement comme payé
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      updated_at = now()
  WHERE id = 'eee79728-5520-4220-984d-a577614a67f3';
  
  RAISE NOTICE '✅ Paiement marqué comme payé';
  
  -- 2. Récupérer le plan_id depuis les notes du paiement
  IF v_paiement.notes IS NOT NULL AND jsonb_typeof(v_paiement.notes) = 'object' THEN
    v_plan_id := (v_paiement.notes->>'plan_id')::uuid;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '⚠️ Plan ID non trouvé dans les notes. Tentative de récupération depuis l''entreprise...';
    -- Essayer de récupérer depuis les abonnements existants ou l'entreprise
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
    LIMIT 1;
  END IF;
  
  -- 3. Récupérer le client
  SELECT * INTO v_client
  FROM clients
  WHERE entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun client trouvé pour cette entreprise';
  END IF;
  
  v_client_id := v_client.id;
  RAISE NOTICE '✅ Client trouvé: %', v_client_id;
  
  -- 4. Créer la facture si elle n'existe pas
  IF v_facture_count = 0 THEN
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Vérifier unicité
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
      statut_paiement,
      notes
    )
    VALUES (
      v_entreprise_id,
      v_client_id,
      v_numero_facture,
      'facture',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      v_montant_ht,
      v_montant_tva,
      v_montant_ttc,
      'envoyee',
      'payee',
      jsonb_build_object(
        'paiement_id', 'eee79728-5520-4220-984d-a577614a67f3',
        'plan_id', COALESCE(v_plan_id::text, ''),
        'origine', 'correction_manuelle'
      )
    )
    RETURNING id INTO v_facture_id;
    
    RAISE NOTICE '✅ Facture créée: % (Numéro: %)', v_facture_id, v_numero_facture;
  END IF;
  
  -- 5. Créer l'abonnement si il n'existe pas
  IF v_abonnement_count = 0 AND v_plan_id IS NOT NULL THEN
    INSERT INTO abonnements (
      client_id,
      entreprise_id,
      plan_id,
      statut,
      date_debut,
      date_prochain_paiement,
      montant_mensuel,
      mode_paiement,
      stripe_payment_id
    )
    VALUES (
      v_client_id,
      v_entreprise_id,
      v_plan_id,
      'actif',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month',
      v_montant_ht,
      'mensuel',
      v_paiement.stripe_payment_id
    )
    RETURNING id INTO v_abonnement_id;
    
    RAISE NOTICE '✅ Abonnement créé: %', v_abonnement_id;
  END IF;
  
  -- 6. Créer/Mettre à jour l'espace membre avec droits admin
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    INSERT INTO espaces_membres_clients (
      client_id,
      entreprise_id,
      user_id,
      role,
      actif,
      modules_actifs
    )
    VALUES (
      v_client_id,
      v_entreprise_id,
      v_user_id,
      'client_super_admin',
      true,
      jsonb_build_object(
        'tableau_de_bord', true,
        'mon_entreprise', true,
        'factures', true,
        'documents', true,
        'abonnements', true
      )
    )
    RETURNING id INTO v_espace_membre_id;
    
    RAISE NOTICE '✅ Espace membre créé: %', v_espace_membre_id;
  ELSE
    UPDATE espaces_membres_clients
    SET role = 'client_super_admin',
        actif = true,
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true,
          'mon_entreprise', true,
          'factures', true,
          'documents', true,
          'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 7. Activer l'entreprise
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye'
  WHERE id = v_entreprise_id;
  
  RAISE NOTICE '✅ Entreprise activée';
  
  -- 8. Activer le client
  UPDATE clients
  SET statut = 'actif'
  WHERE id = v_client_id;
  
  RAISE NOTICE '✅ Client activé';
  
  RAISE NOTICE '🎉 CORRECTION TERMINÉE AVEC SUCCÈS !';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la correction: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- ============================================================================
-- ÉTAPE 4 : VÉRIFIER L'ÉTAT APRÈS CORRECTION
-- ============================================================================

SELECT 
  '✅ ÉTAT APRÈS CORRECTION' as etape,
  p.id as paiement_id,
  p.statut as statut_paiement,
  e.nom as entreprise_nom,
  e.statut as statut_entreprise,
  e.statut_paiement as statut_paiement_entreprise,
  (SELECT COUNT(*) FROM factures WHERE notes->>'paiement_id' = p.id::text) as nb_factures,
  (SELECT f.numero FROM factures f WHERE f.notes->>'paiement_id' = p.id::text LIMIT 1) as numero_facture,
  (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = p.entreprise_id) as nb_abonnements,
  (SELECT COUNT(*) FROM espaces_membres_clients emc 
   JOIN clients c ON c.id = emc.client_id 
   WHERE c.entreprise_id = p.entreprise_id) as nb_espaces_membres,
  CASE 
    WHEN p.statut = 'paye' 
     AND (SELECT COUNT(*) FROM factures WHERE notes->>'paiement_id' = p.id::text) > 0
     AND (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = p.entreprise_id) > 0
     AND (SELECT COUNT(*) FROM espaces_membres_clients emc 
          JOIN clients c ON c.id = emc.client_id 
          WHERE c.entreprise_id = p.entreprise_id) > 0
    THEN '✅ WORKFLOW COMPLET (100%)'
    ELSE '⚠️ WORKFLOW INCOMPLET'
  END as statut_workflow
FROM paiements p
LEFT JOIN entreprises e ON e.id = p.entreprise_id
WHERE p.id = 'eee79728-5520-4220-984d-a577614a67f3';

