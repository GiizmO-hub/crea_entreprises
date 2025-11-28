/*
  # AMÉLIORATION : Logs détaillés et vérification du workflow
  
  PROBLÈME:
  - Le workflow s'arrête à 60% après paiement Stripe
  - On ne sait pas si valider_paiement_carte_immediat est appelé
  - On ne sait pas si creer_facture_et_abonnement_apres_paiement est exécutée
  
  SOLUTION:
  - Ajouter des logs PostgreSQL détaillés dans les fonctions
  - Créer une fonction de diagnostic pour vérifier l'état du workflow
  - Améliorer la gestion d'erreurs
*/

-- ============================================================================
-- ÉTAPE 1 : Fonction de diagnostic pour vérifier l'état du workflow
-- ============================================================================

CREATE OR REPLACE FUNCTION diagnostic_workflow_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_facture RECORD;
  v_abonnement RECORD;
  v_espace_membre RECORD;
  v_result jsonb;
BEGIN
  -- Récupérer le paiement
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
  
  -- Vérifier la facture
  SELECT * INTO v_facture
  FROM factures
  WHERE notes->>'paiement_id' = p_paiement_id::text
  LIMIT 1;
  
  -- Vérifier l'abonnement
  SELECT * INTO v_abonnement
  FROM abonnements
  WHERE client_id IN (
    SELECT id FROM clients WHERE entreprise_id = v_paiement.entreprise_id
  )
  AND entreprise_id = v_paiement.entreprise_id
  LIMIT 1;
  
  -- Vérifier l'espace membre
  SELECT * INTO v_espace_membre
  FROM espaces_membres_clients
  WHERE client_id IN (
    SELECT id FROM clients WHERE entreprise_id = v_paiement.entreprise_id
  )
  AND entreprise_id = v_paiement.entreprise_id
  LIMIT 1;
  
  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'paiement', jsonb_build_object(
      'id', v_paiement.id,
      'statut', v_paiement.statut,
      'montant_ttc', v_paiement.montant_ttc,
      'date_paiement', v_paiement.date_paiement,
      'stripe_payment_id', v_paiement.stripe_payment_id
    ),
    'facture', CASE 
      WHEN v_facture.id IS NOT NULL THEN jsonb_build_object(
        'id', v_facture.id,
        'numero', v_facture.numero,
        'statut', v_facture.statut,
        'statut_paiement', v_facture.statut_paiement
      )
      ELSE jsonb_build_object('existe', false)
    END,
    'abonnement', CASE
      WHEN v_abonnement.id IS NOT NULL THEN jsonb_build_object(
        'id', v_abonnement.id,
        'statut', v_abonnement.statut,
        'plan_id', v_abonnement.plan_id,
        'date_debut', v_abonnement.date_debut
      )
      ELSE jsonb_build_object('existe', false)
    END,
    'espace_membre', CASE
      WHEN v_espace_membre.id IS NOT NULL THEN jsonb_build_object(
        'id', v_espace_membre.id,
        'role', v_espace_membre.role,
        'actif', v_espace_membre.actif
      )
      ELSE jsonb_build_object('existe', false)
    END,
    'workflow_complet', (
      v_paiement.statut = 'paye' AND
      v_facture.id IS NOT NULL AND
      v_abonnement.id IS NOT NULL AND
      v_espace_membre.id IS NOT NULL
    )
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION diagnostic_workflow_paiement IS 
  'Diagnostique l''état complet du workflow après un paiement. Utile pour identifier où le processus s''arrête.';

-- ============================================================================
-- ÉTAPE 2 : Améliorer les logs dans creer_facture_et_abonnement_apres_paiement
-- ============================================================================

-- La fonction existe déjà dans la migration 20250123000062
-- On ajoute juste des logs supplémentaires pour le diagnostic

