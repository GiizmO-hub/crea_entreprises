/*
  ============================================================================
  TEST SIMPLE DU WORKFLOW DE PAIEMENT
  ============================================================================
  
  Exécutez ce script dans le Dashboard Supabase SQL Editor pour tester le workflow.
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez tout ce fichier
    3. Collez et exécutez
    4. Analysez les résultats
  
  ============================================================================
*/

-- 1. Lister les paiements récents
SELECT 
  '📋 PAIEMENTS DISPONIBLES' as info,
  id as paiement_id,
  statut,
  montant_ttc,
  entreprise_id,
  LEFT(COALESCE(notes, ''), 50) as notes_preview
FROM paiements
ORDER BY created_at DESC
LIMIT 5;

-- 2. Récupérer un paiement pour tester
DO $$
DECLARE
  v_paiement_id uuid;
  v_paiement_statut text;
  v_info jsonb;
  v_result jsonb;
BEGIN
  -- Prendre le premier paiement en attente ou payé
  SELECT id, statut INTO v_paiement_id, v_paiement_statut
  FROM paiements
  WHERE statut IN ('en_attente', 'paye')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucun paiement trouvé pour tester';
    RETURN;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  🧪 TEST DU WORKFLOW - Paiement ID: %', v_paiement_id;
  RAISE NOTICE '  Statut actuel: %', v_paiement_statut;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
  -- Test 1: get_paiement_info_for_stripe
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣ Test get_paiement_info_for_stripe...';
  
  SELECT get_paiement_info_for_stripe(v_paiement_id) INTO v_info;
  
  IF v_info->>'success' = 'true' THEN
    RAISE NOTICE '✅ SUCCÈS - Plan ID: %', COALESCE(v_info->>'plan_id', 'NON TROUVÉ');
    RAISE NOTICE '   Entreprise: %', COALESCE(v_info->>'entreprise_nom', 'N/A');
  ELSE
    RAISE WARNING '❌ ERREUR: %', v_info->>'error';
  END IF;
  
  -- Test 2: valider_paiement_carte_immediat
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣ Test valider_paiement_carte_immediat...';
  
  SELECT valider_paiement_carte_immediat(v_paiement_id, 'test_stripe_id') INTO v_result;
  
  IF v_result->>'success' = 'true' THEN
    RAISE NOTICE '✅ SUCCÈS - Workflow complet réussi !';
    RAISE NOTICE '   Facture ID: %', COALESCE(v_result->>'facture_id', 'N/A');
    RAISE NOTICE '   Abonnement ID: %', COALESCE(v_result->>'abonnement_id', 'N/A');
    RAISE NOTICE '   Espace membre ID: %', COALESCE(v_result->>'espace_membre_id', 'N/A');
  ELSE
    RAISE WARNING '❌ ERREUR: %', v_result->>'error';
    IF v_result->>'details' IS NOT NULL THEN
      RAISE WARNING '   Détails: %', v_result->>'details';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ TEST TERMINÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
END $$;

-- 3. Vérifier l'état final
SELECT 
  '📊 ÉTAT FINAL' as info,
  p.id as paiement_id,
  p.statut as statut_paiement,
  e.nom as entreprise_nom,
  e.statut as statut_entreprise,
  (SELECT COUNT(*) FROM factures WHERE notes->>'paiement_id' = p.id::text) as nb_factures,
  (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = p.entreprise_id) as nb_abonnements,
  (SELECT COUNT(*) FROM espaces_membres_clients emc 
   JOIN clients c ON c.id = emc.client_id 
   WHERE c.entreprise_id = p.entreprise_id) as nb_espaces_membres
FROM paiements p
LEFT JOIN entreprises e ON e.id = p.entreprise_id
WHERE p.statut IN ('en_attente', 'paye')
ORDER BY p.created_at DESC
LIMIT 3;

