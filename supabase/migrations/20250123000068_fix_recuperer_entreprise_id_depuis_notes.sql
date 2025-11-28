/*
  # CORRECTION : Récupérer entreprise_id depuis les notes si NULL
  
  PROBLÈME IDENTIFIÉ:
  - Le paiement a entreprise_id = NULL dans la table
  - Mais entreprise_id est stocké dans les notes (JSON)
  - La fonction ne récupère pas l'entreprise_id depuis les notes
  
  SOLUTION:
  - Récupérer entreprise_id depuis les notes si elle n'est pas dans le paiement
  - Mettre à jour le paiement avec l'entreprise_id trouvé
  - Récupérer ou créer le client depuis les notes
*/

-- ============================================================================
-- CORRECTION : creer_facture_et_abonnement_apres_paiement
-- Récupérer entreprise_id et client depuis les notes si nécessaire
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
  v_notes_json jsonb;
  v_statut_initial text;
  v_entreprise_id_from_notes uuid;
  v_client_id_from_notes uuid;
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
  
  -- ✅ NOUVEAU : Si le paiement n'est pas "payé", le marquer comme "payé"
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
  
  -- 2. ✅ Parser les notes (TEXT) en JSONB
  v_notes_json := NULL;
  v_entreprise_id_from_notes := NULL;
  v_client_id_from_notes := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      v_notes_json := v_paiement.notes::jsonb;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées comme JSONB';
      
      -- ✅ NOUVEAU : Extraire entreprise_id depuis les notes si NULL dans le paiement
      IF v_paiement.entreprise_id IS NULL AND v_notes_json ? 'entreprise_id' THEN
        v_entreprise_id_from_notes := (v_notes_json->>'entreprise_id')::uuid;
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise ID trouvé dans notes: %', v_entreprise_id_from_notes;
        
        -- Mettre à jour le paiement avec l'entreprise_id
        UPDATE paiements
        SET entreprise_id = v_entreprise_id_from_notes,
            updated_at = now()
        WHERE id = p_paiement_id;
        
        -- Récupérer le paiement mis à jour
        SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement mis à jour avec entreprise_id';
      END IF;
      
      -- ✅ NOUVEAU : Extraire client_id depuis les notes
      IF v_notes_json ? 'client_id' THEN
        v_client_id_from_notes := (v_notes_json->>'client_id')::uuid;
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client ID trouvé dans notes: %', v_client_id_from_notes;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %. Notes: %', SQLERRM, LEFT(v_paiement.notes, 100);
        v_notes_json := NULL;
    END;
  END IF;
  
  -- 3. Récupérer entreprise_id (depuis paiement ou notes)
  v_entreprise_id := v_paiement.entreprise_id;
  
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Entreprise ID non trouvé dans le paiement ni dans les notes';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise ID manquant. Impossible de continuer.',
      'details', jsonb_build_object(
        'paiement_id', p_paiement_id,
        'entreprise_id_dans_paiement', v_paiement.entreprise_id,
        'entreprise_id_dans_notes', v_entreprise_id_from_notes
      )
    );
  END IF;
  
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise ID: %, Montant: %', 
    v_entreprise_id, v_montant_ttc;
  
  -- 4. Extraire plan_id depuis les notes parsées
  IF v_notes_json IS NOT NULL AND jsonb_typeof(v_notes_json) = 'object' THEN
    IF v_notes_json ? 'plan_id' THEN
      v_plan_id := (v_notes_json->>'plan_id')::uuid;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes: %', v_plan_id;
    END IF;
  END IF;
  
  -- 5. ✅ FALLBACK : Si plan_id pas dans notes, chercher dans les abonnements existants de l'entreprise
  IF v_plan_id IS NULL THEN
    RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé dans notes, recherche dans abonnements existants...';
    
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
      AND plan_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans abonnement existant: %', v_plan_id;
    END IF;
  END IF;
  
  -- 6. ✅ FALLBACK 2 : Si toujours pas trouvé, chercher via get_paiement_info_for_stripe
  IF v_plan_id IS NULL THEN
    RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Plan ID toujours non trouvé, tentative via get_paiement_info_for_stripe...';
    
    BEGIN
      SELECT (result->>'plan_id')::uuid INTO v_plan_id
      FROM (
        SELECT get_paiement_info_for_stripe(p_paiement_id) as result
      ) sub
      WHERE (result->>'plan_id')::uuid IS NOT NULL;
      
      IF v_plan_id IS NOT NULL THEN
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé via get_paiement_info_for_stripe: %', v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur get_paiement_info_for_stripe: %', SQLERRM;
    END;
  END IF;
  
  -- 7. Si plan_id toujours NULL, erreur
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID final: %', v_plan_id;
  
  -- 8. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan d''abonnement non trouvé');
  END IF;
  
  -- 9. ✅ Récupérer le client : d'abord depuis les notes (client_id), puis depuis l'entreprise
  v_client_id := NULL;
  
  -- Essayer avec le client_id des notes
  IF v_client_id_from_notes IS NOT NULL THEN
    SELECT * INTO v_client
    FROM clients
    WHERE id = v_client_id_from_notes;
    
    IF FOUND THEN
      v_client_id := v_client.id;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé via notes - ID: %', v_client_id;
    END IF;
  END IF;
  
  -- Sinon, chercher dans les clients de l'entreprise
  IF v_client_id IS NULL THEN
    SELECT * INTO v_client
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    LIMIT 1;
    
    IF FOUND THEN
      v_client_id := v_client.id;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé via entreprise - ID: %', v_client_id;
    END IF;
  END IF;
  
  -- Si toujours pas trouvé, erreur
  IF v_client_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Client non trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise. Le client doit être créé lors de la création de l''entreprise.',
      'details', jsonb_build_object(
        'entreprise_id', v_entreprise_id,
        'client_id_dans_notes', v_client_id_from_notes
      )
    );
  END IF;
  
  -- 10. Générer numéro facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Création facture - Numéro: %', v_numero_facture;
  
  -- 11. ✅ CORRECTION : Créer la facture SANS statut_paiement (cette colonne n'existe pas)
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
  
  -- 12. Créer l'abonnement
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
  
  -- 13. Créer/Mettre à jour l'espace membre client
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
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre créé - ID: %', v_espace_membre_id;
  ELSE
    UPDATE espaces_membres_clients
    SET role = 'client_super_admin', actif = true,
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour - ID: %', v_espace_membre_id;
  END IF;
  
  -- 14. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ Erreur synchronisation modules (non bloquant): %', SQLERRM;
  END;
  
  -- 15. Activer entreprise
  UPDATE entreprises
  SET statut = 'active', statut_paiement = 'paye'
  WHERE id = v_entreprise_id AND (statut != 'active' OR statut_paiement != 'paye');
  
  -- 16. Activer client
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

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Version corrigée qui récupère entreprise_id et client_id depuis les notes si nécessaire.';

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement mise à jour - Récupération entreprise_id depuis notes';
  END IF;
END $$;

