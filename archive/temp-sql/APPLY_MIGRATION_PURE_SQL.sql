-- ============================================================================
-- APPLICATION COMPLÈTE DES CORRECTIONS - SQL PUR
-- ============================================================================
-- Ce fichier contient UNIQUEMENT du SQL PostgreSQL, aucun code JavaScript
-- ============================================================================

-- ============================================================================
-- CORRECTION : creer_facture_et_abonnement_apres_paiement
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
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] DEBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  v_statut_initial := v_paiement.statut;
  
  -- 2. Marquer le paiement comme "payé" si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements
    SET methode_paiement = COALESCE(NULLIF(methode_paiement, ''), 'stripe'),
        statut = 'paye',
        date_paiement = COALESCE(date_paiement, CURRENT_DATE),
        updated_at = now()
    WHERE id = p_paiement_id;
    SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  END IF;
  
  -- 3. Parser les notes et récupérer entreprise_id si NULL
  v_notes_json := NULL;
  v_entreprise_id_from_notes := NULL;
  v_client_id_from_notes := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      v_notes_json := v_paiement.notes::jsonb;
      
      -- Récupérer entreprise_id depuis notes si NULL
      IF v_paiement.entreprise_id IS NULL AND v_notes_json ? 'entreprise_id' THEN
        v_entreprise_id_from_notes := (v_notes_json->>'entreprise_id')::uuid;
        UPDATE paiements
        SET entreprise_id = v_entreprise_id_from_notes, updated_at = now()
        WHERE id = p_paiement_id;
        SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] Entreprise ID recupere depuis notes: %', v_entreprise_id_from_notes;
      END IF;
      
      -- Récupérer client_id et plan_id depuis notes
      IF v_notes_json ? 'client_id' THEN
        v_client_id_from_notes := (v_notes_json->>'client_id')::uuid;
      END IF;
      
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
    END;
  END IF;
  
  -- 4. Récupérer entreprise_id
  v_entreprise_id := v_paiement.entreprise_id;
  
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise ID manquant.');
  END IF;
  
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  -- 5. Fallback pour plan_id
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id AND plan_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  
  IF v_plan_id IS NULL THEN
    BEGIN
      SELECT (result->>'plan_id')::uuid INTO v_plan_id
      FROM (SELECT get_paiement_info_for_stripe(p_paiement_id) as result) sub
      WHERE (result->>'plan_id')::uuid IS NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID manquant.');
  END IF;
  
  -- 6. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan non trouvé');
  END IF;
  
  -- 7. Récupérer le client : depuis notes ou depuis entreprise
  v_client_id := NULL;
  
  IF v_client_id_from_notes IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_client_id_from_notes;
    IF FOUND THEN v_client_id := v_client.id; END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    SELECT * INTO v_client FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
    IF FOUND THEN v_client_id := v_client.id; END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client trouvé pour cette entreprise.');
  END IF;
  
  -- 8. Générer numéro facture
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- 9. CORRECTION : Créer facture SANS statut_paiement (cette colonne n'existe pas)
  INSERT INTO factures (
    entreprise_id, client_id, numero, type, date_emission, date_echeance,
    montant_ht, tva, montant_ttc, statut, notes
  )
  VALUES (
    v_entreprise_id, v_client_id, v_numero_facture, 'facture',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
    v_montant_ht, v_montant_tva, v_montant_ttc, 'payee',
    jsonb_build_object(
      'paiement_id', p_paiement_id::text,
      'plan_id', v_plan_id::text,
      'origine', 'paiement_stripe'
    )::text
  )
  RETURNING id INTO v_facture_id;
  
  -- 10. Créer abonnement
  INSERT INTO abonnements (
    client_id, entreprise_id, plan_id, statut, date_debut,
    date_prochain_paiement, montant_mensuel, mode_paiement, stripe_payment_id
  )
  VALUES (
    v_client_id, v_entreprise_id, v_plan_id, 'actif', CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month', v_montant_ht, 'mensuel',
    v_paiement.stripe_payment_id
  )
  RETURNING id INTO v_abonnement_id;
  
  -- 11. Créer/Mettre à jour espace membre
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
  
  -- 12. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
  
  -- 13. Activer entreprise et client
  UPDATE entreprises
  SET statut = 'active', statut_paiement = 'paye'
  WHERE id = v_entreprise_id AND (statut != 'active' OR statut_paiement != 'paye');
  
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND statut != 'actif';
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] TERMINE AVEC SUCCES !';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Version corrigée qui récupère entreprise_id et client_id depuis les notes si nécessaire.';

-- ============================================================================
-- TEST AUTOMATIQUE
-- ============================================================================

DO $$
DECLARE
  v_paiement_id uuid;
  v_result jsonb;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'TEST AUTOMATIQUE DU WORKFLOW';
  
  -- Trouver un paiement en attente
  SELECT id INTO v_paiement_id
  FROM paiements
  WHERE statut = 'en_attente'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_paiement_id IS NULL THEN
    SELECT id INTO v_paiement_id FROM paiements ORDER BY created_at DESC LIMIT 1;
  END IF;
  
  IF v_paiement_id IS NULL THEN
    RAISE NOTICE 'Aucun paiement trouvé pour tester';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Paiement ID: %', v_paiement_id;
  
  -- Tester valider_paiement_carte_immediat
  SELECT valider_paiement_carte_immediat(v_paiement_id, 'test_stripe_after_fix') INTO v_result;
  
  IF v_result->>'success' = 'true' THEN
    RAISE NOTICE '';
    RAISE NOTICE 'WORKFLOW REUSSI !';
    RAISE NOTICE 'Facture ID: %', v_result->>'facture_id';
    RAISE NOTICE 'Abonnement ID: %', v_result->>'abonnement_id';
    RAISE NOTICE 'Espace membre ID: %', v_result->>'espace_membre_id';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'ERREUR';
    RAISE WARNING 'Erreur: %', v_result->>'error';
  END IF;
  
END $$;

-- Vérification état final
SELECT 
  'ETAT FINAL' as info,
  p.id as paiement_id,
  p.statut as statut_paiement,
  p.entreprise_id,
  e.nom as entreprise_nom,
  e.statut as statut_entreprise,
  (SELECT COUNT(*) FROM factures WHERE notes->>'paiement_id' = p.id::text) as nb_factures,
  (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = p.entreprise_id) as nb_abonnements
FROM paiements p
LEFT JOIN entreprises e ON e.id = p.entreprise_id
ORDER BY p.created_at DESC
LIMIT 3;

SELECT 'Corrections appliquees et test termine !' as resultat;

