-- Script pour créer l'abonnement manquant pour le paiement existant

DO $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
BEGIN
  -- Trouver le paiement sans abonnement
  SELECT p.id, p.entreprise_id, p.notes
  INTO v_paiement
  FROM paiements p
  WHERE p.statut = 'paye'
    AND p.entreprise_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM abonnements a
      WHERE a.entreprise_id = p.entreprise_id
        AND a.statut = 'actif'
    )
  LIMIT 1;
  
  IF v_paiement.id IS NOT NULL THEN
    RAISE NOTICE 'Paiement trouvé: %', v_paiement.id;
    RAISE NOTICE 'Entreprise: %', v_paiement.entreprise_id;
    RAISE NOTICE 'Notes: %', v_paiement.notes;
    
    -- Appeler la fonction pour créer l'abonnement
    v_result := creer_facture_et_abonnement_apres_paiement(v_paiement.id);
    
    RAISE NOTICE 'Résultat: %', v_result;
    
    IF (v_result->>'success')::boolean THEN
      RAISE NOTICE '✅ Abonnement créé avec succès !';
      RAISE NOTICE '   Facture ID: %', v_result->>'facture_id';
      RAISE NOTICE '   Abonnement ID: %', v_result->>'abonnement_id';
    ELSE
      RAISE WARNING '❌ Erreur: %', v_result->>'error';
    END IF;
  ELSE
    RAISE NOTICE 'Aucun paiement à traiter';
  END IF;
END $$;

