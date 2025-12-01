/*
  # CORRECTION COMPLÈTE : Création d'abonnement après paiement
  
  PROBLÈMES IDENTIFIÉS:
  1. La fonction creer_facture_et_abonnement_apres_paiement ne met pas le client_id dans l'abonnement
  2. Les paiements sans plan_id dans les notes ne peuvent pas créer d'abonnement
  3. Le plan_id n'est pas toujours stocké correctement lors de la création du paiement
  
  SOLUTION:
  1. Corriger la fonction pour inclure client_id dans l'abonnement
  2. Améliorer la récupération du plan_id avec plus de fallbacks
  3. Corriger les paiements existants sans plan_id
*/

-- ============================================================================
-- PARTIE 1 : Corriger creer_facture_et_abonnement_apres_paiement pour inclure client_id
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
  v_notes_text text;
  v_plan_id_from_notes text;
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
  
  -- Marquer le paiement comme payé si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements
    SET statut = 'paye',
        date_paiement = COALESCE(date_paiement, CURRENT_DATE),
        updated_at = now()
    WHERE id = p_paiement_id;
    SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  END IF;
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Montant: %', 
    v_entreprise_id, v_montant_ttc;
  
  -- 2. Parser les notes
  v_notes_json := NULL;
  v_notes_text := v_paiement.notes;
  
  IF v_notes_text IS NOT NULL AND v_notes_text != '' THEN
    BEGIN
      IF pg_typeof(v_notes_text) = 'jsonb'::regtype THEN
        v_notes_json := v_notes_text::jsonb;
      ELSE
        v_notes_json := v_notes_text::jsonb;
      END IF;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées: %', v_notes_json;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
        v_notes_json := NULL;
    END;
  END IF;
  
  -- 3. Extraire plan_id depuis les notes
  v_plan_id := NULL;
  
  IF v_notes_json IS NOT NULL AND jsonb_typeof(v_notes_json) = 'object' THEN
    IF v_notes_json ? 'plan_id' THEN
      v_plan_id_from_notes := v_notes_json->>'plan_id';
      IF v_plan_id_from_notes IS NOT NULL AND v_plan_id_from_notes != '' THEN
        BEGIN
          v_plan_id := v_plan_id_from_notes::uuid;
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes: %', v_plan_id;
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END;
      END IF;
    END IF;
  END IF;
  
  -- Fallback : chercher dans les abonnements existants
  IF v_plan_id IS NULL THEN
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
  
  -- Fallback 2 : utiliser le premier plan actif si toujours NULL
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM plans_abonnement
    WHERE actif = true
    ORDER BY ordre ASC
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID par défaut (premier plan actif): %', v_plan_id;
    END IF;
  END IF;
  
  -- Si toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant. Impossible de créer l''abonnement.',
      'details', jsonb_build_object(
        'paiement_id', p_paiement_id,
        'entreprise_id', v_entreprise_id,
        'notes_preview', LEFT(COALESCE(v_notes_text, ''), 200)
      )
    );
  END IF;
  
  -- 4. Récupérer le plan
  SELECT * INTO v_plan
  FROM plans_abonnement
  WHERE id = v_plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Plan non trouvé: %s', v_plan_id)
    );
  END IF;
  
  -- 5. Récupérer le client et son auth.user_id
  IF v_notes_json IS NOT NULL AND v_notes_json ? 'client_id' THEN
    BEGIN
      v_client_id := (v_notes_json->>'client_id')::uuid;
      SELECT * INTO v_client FROM clients WHERE id = v_client_id;
      IF NOT FOUND THEN
        v_client_id := NULL;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_client_id := NULL;
    END;
  END IF;
  
  IF v_client_id IS NULL THEN
    SELECT * INTO v_client
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      v_client_id := v_client.id;
    END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise.'
    );
  END IF;
  
  -- ✅ CORRECTION : Récupérer l'auth.user_id du client (abonnements.client_id référence auth.users.id)
  -- Chercher dans espaces_membres_clients (qui a user_id)
  SELECT user_id INTO v_user_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  -- Si pas trouvé, utiliser le user_id du paiement (qui est l'auth.user_id du créateur)
  IF v_user_id IS NULL THEN
    v_user_id := v_paiement.user_id;
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Utilisation user_id du paiement: %', v_user_id;
  ELSE
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] User_id trouvé dans espace membre: %', v_user_id;
  END IF;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun auth.user_id trouvé pour ce client.'
    );
  END IF;
  
  -- 6. Générer le numéro de facture
  v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- 7. Créer la facture
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
    notes,
    source
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
      'origine', 'paiement_workflow'
    ),
    'plateforme'
  )
  RETURNING id INTO v_facture_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée: %', v_facture_id;
  
  -- 8. ✅ CORRECTION CRITIQUE : Créer l'abonnement AVEC client_id (auth.user_id)
  -- Vérifier si un abonnement existe déjà pour cette entreprise et ce plan
  SELECT id INTO v_abonnement_id
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id
    AND plan_id = v_plan_id
  LIMIT 1;
  
  IF v_abonnement_id IS NULL THEN
    -- Créer un nouvel abonnement (client_id = auth.user_id)
    INSERT INTO abonnements (
      entreprise_id,
      client_id,
      plan_id,
      facture_id,
      statut,
      date_debut,
      date_prochain_paiement,
      montant_mensuel,
      mode_paiement
    )
    VALUES (
      v_entreprise_id,
      v_user_id,
      v_plan_id,
      v_facture_id,
      'actif',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month',
      COALESCE(v_plan.prix_mensuel, v_montant_ht),
      'mensuel'
    )
    RETURNING id INTO v_abonnement_id;
  ELSE
    -- Mettre à jour l'abonnement existant
    UPDATE abonnements
    SET 
      client_id = v_user_id,
      facture_id = v_facture_id,
      statut = 'actif',
      date_debut = CURRENT_DATE,
      date_prochain_paiement = CURRENT_DATE + INTERVAL '1 month',
      montant_mensuel = COALESCE(v_plan.prix_mensuel, v_montant_ht),
      updated_at = now()
    WHERE id = v_abonnement_id;
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé/mis à jour: % (client_id: %)', v_abonnement_id, v_client_id;
  
  -- 9. ✅ CORRECTION CRITIQUE : Créer/Mettre à jour l'espace membre
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    -- ✅ CRÉER l'espace membre si il n'existe pas
    RAISE NOTICE '👤 [creer_facture_et_abonnement_apres_paiement] Création espace membre client...';
    
    INSERT INTO espaces_membres_clients (
      client_id,
      entreprise_id,
      user_id,
      abonnement_id,
      actif,
      statut_compte,
      modules_actifs
    )
    VALUES (
      v_client_id,
      v_entreprise_id,
      v_user_id,
      v_abonnement_id,
      true,
      'actif',
      jsonb_build_object(
        'tableau_de_bord', true,
        'mon_entreprise', true,
        'factures', true,
        'documents', true,
        'abonnements', true
      )
    )
    RETURNING id INTO v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre créé: %', v_espace_membre_id;
  ELSE
    -- Mettre à jour l'espace membre existant
    UPDATE espaces_membres_clients
    SET abonnement_id = v_abonnement_id,
        user_id = COALESCE(v_user_id, user_id),
        actif = true,
        statut_compte = 'actif',
        updated_at = now()
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour avec abonnement';
  END IF;
  
  -- Synchroniser les modules depuis le plan
  BEGIN
    PERFORM sync_client_modules_from_plan(v_espace_membre_id);
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés depuis le plan';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules: %', SQLERRM;
  END;
  
  -- 10. Mettre à jour l'entreprise
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye',
      updated_at = now()
  WHERE id = v_entreprise_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture, abonnement et espace membre créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'plan_id', v_plan_id,
    'plan_nom', v_plan.nom,
    'client_id', v_client_id
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
-- PARTIE 2 : Corriger les paiements existants sans plan_id
-- ============================================================================

