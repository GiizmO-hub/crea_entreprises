/*
  ============================================================================
  CORRECTION IMMÉDIATE - PAIEMENT BLOQUÉ À 60%
  ============================================================================
  
  Ce script corrige le paiement spécifique qui est bloqué à 60%.
  Il déclenche manuellement la création de facture, abonnement et droits admin.
  
  PAIEMENT_ID: eee79728-5520-4220-984d-a577614a67f3
  ============================================================================
*/

-- 1. Vérifier l'état actuel du paiement
SELECT 
  '📊 ÉTAT ACTUEL' as info,
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

-- 2. Appeler la fonction de validation pour déclencher le workflow complet
SELECT 
  '🚀 VALIDATION ET CRÉATION AUTOMATIQUE' as info,
  valider_paiement_carte_immediat(
    'eee79728-5520-4220-984d-a577614a67f3'::uuid,
    NULL -- stripe_payment_id, sera récupéré du paiement si disponible
  ) as resultat;

-- 3. Vérifier l'état après correction
SELECT 
  '✅ ÉTAT APRÈS CORRECTION' as info,
  p.id as paiement_id,
  p.statut as statut_paiement,
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

-- 4. Si la fonction n'existe pas ou échoue, créer manuellement
-- (Cette partie sera exécutée seulement si nécessaire)

-- Vérifier si creer_facture_et_abonnement_apres_paiement existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '⚠️ Fonction creer_facture_et_abonnement_apres_paiement non trouvée.';
    RAISE NOTICE '   Veuillez d''abord appliquer la migration 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '⚠️ Fonction valider_paiement_carte_immediat non trouvée.';
    RAISE NOTICE '   Veuillez d''abord appliquer la migration 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql';
  END IF;
END $$;