-- ============================================================================
-- ÉTAPE 3 : Créer une table de logs pour tracer le workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid REFERENCES paiements(id) ON DELETE CASCADE,
  etape text NOT NULL,
  message text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_paiement_id ON workflow_logs(paiement_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created_at ON workflow_logs(created_at);

-- Fonction pour ajouter un log
CREATE OR REPLACE FUNCTION log_workflow_step(
  p_paiement_id uuid,
  p_etape text,
  p_message text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  INSERT INTO workflow_logs (paiement_id, etape, message, details)
  VALUES (p_paiement_id, p_etape, p_message, p_details);
  
  RAISE NOTICE '📋 [WORKFLOW_LOG] % - %: %', p_etape, p_paiement_id, p_message;
END;
$$;

-- ============================================================================
-- ÉTAPE 4 : Modifier valider_paiement_carte_immediat pour ajouter des logs
-- ============================================================================

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_paiement RECORD;
BEGIN
  -- Log début
  PERFORM log_workflow_step(
    p_paiement_id,
    'validation_debut',
    'Début de la validation du paiement par carte',
    jsonb_build_object('stripe_payment_id', p_stripe_payment_id)
  );
  
  RAISE NOTICE '🚀 [valider_paiement_carte_immediat] DÉBUT - Paiement ID: %, Stripe ID: %', p_paiement_id, p_stripe_payment_id;
  
  -- 1. Vérifier que le paiement existe
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    PERFORM log_workflow_step(
      p_paiement_id,
      'validation_erreur',
      'Paiement non trouvé',
      NULL
    );
    
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  IF v_paiement.statut = 'paye' THEN
    RAISE WARNING '⚠️ [valider_paiement_carte_immediat] Paiement déjà validé - Statut: %', v_paiement.statut;
    PERFORM log_workflow_step(
      p_paiement_id,
      'validation_deja_paye',
      'Paiement déjà validé, tentative de création facture/abonnement',
      jsonb_build_object('statut', v_paiement.statut)
    );
  END IF;
  
  -- 2. Marquer le paiement comme payé
  RAISE NOTICE '📝 [valider_paiement_carte_immediat] Marquage du paiement comme payé...';
  
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  PERFORM log_workflow_step(
    p_paiement_id,
    'validation_paye',
    'Paiement marqué comme payé',
    jsonb_build_object('stripe_payment_id', COALESCE(p_stripe_payment_id, v_paiement.stripe_payment_id))
  );
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  
  -- 3. ✅ AUTOMATISATION: Appeler directement creer_facture_et_abonnement_apres_paiement
  RAISE NOTICE '🏭 [valider_paiement_carte_immediat] Appel de creer_facture_et_abonnement_apres_paiement pour création automatique complète...';
  
  PERFORM log_workflow_step(
    p_paiement_id,
    'creation_automatique_debut',
    'Début de la création automatique (facture, abonnement, espace client)',
    NULL
  );
  
  BEGIN
    v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
    
    IF NOT (v_result->>'success')::boolean THEN
      PERFORM log_workflow_step(
        p_paiement_id,
        'creation_automatique_erreur',
        'Erreur lors de la création automatique',
        v_result
      );
      
      RAISE WARNING '❌ [valider_paiement_carte_immediat] Erreur lors de la création automatique: %', v_result->>'error';
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Paiement validé mais erreur lors de la création automatique: ' || (v_result->>'error'),
        'paiement_valide', true,
        'details', v_result
      );
    END IF;
    
    PERFORM log_workflow_step(
      p_paiement_id,
      'creation_automatique_succes',
      'Création automatique réussie',
      jsonb_build_object(
        'facture_id', v_result->>'facture_id',
        'abonnement_id', v_result->>'abonnement_id',
        'espace_membre_id', v_result->>'espace_membre_id'
      )
    );
    
    RAISE NOTICE '✅ [valider_paiement_carte_immediat] Création automatique réussie !';
    RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
    RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
    RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';
    
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_workflow_step(
        p_paiement_id,
        'creation_automatique_exception',
        'Exception lors de la création automatique',
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
      );
      
      RAISE WARNING '❌ [valider_paiement_carte_immediat] Exception lors de la création automatique: % - %', SQLERRM, SQLSTATE;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Exception lors de la création automatique: ' || SQLERRM,
        'paiement_valide', true,
        'sqlstate', SQLSTATE
      );
  END;
  
  PERFORM log_workflow_step(
    p_paiement_id,
    'validation_termine',
    'Validation complète terminée avec succès',
    v_result
  );
  
  -- Retourner un résultat détaillé
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement par carte validé. Génération automatique complète effectuée avec succès',
    'paiement_id', p_paiement_id,
    'facture_id', v_result->>'facture_id',
    'numero_facture', v_result->>'numero_facture',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'email', v_result->>'email',
    'details', v_result->'details'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_workflow_step(
      p_paiement_id,
      'validation_exception',
      'Exception lors de la validation',
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
    );
    
    RAISE WARNING '❌ [valider_paiement_carte_immediat] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'paiement_valide', false
    );
END;
$$;

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'diagnostic_workflow_paiement') THEN
    RAISE NOTICE '✅ Fonction diagnostic_workflow_paiement créée avec succès';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_workflow_step') THEN
    RAISE NOTICE '✅ Fonction log_workflow_step créée avec succès';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_logs') THEN
    RAISE NOTICE '✅ Table workflow_logs créée avec succès';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_carte_immediat mise à jour avec logs';
  END IF;
END $$;

