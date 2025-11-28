-- ============================================================================
-- DIAGNOSTIC ET CORRECTION DU PAIEMENT
-- ============================================================================

-- 1. Vérifier les informations du paiement
SELECT 
  id,
  entreprise_id,
  statut,
  (notes::jsonb->>'entreprise_id')::uuid as entreprise_id_from_notes,
  (notes::jsonb->>'client_id')::uuid as client_id_from_notes,
  (notes::jsonb->>'plan_id')::uuid as plan_id_from_notes,
  (notes::jsonb->>'description')::text as description
FROM paiements
WHERE id = '2b2c93ae-8ac3-4831-bcca-9728d889014c';

-- 2. Vérifier si l'entreprise existe
SELECT 
  id, nom, statut, user_id
FROM entreprises
WHERE id = (SELECT (notes::jsonb->>'entreprise_id')::uuid 
            FROM paiements 
            WHERE id = '2b2c93ae-8ac3-4831-bcca-9728d889014c');

-- 3. Vérifier si des entreprises existent pour ce user
SELECT 
  id, nom, statut, user_id, created_at
FROM entreprises
WHERE user_id = (SELECT user_id 
                 FROM paiements 
                 WHERE id = '2b2c93ae-8ac3-4831-bcca-9728d889014c')
ORDER BY created_at DESC
LIMIT 5;

-- Note: L'entreprise référencée dans les notes n'existe pas.
-- Il faudra créer une nouvelle entreprise ou utiliser un paiement avec une entreprise existante.

