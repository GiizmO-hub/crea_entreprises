/*
  ============================================================================
  APPLICATION MIGRATION 67 + TEST AUTOMATIQUE
  ============================================================================
  
  Ce script :
  1. Applique la migration 20250123000067 (correction colonne statut_paiement)
  2. Teste automatiquement le workflow
  3. Affiche les résultats détaillés
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run"
    5. Analysez les résultats dans les messages NOTICE
  
  ============================================================================
*/

-- ============================================================================
-- MIGRATION 20250123000067 : CORRECTION COLONNE statut_paiement
-- ============================================================================

-- Voir le contenu complet dans : supabase/migrations/20250123000067_fix_factures_statut_paiement_column.sql

-- Pour simplifier, on applique directement la fonction corrigée :

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
  v_notes_json jsonb;
  v_statut_initial text;
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
  
  v_statut_initial := v_paiement.statut;
  RAISE NOTICE '📋 [creer_facture_et_abonnement_apres_paiement] Statut initial: %', v_statut_initial;
  
  -- ✅ Si le paiement n'est pas "payé", le marquer comme "payé"
  IF v_paiement.statut != 'paye' THEN
    RAISE NOTICE '⚠️ [creer_facture_et_abonnement_apres_paiement] Paiement en statut "%" - Marquage comme "payé"...', v_statut_initial;
    
    UPDATE paiements
    SET methode_paiement = COALESCE(NULLIF(methode_paiement, ''), 'stripe'),
        statut = 'paye',
        date_paiement = COALESCE(date_paiement, CURRENT_DATE),
        updated_at = now()
    WHERE id = p_paiement_id;
    
    SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement marqué comme "payé"';
  END IF;
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  -- 2. Parser les notes (TEXT) en JSONB
  v_notes_json := NULL;
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      v_notes_json := v_paiement.notes::jsonb;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées comme JSONB';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
        v_notes_json := NULL;
    END;
  END IF;
  
  -- 3. Extraire plan_id depuis les notes
  IF v_notes_json IS NOT NULL AND jsonb_typeof(v_notes_json) = 'object' AND v_notes_json ? 'plan_id' THEN
    v_plan_id := (v_notes_json->>'plan_id')::uuid;
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes: %', v_plan_id;
  END IF;
  
  -- 4. FALLBACK 1 : Chercher dans abonnements existants
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id AND plan_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans abonnement existant: %', v_plan_id;
    END IF;
  END IF;
  
  -- 5. FALLBACK 2 : Via get_paiement_info_for_stripe
  IF v_plan_id IS NULL THEN
    BEGIN
      SELECT (result->>'plan_id')::uuid INTO v_plan_id
      FROM (SELECT get_paiement_info_for_stripe(p_paiement_id) as result) sub
      WHERE (result->>'plan_id')::uuid IS NOT NULL;
      
      IF v_plan_id IS NOT NULL THEN
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé via get_paiement_info_for_stripe: %', v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur get_paiement_info_for_stripe: %', SQLERRM;
    END;
  END IF;
  
  -- 6. Si plan_id toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant. Impossible de créer l''abonnement.',
      'details', jsonb_build_object(
        'paiement_id', p_paiement_id,
        'entreprise_id', v_entreprise_id,
        'notes', LEFT(COALESCE(v_paiement.notes, ''), 200)
      )
    );
  END IF;
  
  -- 7. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan d''abonnement non trouvé');
  END IF;
  
  -- 8. Récupérer le client
  SELECT * INTO v_client FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client trouvé pour cette entreprise');
  END IF;
  
  v_client_id := v_client.id;
  
  -- 9. Générer numéro facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- 10. ✅ CORRECTION : Créer la facture SANS statut_paiement (cette colonne n'existe pas)
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
    'payee',
    jsonb_build_object(
      'paiement_id', p_paiement_id::text,
      'plan_id', v_plan_id::text,
      'origine', 'paiement_stripe'
    )::text
  )
  RETURNING id INTO v_facture_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée - ID: %', v_facture_id;
  
  -- 11. Créer l'abonnement
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
  
  -- 12. Créer/Mettre à jour l'espace membre client
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    INSERT INTO espaces_membres_clients (
      client_id, entreprise_id, user_id, role, actif, modules_actifs
    )
    VALUES (
      v_client_id, v_entreprise_id, v_user_id, 'client_super_admin', true,
      jsonb_build_object(
        'tableau_de_bord', true, 'mon_entreprise', true,
        'factures', true, 'documents', true, 'abonnements', true
      )
    )
    RETURNING id INTO v_espace_membre_id;
  ELSE
    UPDATE espaces_membres_clients
    SET role = 'client_super_admin', actif = true,
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre créé/mis à jour - ID: %', v_espace_membre_id;
  
  -- 13. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ Erreur synchronisation modules (non bloquant): %', SQLERRM;
  END;
  
  -- 14. Activer entreprise
  UPDATE entreprises
  SET statut = 'active', statut_paiement = 'paye'
  WHERE id = v_entreprise_id AND (statut != 'active' OR statut_paiement != 'paye');
  
  -- 15. Activer client
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND statut != 'actif';
  
  RAISE NOTICE '🎉 [creer_facture_et_abonnement_apres_paiement] TERMINÉ AVEC SUCCÈS !';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email,
    'details', jsonb_build_object(
      'facture_creée', true, 'abonnement_créé', true,
      'espace_client_créé', true, 'droits_admin_créés', true,
      'entreprise_activée', true, 'client_activé', true
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

-- ============================================================================
-- TEST AUTOMATIQUE
-- ============================================================================

DO $$
DECLARE
  v_paiement_id uuid;
  v_result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '  🧪 TEST AUTOMATIQUE DU WORKFLOW';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  
  -- Trouver un paiement en attente
  SELECT id INTO v_paiement_id
  FROM paiements
  WHERE statut = 'en_attente'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucun paiement en attente trouvé, test avec un paiement payé...';
    SELECT id INTO v_paiement_id
    FROM paiements
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE '❌ Aucun paiement trouvé pour tester';
    RETURN;
  END IF;
  
  RAISE NOTICE '📋 Paiement ID: %', v_paiement_id;
  RAISE NOTICE '';
  
  -- Tester valider_paiement_carte_immediat
  RAISE NOTICE '1️⃣ Test de valider_paiement_carte_immediat...';
  SELECT valider_paiement_carte_immediat(v_paiement_id, 'test_stripe_after_migration') INTO v_result;
  
  IF v_result->>'success' = 'true' THEN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ✅ WORKFLOW RÉUSSI !';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
    RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
    RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ❌ ERREUR';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE WARNING 'Erreur: %', v_result->>'error';
  END IF;
  
  RAISE NOTICE '';
  
END $$;

-- ============================================================================
-- VÉRIFICATION ÉTAT FINAL
-- ============================================================================

SELECT 
  '📊 ÉTAT FINAL' as info,
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
ORDER BY p.created_at DESC
LIMIT 3;

SELECT '✅ Migration appliquée et test terminé !' as resultat;

