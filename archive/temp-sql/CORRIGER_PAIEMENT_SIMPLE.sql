/*
  ============================================================================
  🔧 CORRECTION SIMPLE - PAIEMENT BLOQUÉ À 60%
  ============================================================================
  
  PAIEMENT_ID: eee79728-5520-4220-984d-a577614a67f3
  
  Ce script appelle directement valider_paiement_carte_immediat qui devrait
  créer automatiquement facture, abonnement et espace client.
  
  Si la fonction n'existe pas, appliquez d'abord :
  - 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql
  ============================================================================
*/

-- Appeler directement la fonction de validation complète
SELECT 
  '🚀 VALIDATION COMPLÈTE' as action,
  valider_paiement_carte_immediat(
    'eee79728-5520-4220-984d-a577614a67f3'::uuid,
    NULL
  ) as resultat;

-- Vérifier le résultat
SELECT 
  '✅ VÉRIFICATION' as action,
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
WHERE p.id = 'eee79728-5520-4220-984d-a577614a67f3';