DO $$
DECLARE
  v_paiement RECORD;
  v_plan_id uuid;
  v_count_fixed INTEGER := 0;
BEGIN
  FOR v_paiement IN
    SELECT 
      p.id,
      p.entreprise_id,
      p.notes
    FROM paiements p
    WHERE p.statut = 'paye'
      AND p.entreprise_id IS NOT NULL
      AND (
        p.notes IS NULL 
        OR p.notes = ''
        OR (p.notes::text NOT LIKE '%plan_id%')
      )
      AND NOT EXISTS (
        SELECT 1 FROM abonnements a
        WHERE a.entreprise_id = p.entreprise_id
          AND a.statut = 'actif'
      )
  LOOP
    BEGIN
      -- Chercher un plan actif par défaut
      SELECT id INTO v_plan_id
      FROM plans_abonnement
      WHERE actif = true
      ORDER BY ordre ASC
      LIMIT 1;
      
      IF v_plan_id IS NOT NULL THEN
        -- Mettre à jour les notes avec le plan_id
        UPDATE paiements
        SET notes = COALESCE(
          CASE 
            WHEN notes IS NULL OR notes = '' THEN '{}'::jsonb
            WHEN pg_typeof(notes) = 'jsonb'::regtype THEN notes::jsonb
            ELSE notes::jsonb
          END,
          '{}'::jsonb
        ) || jsonb_build_object('plan_id', v_plan_id::text),
        updated_at = now()
        WHERE id = v_paiement.id;
        
        -- Créer l'abonnement pour ce paiement
        PERFORM creer_facture_et_abonnement_apres_paiement(v_paiement.id);
        
        v_count_fixed := v_count_fixed + 1;
        RAISE NOTICE '✅ Paiement % corrigé avec plan_id: %', v_paiement.id, v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur correction paiement %: %', v_paiement.id, SQLERRM;
    END;
  END LOOP;
  
  IF v_count_fixed > 0 THEN
    RAISE NOTICE '✅ % paiement(s) corrigé(s) et abonnement(s) créé(s)', v_count_fixed;
  ELSE
    RAISE NOTICE 'ℹ️ Aucun paiement à corriger';
  END IF;
END $$;

SELECT '✅ Migration de correction de la création d''abonnement appliquée avec succès !' as resultat;

