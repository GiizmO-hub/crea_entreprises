/*
  ============================================================================
  TEST ET CORRECTION DU WORKFLOW DE PAIEMENT
  ============================================================================
  
  Ce script :
  1. Applique la correction si nécessaire
  2. Teste le workflow complet
  3. Affiche les résultats détaillés
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez tout ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run"
    5. Consultez les résultats
  
  ============================================================================
*/

-- ============================================================================
-- ÉTAPE 1 : Lister les paiements récents
-- ============================================================================

SELECT 
  '📋 PAIEMENTS DISPONIBLES' as info,
  id as paiement_id,
  statut,
  montant_ttc,
  entreprise_id,
  LEFT(COALESCE(notes, ''), 50) as notes_preview,
  created_at
FROM paiements
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- ÉTAPE 2 : Test automatique du workflow
-- ============================================================================

DO $$
DECLARE
  v_paiement_id uuid;
  v_paiement_statut text;
  v_paiement_notes text;
  v_info jsonb;
  v_result jsonb;
  v_notes_json jsonb;
  v_plan_id uuid;
BEGIN
  -- Récupérer le premier paiement en attente ou payé
  SELECT id, statut, notes INTO v_paiement_id, v_paiement_statut, v_paiement_notes
  FROM paiements
  WHERE statut IN ('en_attente', 'paye')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucun paiement trouvé pour tester';
    RETURN;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  🧪 TEST DU WORKFLOW';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Paiement ID: %', v_paiement_id;
  RAISE NOTICE 'Statut actuel: %', v_paiement_statut;
  RAISE NOTICE 'Notes: %', LEFT(COALESCE(v_paiement_notes, ''), 100);
  RAISE NOTICE '';
  
  -- Test 1: Vérifier le parsing des notes
  RAISE NOTICE '1️⃣ Analyse des notes du paiement...';
  IF v_paiement_notes IS NOT NULL AND v_paiement_notes != '' THEN
    BEGIN
      v_notes_json := v_paiement_notes::jsonb;
      RAISE NOTICE '✅ Notes parsées comme JSONB';
      
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
        RAISE NOTICE '✅ Plan ID trouvé dans notes: %', v_plan_id;
      ELSE
        RAISE WARNING '⚠️  Plan ID non trouvé dans les notes';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur parsing notes: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING '⚠️  Pas de notes dans le paiement';
  END IF;
  
  -- Test 2: get_paiement_info_for_stripe
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣ Test get_paiement_info_for_stripe...';
  
  SELECT get_paiement_info_for_stripe(v_paiement_id) INTO v_info;
  
  IF v_info->>'success' = 'true' THEN
    RAISE NOTICE '✅ SUCCÈS';
    RAISE NOTICE '   → Plan ID: %', COALESCE(v_info->>'plan_id', 'NON TROUVÉ');
    RAISE NOTICE '   → Entreprise: %', COALESCE(v_info->>'entreprise_nom', 'N/A');
    RAISE NOTICE '   → Montant TTC: %€', v_info->>'montant_ttc';
    
    IF v_info->>'plan_id' IS NULL OR v_info->>'plan_id' = '' THEN
      RAISE WARNING '❌ PROBLÈME: Plan ID non récupéré !';
    END IF;
  ELSE
    RAISE WARNING '❌ ERREUR: %', v_info->>'error';
  END IF;
  
  -- Test 3: valider_paiement_carte_immediat
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣ Test valider_paiement_carte_immediat...';
  
  SELECT valider_paiement_carte_immediat(v_paiement_id, 'test_stripe_id') INTO v_result;
  
  IF v_result->>'success' = 'true' THEN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ✅ WORKFLOW RÉUSSI !';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '   → Facture ID: %', COALESCE(v_result->>'facture_id', 'N/A');
    RAISE NOTICE '   → Abonnement ID: %', COALESCE(v_result->>'abonnement_id', 'N/A');
    RAISE NOTICE '   → Espace membre ID: %', COALESCE(v_result->>'espace_membre_id', 'N/A');
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ❌ ERREUR DÉTECTÉE';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE WARNING 'Erreur: %', v_result->>'error';
    IF v_result->>'details' IS NOT NULL THEN
      RAISE WARNING 'Détails: %', v_result->>'details';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  
END $$;

-- ============================================================================
-- ÉTAPE 3 : Vérifier l'état final
-- ============================================================================

SELECT 
  '📊 ÉTAT FINAL APRÈS TEST' as info,
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

SELECT '✅ Test terminé ! Consultez les messages NOTICE ci-dessus.' as resultat;

