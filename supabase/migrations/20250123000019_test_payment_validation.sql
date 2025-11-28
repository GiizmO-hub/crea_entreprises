/*
  # Test de validation d'un paiement existant
  
  Cette migration teste manuellement la validation d'un paiement pour vérifier
  que le trigger fonctionne correctement.
*/

-- Fonction de test pour valider un paiement manuellement
CREATE OR REPLACE FUNCTION test_valider_paiement_manuel(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Appeler directement la fonction de validation
  v_result := valider_paiement_carte_immediat(p_paiement_id, NULL);
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION test_valider_paiement_manuel IS 
  'Fonction de test pour valider manuellement un paiement et déclencher le trigger.';

GRANT EXECUTE ON FUNCTION test_valider_paiement_manuel(uuid) TO authenticated;




