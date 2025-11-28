/*
  # Corriger les paiements existants qui n'ont pas généré facture/abonnement
  
  Fonction pour forcer la génération pour un paiement déjà payé
*/

-- Fonction pour générer manuellement pour un paiement payé existant
CREATE OR REPLACE FUNCTION generer_facture_abonnement_pour_paiement_paye(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
  v_nb_factures integer;
  v_nb_abonnements integer;
BEGIN
  -- Vérifier que le paiement existe et est payé
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  IF v_paiement.statut != 'paye' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement n''est pas payé. Statut actuel: ' || v_paiement.statut
    );
  END IF;

  IF v_paiement.entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce paiement n''est pas lié à une entreprise'
    );
  END IF;

  -- Vérifier si déjà créé
  SELECT COUNT(*) INTO v_nb_factures
  FROM factures
  WHERE entreprise_id = v_paiement.entreprise_id;

  SELECT COUNT(*) INTO v_nb_abonnements
  FROM abonnements ab
  WHERE ab.client_id IN (
    SELECT au.id FROM auth.users au
    WHERE au.email IN (
      SELECT c.email FROM clients c WHERE c.entreprise_id = v_paiement.entreprise_id LIMIT 1
    )
  );

  IF v_nb_factures > 0 AND v_nb_abonnements > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Facture et abonnement existent déjà',
      'factures', v_nb_factures,
      'abonnements', v_nb_abonnements
    );
  END IF;

  -- Appeler la fonction de création
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION generer_facture_abonnement_pour_paiement_paye IS 
  'Génère manuellement facture et abonnement pour un paiement déjà payé qui n\'a pas encore été traité.';

GRANT EXECUTE ON FUNCTION generer_facture_abonnement_pour_paiement_paye(uuid) TO authenticated;

-- Script pour traiter tous les paiements payés sans facture
CREATE OR REPLACE FUNCTION traiter_tous_paiements_payes_sans_facture()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_traites integer := 0;
  v_erreurs integer := 0;
  v_result jsonb;
BEGIN
  -- Trouver tous les paiements payés sans facture
  FOR v_paiement IN
    SELECT p.id
    FROM paiements p
    WHERE p.statut = 'paye'
      AND p.entreprise_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM factures f WHERE f.entreprise_id = p.entreprise_id
      )
  LOOP
    BEGIN
      v_result := generer_facture_abonnement_pour_paiement_paye(v_paiement.id);
      
      IF (v_result->>'success')::boolean THEN
        v_traites := v_traites + 1;
      ELSE
        v_erreurs := v_erreurs + 1;
        RAISE NOTICE 'Erreur pour paiement %: %', v_paiement.id, v_result->>'error';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_erreurs := v_erreurs + 1;
      RAISE NOTICE 'Exception pour paiement %: %', v_paiement.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'traites', v_traites,
    'erreurs', v_erreurs,
    'message', format('%s paiement(s) traité(s), %s erreur(s)', v_traites, v_erreurs)
  );
END;
$$;

COMMENT ON FUNCTION traiter_tous_paiements_payes_sans_facture IS 
  'Traite tous les paiements payés qui n\'ont pas encore généré de facture/abonnement.';

GRANT EXECUTE ON FUNCTION traiter_tous_paiements_payes_sans_facture() TO authenticated;

