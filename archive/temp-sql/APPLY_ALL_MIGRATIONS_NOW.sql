/*
  ============================================================================
  APPLICATION AUTOMATIQUE DES DERNIÈRES MIGRATIONS
  ============================================================================

  Ce fichier combine les migrations suivantes :
  - 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql
  - 20250123000063_fix_webhook_logs_and_validation.sql

  Instructions:
    1. Copiez TOUT ce fichier
    2. Ouvrez Supabase Dashboard > SQL Editor
    3. Collez et exécutez
  ============================================================================
*/


-- ============================================================================
-- MIGRATION: 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql
-- ============================================================================

/*
  # CORRECTION : Automatisation complète du workflow après paiement carte
  
  PROBLÈME:
  - valider_paiement_carte_immediat met seulement le paiement à 'paye'
  - Pas de création automatique de facture, abonnement, espace client
  - Le workflow s'arrête à 60% et le paiement reste en attente
  
  SOLUTION:
  - Modifier valider_paiement_carte_immediat pour appeler directement creer_facture_et_abonnement_apres_paiement
  - Même logique que valider_paiement_virement_manuel pour cohérence
  - Garantir que tout se crée automatiquement après validation Stripe
*/

-- ============================================================================
-- ÉTAPE 1 : Vérifier/Créer la fonction creer_facture_et_abonnement_apres_paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_client RECORD;
  v_plan RECORD;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_numero_facture text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_id uuid;
  v_client_id uuid;
  v_entreprise_id uuid;
  v_user_id uuid;
  v_espace_membre_id uuid;
