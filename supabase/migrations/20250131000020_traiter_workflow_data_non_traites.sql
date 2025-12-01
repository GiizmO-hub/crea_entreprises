/*
  # Traiter les workflow_data non traités pour les paiements validés
  
  PROBLÈME:
  - Il y a 20 workflow_data non traités dans la base
  - Ces workflow_data correspondent probablement à des paiements déjà validés
  - Le workflow n'a pas été exécuté pour ces paiements
  
  SOLUTION:
  - Traiter tous les workflow_data non traités qui ont un paiement avec statut='paye'
  - Appeler creer_facture_et_abonnement_apres_paiement pour chaque paiement
*/

DO $$
DECLARE
  v_workflow_data RECORD;
  v_result jsonb;
  v_count_processed INTEGER := 0;
  v_count_errors INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  🔄 TRAITEMENT DES WORKFLOW_DATA NON TRAITÉS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  FOR v_workflow_data IN
    SELECT 
      wd.paiement_id,
      wd.entreprise_id,
      wd.client_id,
      wd.plan_id,
      p.statut as paiement_statut
    FROM workflow_data wd
    JOIN paiements p ON p.id = wd.paiement_id
    WHERE wd.traite = false
      AND p.statut = 'paye'
      AND p.entreprise_id IS NOT NULL
    ORDER BY wd.created_at ASC
  LOOP
    BEGIN
      RAISE NOTICE '🔄 Traitement workflow_data pour paiement: %', v_workflow_data.paiement_id;
      
      -- Appeler la fonction de création
      v_result := creer_facture_et_abonnement_apres_paiement(v_workflow_data.paiement_id);
      
      IF v_result->>'success' = 'true' THEN
        v_count_processed := v_count_processed + 1;
        RAISE NOTICE '✅ Workflow traité avec succès pour paiement: %', v_workflow_data.paiement_id;
      ELSE
        v_count_errors := v_count_errors + 1;
        RAISE WARNING '❌ Erreur traitement workflow pour paiement %: %', 
          v_workflow_data.paiement_id, 
          v_result->>'error';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_count_errors := v_count_errors + 1;
        RAISE WARNING '❌ Exception lors du traitement workflow pour paiement %: % - %', 
          v_workflow_data.paiement_id, 
          SQLERRM, 
          SQLSTATE;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Workflows traités: %', v_count_processed;
  RAISE NOTICE '  Erreurs: %', v_count_errors;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT '✅ Traitement des workflow_data non traités terminé !' as resultat;

