-- ============================================================================
-- FIX : valider_paiement_carte_immediat pour qu'il appelle le workflow complet
-- ============================================================================

DROP FUNCTION IF EXISTS valider_paiement_carte_immediat(uuid, text) CASCADE;

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
  v_facture_existante uuid;
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
  
  -- 2. Vérifier si déjà traité (facture existe)
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '⚠️ [valider_paiement_carte_immediat] Paiement déjà traité - Facture existe: %', v_facture_existante;
    
    -- Récupérer l'abonnement associé
    DECLARE
      v_abonnement_existant uuid;
      v_espace_membre_existant uuid;
    BEGIN
      SELECT id INTO v_abonnement_existant
      FROM abonnements
      WHERE facture_id = v_facture_existante
      LIMIT 1;
      
      SELECT id INTO v_espace_membre_existant
      FROM espaces_membres_clients
      WHERE entreprise_id = v_paiement.entreprise_id
      LIMIT 1;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Paiement déjà validé (doublon évité)',
        'already_processed', true,
        'facture_id', v_facture_existante,
        'abonnement_id', v_abonnement_existant,
        'espace_membre_id', v_espace_membre_existant
      );
    END;
  END IF;
  
  -- 3. Marquer le paiement comme payé
  RAISE NOTICE '📝 [valider_paiement_carte_immediat] Marquage du paiement comme payé...';
  
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  
  -- 4. ✅ CRITIQUE : Appeler creer_facture_et_abonnement_apres_paiement
  -- Cette fonction crée automatiquement :
  -- 1. La facture
  -- 2. L'abonnement
  -- 3. L'espace client avec droits d'administrateur (client_super_admin)
  -- 4. Synchronise les modules
  -- 5. Active l'entreprise et le client
  
  RAISE NOTICE '🏭 [valider_paiement_carte_immediat] Appel de creer_facture_et_abonnement_apres_paiement...';
  
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
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'entreprise_id', v_result->>'entreprise_id',
    'numero_facture', v_result->>'numero_facture',
    'details', jsonb_build_object(
      'facture_creée', true,
      'abonnement_créé', v_result->>'abonnement_id' IS NOT NULL,
      'espace_client_créé', v_result->>'espace_membre_id' IS NOT NULL,
      'workflow_complet', true
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] ERREUR FATALE: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'message', 'Erreur lors de la validation du paiement'
    );
END;
$$;

SELECT '✅ Fonction valider_paiement_carte_immediat corrigée avec succès !' as resultat;

