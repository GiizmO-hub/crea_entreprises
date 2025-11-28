/*
  ============================================================================
  TEST COMPLET DU WORKFLOW DE PAIEMENT
  ============================================================================
  
  Ce script teste le workflow complet de paiement pour identifier les problèmes.
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez tout ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run"
    5. Analysez les résultats ci-dessous
  
  ============================================================================
*/

-- ============================================================================
-- ÉTAPE 1 : Lister les paiements récents
-- ============================================================================

SELECT 
  '📋 LISTE DES PAIEMENTS RÉCENTS' as etape,
  id as paiement_id,
  statut,
  montant_ttc,
  entreprise_id,
  LEFT(notes, 100) as notes_preview,
  created_at
FROM paiements
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- ÉTAPE 2 : Sélectionner un paiement pour tester (remplacez par votre paiement_id)
-- ============================================================================

-- Remplacez cette valeur par un paiement_id réel de votre base
-- Vous pouvez utiliser le premier résultat de l'étape 1
DO $$
DECLARE
  v_paiement_id uuid;
  v_test_result jsonb;
BEGIN
  -- Récupérer le premier paiement en attente ou le plus récent
  SELECT id INTO v_paiement_id
  FROM paiements
  WHERE statut IN ('en_attente', 'paye')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucun paiement trouvé pour tester';
    RETURN;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  🧪 TEST DU WORKFLOW AVEC LE PAIEMENT: %', v_paiement_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
  -- ============================================================================
  -- ÉTAPE 3 : Tester get_paiement_info_for_stripe
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣ Test de get_paiement_info_for_stripe...';
  
  SELECT get_paiement_info_for_stripe(v_paiement_id) INTO v_test_result;
  
  IF v_test_result->>'success' = 'true' THEN
    RAISE NOTICE '✅ get_paiement_info_for_stripe OK';
    RAISE NOTICE '   → Plan ID: %', COALESCE(v_test_result->>'plan_id', 'NON TROUVÉ');
    RAISE NOTICE '   → Entreprise: %', COALESCE(v_test_result->>'entreprise_nom', 'N/A');
    RAISE NOTICE '   → Montant TTC: %€', v_test_result->>'montant_ttc';
  ELSE
    RAISE WARNING '❌ Erreur get_paiement_info_for_stripe: %', v_test_result->>'error';
  END IF;
  
  -- ============================================================================
  -- ÉTAPE 4 : Tester test_payment_workflow (si la fonction existe)
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣ Test du workflow complet...';
  
  BEGIN
    SELECT test_payment_workflow(v_paiement_id) INTO v_test_result;
    
    IF v_test_result->>'success' = 'true' THEN
      RAISE NOTICE '✅ WORKFLOW FONCTIONNE CORRECTEMENT !';
      RAISE NOTICE '   → Voir les détails dans la section diagnostics ci-dessous';
    ELSE
      RAISE WARNING '⚠️  PROBLÈMES DÉTECTÉS: %', v_test_result->>'error';
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  Fonction test_payment_workflow non disponible, test direct...';
      
      -- Test direct de valider_paiement_carte_immediat
      RAISE NOTICE '';
      RAISE NOTICE '4️⃣ Test direct de valider_paiement_carte_immediat...';
      
      SELECT valider_paiement_carte_immediat(v_paiement_id, 'test_stripe_payment_id') INTO v_test_result;
      
      IF v_test_result->>'success' = 'true' THEN
        RAISE NOTICE '✅ Paiement validé avec succès !';
        RAISE NOTICE '   → Facture ID: %', COALESCE(v_test_result->>'facture_id', 'N/A');
        RAISE NOTICE '   → Abonnement ID: %', COALESCE(v_test_result->>'abonnement_id', 'N/A');
        RAISE NOTICE '   → Espace membre ID: %', COALESCE(v_test_result->>'espace_membre_id', 'N/A');
      ELSE
        RAISE WARNING '❌ Erreur lors de la validation: %', v_test_result->>'error';
      END IF;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ TEST TERMINÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
END $$;

-- ============================================================================
-- ÉTAPE 5 : Afficher les résultats détaillés
-- ============================================================================

-- Vérifier l'état final des paiements, factures, abonnements créés
SELECT 
  '📊 ÉTAT FINAL' as etape,
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

-- ============================================================================
-- FIN DU TEST
-- ============================================================================

SELECT '✅ Test terminé ! Consultez les messages NOTICE ci-dessus pour voir les résultats.' as resultat;

