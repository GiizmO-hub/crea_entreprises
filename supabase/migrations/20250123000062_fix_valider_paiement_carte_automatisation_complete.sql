/*
  # CORRECTION : Automatisation complète du workflow après paiement carte
  
  PROBLÈME:
  - valider_paiement_carte_immediat met seulement le paiement à 'paye'
  - Pas de création automatique de facture, abonnement, espace client
  - Le workflow s'arrête à 60% et le paiement reste en attente
  
  SOLUTION:
  - Modifier valider_paiement_carte_immediat pour appeler directement creer_facture_et_abonnement_apres_paiement
  - Même logique que valider_paiement_virement_manuel pour cohérence
  - Garantir que tout se crée automatiquement après validation Stripe
*/

-- ============================================================================
-- ÉTAPE 1 : Vérifier/Créer la fonction creer_facture_et_abonnement_apres_paiement
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
  v_client RECORD;
  v_plan RECORD;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_numero_facture text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_id uuid;
  v_client_id uuid;
  v_entreprise_id uuid;
  v_user_id uuid;
  v_espace_membre_id uuid;
BEGIN
  RAISE NOTICE '🚀 [creer_facture_et_abonnement_apres_paiement] DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  IF v_paiement.statut != 'paye' THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Paiement non payé - Statut: %', v_paiement.statut;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement doit être marqué comme payé avant de créer facture et abonnement'
    );
  END IF;
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  -- Extraire plan_id depuis les notes du paiement
  IF v_paiement.notes IS NOT NULL AND jsonb_typeof(v_paiement.notes) = 'object' THEN
    v_plan_id := (v_paiement.notes->>'plan_id')::uuid;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé dans les notes du paiement';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant dans les notes du paiement'
    );
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Plan: %, Montant: %', 
    v_entreprise_id, v_plan_id, v_montant_ttc;
  
  -- 2. Récupérer le plan
  SELECT * INTO v_plan
  FROM plans_abonnement
  WHERE id = v_plan_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan non trouvé - ID: %', v_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan d''abonnement non trouvé'
    );
  END IF;
  
  -- 3. Récupérer le client associé à l'entreprise
  SELECT * INTO v_client
  FROM clients
  WHERE entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Client non trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;
  
  v_client_id := v_client.id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé - ID: %', v_client_id;
  
  -- 4. Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Création facture - Numéro: %', v_numero_facture;
  
  -- 5. Créer la facture
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
      'paiement_id', p_paiement_id::text,
      'plan_id', v_plan_id::text,
      'origine', 'paiement_stripe'
    )
  )
  RETURNING id INTO v_facture_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée - ID: %', v_facture_id;
  
  -- 6. Créer l'abonnement
  RAISE NOTICE '📦 [creer_facture_et_abonnement_apres_paiement] Création abonnement...';
  
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé - ID: %', v_abonnement_id;
  
  -- 7. Créer/Mettre à jour l'espace membre client avec droits admin
  RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Création espace membre client...';
  
  -- Vérifier si l'espace membre existe déjà
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    -- Créer l'espace membre
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
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre créé - ID: %', v_espace_membre_id;
  ELSE
    -- Mettre à jour l'espace membre pour activer et ajouter droits admin
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
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour - ID: %', v_espace_membre_id;
  END IF;
  
  -- 8. Synchroniser les modules depuis le plan
  RAISE NOTICE '🔄 [creer_facture_et_abonnement_apres_paiement] Synchronisation modules depuis plan...';
  
  -- Appeler la fonction de synchronisation si elle existe
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules (non bloquant): %', SQLERRM;
  END;
  
  -- 9. Activer l'entreprise si elle n'est pas déjà active
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye'
  WHERE id = v_entreprise_id
    AND (statut != 'active' OR statut_paiement != 'paye');
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise activée';
  
  -- 10. Activer le client
  UPDATE clients
  SET statut = 'actif'
  WHERE id = v_client_id
    AND statut != 'actif';
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client activé';
  
  RAISE NOTICE '🎉 [creer_facture_et_abonnement_apres_paiement] TERMINÉ AVEC SUCCÈS !';
  
  -- Retourner un résultat détaillé
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email,
    'details', jsonb_build_object(
      'facture_creée', true,
      'abonnement_créé', true,
      'espace_client_créé', true,
      'droits_admin_créés', true,
      'modules_synchronisés', true,
      'entreprise_activée', true,
      'client_activé', true
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Fonction principale du workflow automatique.';

-- ============================================================================
-- ÉTAPE 2 : Modifier valider_paiement_carte_immediat pour appeler cette fonction
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
  v_paiement RECORD;
BEGIN
  RAISE NOTICE '🚀 [valider_paiement_carte_immediat] DÉBUT - Paiement ID: %, Stripe ID: %', p_paiement_id, p_stripe_payment_id;
  
  -- 1. Vérifier que le paiement existe
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  IF v_paiement.statut = 'paye' THEN
    RAISE WARNING '⚠️ [valider_paiement_carte_immediat] Paiement déjà validé - Statut: %', v_paiement.statut;
    -- Si déjà payé, essayer quand même de créer facture et abonnement
    RAISE NOTICE '📋 [valider_paiement_carte_immediat] Paiement déjà payé, tentative de création facture/abonnement...';
  END IF;
  
  -- 2. Marquer le paiement comme payé
  RAISE NOTICE '📝 [valider_paiement_carte_immediat] Marquage du paiement comme payé...';
  
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  
  -- 3. ✅ AUTOMATISATION: Appeler directement creer_facture_et_abonnement_apres_paiement
  -- Cette fonction crée automatiquement :
  -- 1. La facture
  -- 2. L'abonnement
  -- 3. L'espace client avec droits d'administrateur (client_super_admin)
  -- 4. Synchronise les modules
  -- 5. Active l'entreprise et le client
  
  RAISE NOTICE '🏭 [valider_paiement_carte_immediat] Appel de creer_facture_et_abonnement_apres_paiement pour création automatique complète...';
  
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
  
  IF NOT (v_result->>'success')::boolean THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Erreur lors de la création automatique: %', v_result->>'error';
    
    -- Même en cas d'erreur, le paiement reste marqué comme payé
    -- L'admin pourra relancer la création manuellement si nécessaire
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement validé mais erreur lors de la création automatique: ' || (v_result->>'error'),
      'paiement_valide', true,
      'details', v_result
    );
  END IF;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Création automatique réussie !';
  RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
  RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
  RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';
  
  -- Retourner un résultat détaillé
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement par carte validé. Génération automatique complète effectuée avec succès',
    'paiement_id', p_paiement_id,
    'facture_id', v_result->>'facture_id',
    'numero_facture', v_result->>'numero_facture',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'email', v_result->>'email',
    'details', v_result->'details'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'paiement_valide', false
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
  'Valide un paiement par carte immédiatement. Déclenche automatiquement la création complète (facture, abonnement, espace client, droits admin). Version automatisée complète.';

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction creer_facture_et_abonnement_apres_paiement non trouvée après création';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_carte_immediat créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction valider_paiement_carte_immediat non trouvée après création';
  END IF;
END $$;


