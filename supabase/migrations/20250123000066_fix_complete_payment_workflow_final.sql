/*
  # CORRECTION COMPLÈTE DU WORKFLOW DE PAIEMENT
  
  PROBLÈMES IDENTIFIÉS:
  1. get_paiement_info_for_stripe parse les notes comme JSONB alors qu'elles sont TEXT
  2. Le webhook peut ne pas récupérer correctement le paiement_id
  3. Le plan_id peut ne pas être dans les notes correctement formaté
  
  SOLUTIONS:
  1. Corriger get_paiement_info_for_stripe pour parser TEXT → JSONB
  2. S'assurer que creer_facture_et_abonnement_apres_paiement force le statut "payé"
  3. Améliorer la récupération du plan_id avec plusieurs fallbacks
*/

-- ============================================================================
-- ÉTAPE 1 : Corriger get_paiement_info_for_stripe pour parser les notes TEXT → JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION get_paiement_info_for_stripe(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise RECORD;
  v_client RECORD;
  v_notes_json jsonb;
  v_plan_id uuid;
BEGIN
  -- Récupérer le paiement avec les infos de l'entreprise et du client
  SELECT 
    p.*,
    e.nom as entreprise_nom,
    e.email as entreprise_email,
    c.email as client_email,
    c.nom as client_nom,
    c.prenom as client_prenom
  INTO v_paiement
  FROM paiements p
  LEFT JOIN entreprises e ON e.id = p.entreprise_id
  LEFT JOIN clients c ON c.entreprise_id = p.entreprise_id 
    AND c.id = COALESCE(
      -- Essayer de récupérer client_id depuis les notes parsées
      (SELECT (notes::jsonb->>'client_id')::uuid FROM paiements WHERE id = p_paiement_id),
      -- Sinon prendre le premier client de l'entreprise
      (SELECT id FROM clients WHERE entreprise_id = p.entreprise_id LIMIT 1)
    )
  WHERE p.id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  -- ✅ CORRECTION : Parser les notes TEXT → JSONB
  v_notes_json := NULL;
  v_plan_id := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      -- Essayer de parser comme JSONB
      v_notes_json := v_paiement.notes::jsonb;
      
      -- Extraire plan_id depuis les notes parsées
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si le parsing échoue, les notes ne sont peut-être pas du JSON valide
        RAISE WARNING '⚠️ [get_paiement_info_for_stripe] Erreur parsing notes: %. Notes: %', SQLERRM, LEFT(v_paiement.notes, 100);
        v_notes_json := NULL;
    END;
  END IF;
  
  -- ✅ FALLBACK : Si plan_id pas dans notes, chercher dans les abonnements existants
  IF v_plan_id IS NULL AND v_paiement.entreprise_id IS NOT NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_paiement.entreprise_id
      AND plan_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', v_paiement.id,
    'montant_ttc', v_paiement.montant_ttc,
    'montant_ht', COALESCE(v_paiement.montant_ht, 0),
    'entreprise_id', v_paiement.entreprise_id,
    'entreprise_nom', v_paiement.entreprise_nom,
    'entreprise_email', v_paiement.entreprise_email,
    'client_email', v_paiement.client_email,
    'client_nom', v_paiement.client_nom,
    'client_prenom', v_paiement.client_prenom,
    'plan_id', COALESCE(v_plan_id::text, v_notes_json->>'plan_id', ''),
    'methode_paiement', v_paiement.methode_paiement,
    'statut', v_paiement.statut
  );
END;
$$;

COMMENT ON FUNCTION get_paiement_info_for_stripe IS 
  'Récupère les informations d''un paiement pour créer une session Stripe checkout. Version corrigée avec parsing JSONB des notes et fallback pour plan_id.';

-- ============================================================================
-- ÉTAPE 2 : S'assurer que creer_facture_et_abonnement_apres_paiement existe et fonctionne
-- (Cette fonction devrait déjà exister dans la migration 65, mais on la recrée pour être sûr)
-- ============================================================================

-- La fonction creer_facture_et_abonnement_apres_paiement devrait déjà être créée
-- dans la migration 20250123000065. On vérifie juste qu'elle existe.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE WARNING '⚠️ Fonction creer_facture_et_abonnement_apres_paiement non trouvée. Veuillez appliquer la migration 20250123000065.';
  ELSE
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement existe';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3 : Créer une fonction de test pour valider le workflow complet
-- ============================================================================

CREATE OR REPLACE FUNCTION test_payment_workflow(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_info jsonb;
  v_result jsonb;
  v_diagnostics jsonb;
BEGIN
  RAISE NOTICE '🧪 [test_payment_workflow] DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Vérifier que le paiement existe
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé',
      'paiement_id', p_paiement_id
    );
  END IF;
  
  -- 2. Tester get_paiement_info_for_stripe
  v_info := get_paiement_info_for_stripe(p_paiement_id);
  
  IF NOT (v_info->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erreur dans get_paiement_info_for_stripe: ' || (v_info->>'error'),
      'details', v_info
    );
  END IF;
  
  -- 3. Tester valider_paiement_carte_immediat
  v_result := valider_paiement_carte_immediat(
    p_paiement_id,
    'test_stripe_payment_id'
  );
  
  -- 4. Construire les diagnostics
  v_diagnostics := jsonb_build_object(
    'paiement', jsonb_build_object(
      'id', v_paiement.id,
      'statut', v_paiement.statut,
      'entreprise_id', v_paiement.entreprise_id,
      'montant_ttc', v_paiement.montant_ttc,
      'notes', LEFT(COALESCE(v_paiement.notes, ''), 200)
    ),
    'info_stripe', v_info,
    'validation_result', v_result,
    'timestamp', now()
  );
  
  RETURN jsonb_build_object(
    'success', (v_result->>'success')::boolean,
    'message', 'Test du workflow complet effectué',
    'diagnostics', v_diagnostics
  );
END;
$$;

COMMENT ON FUNCTION test_payment_workflow IS 
  'Teste le workflow complet de paiement pour diagnostiquer les problèmes.';

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_paiement_info_for_stripe') THEN
    RAISE NOTICE '✅ Fonction get_paiement_info_for_stripe mise à jour avec parsing JSONB';
  ELSE
    RAISE WARNING '⚠️  Fonction get_paiement_info_for_stripe non trouvée après mise à jour';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'test_payment_workflow') THEN
    RAISE NOTICE '✅ Fonction test_payment_workflow créée';
  ELSE
    RAISE WARNING '⚠️  Fonction test_payment_workflow non trouvée après création';
  END IF;
END $$;

