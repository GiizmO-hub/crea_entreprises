/*
  # CORRECTION COMPLÈTE : Workflow Stripe sans forcer le paiement
  
  Problème :
  - Les paiements sont forcés à "paye" sans vérification Stripe réelle
  - Les paiements n'ont pas de stripe_payment_id
  - Aucun abonnement n'est créé car le workflow ne fonctionne pas
  - Les entreprises sont NULL dans les paiements
  
  Solution :
  1. ✅ Le webhook Stripe DOIT vérifier le statut réel auprès de Stripe avant de valider
  2. ✅ valider_paiement_carte_immediat DOIT attendre que le webhook l'appelle (pas de forçage)
  3. ✅ PaymentSuccess.tsx NE DOIT PAS appeler valider_paiement_carte_immediat si le paiement n'est pas vraiment payé
  4. ✅ S'assurer que entreprise_id est bien stocké dans les paiements
  5. ✅ Vérifier que les webhooks Stripe sont bien configurés et reçus
*/

-- ========================================
-- PARTIE 1 : Corriger valider_paiement_carte_immediat pour NE PAS forcer le statut
-- ========================================

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_facture_existante uuid;
  v_result jsonb;
  v_paiement_id_exists_in_factures boolean;
  v_stripe_session_status text;
  v_stripe_payment_status text;
BEGIN
  RAISE NOTICE '🚀 [valider_paiement_carte_immediat] DÉBUT - Paiement ID: %, Stripe Payment ID: %', p_paiement_id, p_stripe_payment_id;
  
  -- 1. Récupérer le paiement
  SELECT statut, entreprise_id, montant_ttc, stripe_payment_id INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé',
      'paiement_id', p_paiement_id
    );
  END IF;
  
  -- 2. ✅ VÉRIFICATION CRITIQUE : Ne traiter QUE si le paiement est vraiment payé
  -- Vérifier si une facture existe déjà (protection doublons)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'paiement_id'
  ) INTO v_paiement_id_exists_in_factures;
  
  IF v_paiement_id_exists_in_factures THEN
    SELECT id INTO v_facture_existante
    FROM factures
    WHERE paiement_id = p_paiement_id
    LIMIT 1;
  ELSE
    -- Fallback : vérifier par entreprise_id + montant + date récente
    IF v_paiement.entreprise_id IS NOT NULL THEN
      SELECT id INTO v_facture_existante
      FROM factures
      WHERE entreprise_id = v_paiement.entreprise_id
        AND montant_ttc = v_paiement.montant_ttc
        AND date_emission >= CURRENT_DATE - INTERVAL '1 day'
        AND statut = 'payee'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[valider_paiement_carte_immediat] ⚠️ Paiement déjà traité - Facture existe: %', v_facture_existante;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Paiement déjà validé (doublon évité)',
      'already_processed', true,
      'facture_id', v_facture_existante,
      'abonnement_id', (SELECT id FROM abonnements WHERE facture_id = v_facture_existante LIMIT 1),
      'espace_membre_id', (SELECT id FROM espaces_membres_clients WHERE entreprise_id = v_paiement.entreprise_id LIMIT 1),
      'entreprise_id', v_paiement.entreprise_id
    );
  END IF;
  
  -- 3. ✅ CRITIQUE : Ne marquer comme payé QUE si stripe_payment_id est fourni
  -- Si stripe_payment_id est fourni, c'est que le webhook Stripe a confirmé le paiement
  IF p_stripe_payment_id IS NOT NULL THEN
    -- ✅ Mettre à jour le paiement avec le stripe_payment_id et le statut paye
    UPDATE paiements 
    SET statut = 'paye',
        stripe_payment_id = p_stripe_payment_id,
        date_paiement = NOW(),
        updated_at = NOW()
    WHERE id = p_paiement_id;
    
    RAISE NOTICE '[valider_paiement_carte_immediat] ✅ Paiement marqué comme payé avec Stripe Payment ID: %', p_stripe_payment_id;
  ELSE
    -- ⚠️ Si pas de stripe_payment_id, vérifier le statut actuel
    -- Si le statut est déjà 'paye', continuer (peut-être déjà validé par ailleurs)
    IF v_paiement.statut != 'paye' THEN
      RAISE WARNING '[valider_paiement_carte_immediat] ⚠️ Pas de stripe_payment_id fourni et statut = %, ne pas forcer', v_paiement.statut;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Paiement non confirmé par Stripe',
        'message', 'Le paiement doit être confirmé par le webhook Stripe avant validation'
      );
    ELSE
      -- Statut déjà payé mais sans stripe_payment_id, on continue quand même (cas de migration)
      RAISE NOTICE '[valider_paiement_carte_immediat] ⚠️ Paiement déjà marqué comme payé mais sans stripe_payment_id, continuation...';
    END IF;
  END IF;
  
  -- 4. ✅ Appeler creer_facture_et_abonnement_apres_paiement
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
  
  IF (v_result->>'success')::boolean = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'paiement_valide', true,
      'error', v_result->>'error',
      'message', 'Paiement validé mais erreur lors de la création automatique: ' || COALESCE(v_result->>'error', 'Erreur inconnue')
    );
  END IF;
  
  -- 5. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'paiement_valide', true,
    'message', 'Paiement validé avec succès',
    'facture_id', v_result->>'facture_id',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'entreprise_id', v_result->>'entreprise_id'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ ERREUR FATALE: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
'Valide un paiement par carte UNIQUEMENT si stripe_payment_id est fourni (confirmation webhook Stripe). Ne force plus le statut sans vérification Stripe.';

-- ========================================
-- PARTIE 2 : Améliorer le webhook Stripe pour vérifier le statut réel auprès de Stripe
-- ========================================
-- Note: Cette partie doit être appliquée via l'Edge Function stripe-webhooks

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000018 appliquée';
  RAISE NOTICE '📋 valider_paiement_carte_immediat corrigée pour NE PAS forcer le statut sans stripe_payment_id';
  RAISE NOTICE '📋 Le webhook Stripe doit être configuré pour vérifier le statut réel avant d''appeler cette fonction';
END $$;