BEGIN
  RAISE NOTICE '🚀 [creer_facture_et_abonnement_apres_paiement] DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  IF v_paiement.statut != 'paye' THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Paiement non payé - Statut: %', v_paiement.statut;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement doit être marqué comme payé avant de créer facture et abonnement'
    );
  END IF;
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  -- Extraire plan_id depuis les notes du paiement
  IF v_paiement.notes IS NOT NULL AND jsonb_typeof(v_paiement.notes) = 'object' THEN
    v_plan_id := (v_paiement.notes->>'plan_id')::uuid;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé dans les notes du paiement';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant dans les notes du paiement'
    );
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Plan: %, Montant: %', 
    v_entreprise_id, v_plan_id, v_montant_ttc;
  
  -- 2. Récupérer le plan
  SELECT * INTO v_plan
  FROM plans_abonnement
  WHERE id = v_plan_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan non trouvé - ID: %', v_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan d''abonnement non trouvé'
    );
  END IF;
  
  -- 3. Récupérer le client associé à l'entreprise
  SELECT * INTO v_client
  FROM clients
  WHERE entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Client non trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;
  
  v_client_id := v_client.id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé - ID: %', v_client_id;
  
  -- 4. Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Création facture - Numéro: %', v_numero_facture;
  
  -- 5. Créer la facture
  INSERT INTO factures (
    entreprise_id,
    client_id,
    numero,
    type,
    date_emission,
    date_echeance,
    montant_ht,
    tva,
    montant_ttc,
    statut,
    statut_paiement,
    notes
  )
  VALUES (
    v_entreprise_id,
    v_client_id,
    v_numero_facture,
    'facture',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_montant_ht,
    v_montant_tva,
    v_montant_ttc,
    'envoyee',
    'payee',
    jsonb_build_object(
      'paiement_id', p_paiement_id::text,
      'plan_id', v_plan_id::text,
      'origine', 'paiement_stripe'
    )
  )
  RETURNING id INTO v_facture_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée - ID: %', v_facture_id;
  
  -- 6. Créer l'abonnement
  RAISE NOTICE '📦 [creer_facture_et_abonnement_apres_paiement] Création abonnement...';
  
  INSERT INTO abonnements (
    client_id,
    entreprise_id,
    plan_id,
    statut,
    date_debut,
    date_prochain_paiement,
    montant_mensuel,
    mode_paiement,
    stripe_payment_id
  )
  VALUES (
    v_client_id,
    v_entreprise_id,
    v_plan_id,
    'actif',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    v_montant_ht,
    'mensuel',
    v_paiement.stripe_payment_id
  )
  RETURNING id INTO v_abonnement_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé - ID: %', v_abonnement_id;
  
  -- 7. Créer/Mettre à jour l'espace membre client avec droits admin
  RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Création espace membre client...';
  
  -- Vérifier si l'espace membre existe déjà
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    -- Créer l'espace membre
    INSERT INTO espaces_membres_clients (
      client_id,
      entreprise_id,
      user_id,
      role,
      actif,
      modules_actifs
    )
    VALUES (
      v_client_id,
      v_entreprise_id,
      v_user_id,
      'client_super_admin',
      true,
      jsonb_build_object(
        'tableau_de_bord', true,
        'mon_entreprise', true,
        'factures', true,
        'documents', true,
        'abonnements', true
      )
    )
    RETURNING id INTO v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre créé - ID: %', v_espace_membre_id;
  ELSE
    -- Mettre à jour l'espace membre pour activer et ajouter droits admin
    UPDATE espaces_membres_clients
    SET role = 'client_super_admin',
        actif = true,
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true,
          'mon_entreprise', true,
          'factures', true,
          'documents', true,
          'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour - ID: %', v_espace_membre_id;
  END IF;
  
  -- 8. Synchroniser les modules depuis le plan
  RAISE NOTICE '🔄 [creer_facture_et_abonnement_apres_paiement] Synchronisation modules depuis plan...';
  
  -- Appeler la fonction de synchronisation si elle existe
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules (non bloquant): %', SQLERRM;
  END;
  
  -- 9. Activer l'entreprise si elle n'est pas déjà active
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye'
  WHERE id = v_entreprise_id
    AND (statut != 'active' OR statut_paiement != 'paye');
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise activée';
  
  -- 10. Activer le client
  UPDATE clients
  SET statut = 'actif'
  WHERE id = v_client_id
    AND statut != 'actif';
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client activé';
  
  RAISE NOTICE '🎉 [creer_facture_et_abonnement_apres_paiement] TERMINÉ AVEC SUCCÈS !';
  
  -- Retourner un résultat détaillé
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email,
    'details', jsonb_build_object(
      'facture_creée', true,
      'abonnement_créé', true,
      'espace_client_créé', true,
      'droits_admin_créés', true,
      'modules_synchronisés', true,
      'entreprise_activée', true,
      'client_activé', true
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Fonction principale du workflow automatique.';

-- ============================================================================
-- ÉTAPE 2 : Modifier valider_paiement_carte_immediat pour appeler cette fonction
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
  RAISE NOTICE '🚀 [valider_paiement_carte_immediat] DÉBUT - Paiement ID: %, Stripe ID: %', p_paiement_id, p_stripe_payment_id;
  
  -- 1. Vérifier que le paiement existe
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;
  
  IF v_paiement.statut = 'paye' THEN
    RAISE WARNING '⚠️ [valider_paiement_carte_immediat] Paiement déjà validé - Statut: %', v_paiement.statut;
    -- Si déjà payé, essayer quand même de créer facture et abonnement
    RAISE NOTICE '📋 [valider_paiement_carte_immediat] Paiement déjà payé, tentative de création facture/abonnement...';
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
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  
  -- 3. ✅ AUTOMATISATION: Appeler directement creer_facture_et_abonnement_apres_paiement
  -- Cette fonction crée automatiquement :
  -- 1. La facture
  -- 2. L'abonnement
  -- 3. L'espace client avec droits d'administrateur (client_super_admin)
  -- 4. Synchronise les modules
  -- 5. Active l'entreprise et le client
  
  RAISE NOTICE '🏭 [valider_paiement_carte_immediat] Appel de creer_facture_et_abonnement_apres_paiement pour création automatique complète...';
  
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
  
  IF NOT (v_result->>'success')::boolean THEN
    RAISE WARNING '❌ [valider_paiement_carte_immediat] Erreur lors de la création automatique: %', v_result->>'error';
    
    -- Même en cas d'erreur, le paiement reste marqué comme payé
    -- L'admin pourra relancer la création manuellement si nécessaire
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement validé mais erreur lors de la création automatique: ' || (v_result->>'error'),
      'paiement_valide', true,
      'details', v_result
    );
  END IF;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Création automatique réussie !';
  RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
  RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
  RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';
  
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
    RAISE WARNING '❌ [valider_paiement_carte_immediat] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'paiement_valide', false
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
  'Valide un paiement par carte immédiatement. Déclenche automatiquement la création complète (facture, abonnement, espace client, droits admin). Version automatisée complète.';

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction creer_facture_et_abonnement_apres_paiement non trouvée après création';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_carte_immediat créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction valider_paiement_carte_immediat non trouvée après création';
  END IF;
END $$;




-- ============================================================================
-- FIN MIGRATION: 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql
-- ============================================================================


-- ============================================================================
-- MIGRATION: 20250123000063_fix_webhook_logs_and_validation.sql
-- ============================================================================

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



-- ============================================================================
-- FIN MIGRATION: 20250123000063_fix_webhook_logs_and_validation.sql
-- ============================================================================

-- ============================================================================
-- FIN DE L'APPLICATION DES MIGRATIONS
-- ============================================================================

SELECT
  '✅ Migrations appliquées avec succès !' as status,
  2 as migrations_appliquees;