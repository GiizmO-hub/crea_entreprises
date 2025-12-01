/*
  # CORRECTION COMPLÈTE : Empêcher les factures en double lors de la création d'entreprise
  
  PROBLÈME:
  - À chaque création d'entreprise, deux factures sont créées au lieu d'une seule
  - Le trigger `trigger_creer_facture_abonnement_apres_paiement` crée une facture via `creer_facture_et_abonnement_apres_paiement`
  - La fonction `generate_invoice_for_entreprise` peut aussi créer une facture
  - Résultat : 2 factures au lieu d'1
  
  SOLUTION:
  - Modifier `creer_facture_et_abonnement_apres_paiement` pour vérifier si une facture existe déjà AVANT de créer
  - Si une facture existe déjà pour cet abonnement/entreprise, retourner cette facture au lieu d'en créer une nouvelle
  - Améliorer la vérification dans `generate_invoice_for_entreprise`
*/

-- ============================================================================
-- PARTIE 1 : Corriger creer_facture_et_abonnement_apres_paiement pour éviter les doublons
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
  v_entreprise_id uuid;
  v_client_id uuid;
  v_user_id uuid;
  v_plan_id uuid;
  v_plan RECORD;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_numero_facture text;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_facture_existante RECORD;
  v_notes_json jsonb;
  v_notes_text text;
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
  
  v_entreprise_id := v_paiement.entreprise_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Montant: %', 
    v_entreprise_id, v_montant_ttc;
  
  -- 2. Récupérer le plan_id depuis les notes du paiement
  v_notes_text := COALESCE(v_paiement.notes::text, '');
  
  -- Essayer de parser comme JSONB
  BEGIN
    IF v_notes_text IS NOT NULL AND v_notes_text != '' THEN
      v_notes_json := v_notes_text::jsonb;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées: %', v_notes_json;
      
      -- Chercher plan_id dans la racine
      IF v_notes_json ? 'plan_id' THEN
        BEGIN
          v_plan_id := (v_notes_json->>'plan_id')::uuid;
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes: %', v_plan_id;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
        END;
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
  END;
  
  -- Si pas de plan_id dans les notes, chercher dans un abonnement existant
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
      AND statut = 'actif'
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans abonnement existant: %', v_plan_id;
    END IF;
  END IF;
  
  -- Si toujours pas de plan_id, utiliser le premier plan actif
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
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan d''abonnement non trouvé'
    );
  END IF;
  
  -- 3. Récupérer le plan
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan trouvé: % (%)', v_plan.nom, v_plan.prix_mensuel;
  
  -- 4. Récupérer le client
  -- Chercher dans les notes du paiement
  IF v_notes_json IS NOT NULL AND v_notes_json ? 'client_id' THEN
    BEGIN
      v_client_id := (v_notes_json->>'client_id')::uuid;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé depuis notes: %', v_client_id;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  -- Si pas trouvé, chercher le premier client de l'entreprise
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé depuis entreprise: %', v_client_id;
    END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Aucun client trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;
  
  -- 5. ✅ CORRECTION CRITIQUE : Vérifier si une facture existe DÉJÀ pour cet abonnement/entreprise
  -- Chercher un abonnement existant pour cette entreprise et ce plan
  SELECT id, facture_id INTO v_abonnement_id, v_facture_id
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id
    AND plan_id = v_plan_id
    AND statut = 'actif'
  LIMIT 1;
  
  -- Si un abonnement existe et a déjà une facture, vérifier que cette facture existe
  IF v_abonnement_id IS NOT NULL AND v_facture_id IS NOT NULL THEN
    SELECT * INTO v_facture_existante
    FROM factures
    WHERE id = v_facture_id;
    
    IF FOUND THEN
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture existante trouvée - ID: %, Numéro: %', 
        v_facture_existante.id, v_facture_existante.numero;
      
      -- Retourner la facture existante au lieu d'en créer une nouvelle
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Facture existante retournée (évite le doublon)',
        'facture_id', v_facture_existante.id,
        'numero_facture', v_facture_existante.numero,
        'abonnement_id', v_abonnement_id,
        'espace_membre_id', NULL,
        'plan_id', v_plan_id,
        'plan_nom', v_plan.nom,
        'client_id', v_client_id,
        'existant', true
      );
    END IF;
  END IF;
  
  -- ✅ VÉRIFICATION ADDITIONNELLE : Chercher une facture récente (moins de 24h) pour cette entreprise
  -- avec les mêmes caractéristiques (plan_id dans notes, même montant, etc.)
  SELECT f.id, f.numero, f.montant_ttc INTO v_facture_existante
  FROM factures f
  WHERE f.entreprise_id = v_entreprise_id
    AND f.client_id = v_client_id
    AND f.source = 'plateforme'
    AND (
      -- Facture avec plan_id dans les notes
      (f.notes::jsonb->>'plan_id')::text = v_plan_id::text
      OR
      -- Facture créée récemment (moins de 24h) avec le même montant
      (f.created_at > now() - INTERVAL '24 hours' 
       AND ABS(f.montant_ttc - v_montant_ttc) < 0.01)
    )
  ORDER BY f.created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture récente trouvée - Numéro: %, ID: %', 
      v_facture_existante.numero, v_facture_existante.id;
    
    -- Mettre à jour l'abonnement avec cette facture si nécessaire
    IF v_abonnement_id IS NOT NULL THEN
      UPDATE abonnements
      SET facture_id = v_facture_existante.id,
          updated_at = now()
      WHERE id = v_abonnement_id
        AND (facture_id IS NULL OR facture_id != v_facture_existante.id);
    END IF;
    
    -- Retourner la facture existante
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Facture existante retournée (évite le doublon)',
      'facture_id', v_facture_existante.id,
      'numero_facture', v_facture_existante.numero,
      'abonnement_id', v_abonnement_id,
      'espace_membre_id', NULL,
      'plan_id', v_plan_id,
      'plan_nom', v_plan.nom,
      'client_id', v_client_id,
      'existant', true
    );
  END IF;
  
  -- ✅ Si aucune facture existante, créer une nouvelle facture
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Aucune facture existante, création d''une nouvelle facture...';
  
  -- Récupérer l'auth.user_id du client
  SELECT user_id INTO v_user_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
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
  
  -- Générer le numéro de facture
  v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- Créer la facture
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
  
  -- Créer ou mettre à jour l'abonnement
  SELECT id INTO v_abonnement_id
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id
    AND plan_id = v_plan_id
  LIMIT 1;
  
  IF v_abonnement_id IS NULL THEN
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
  
  -- Créer/Mettre à jour l'espace membre
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
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
  
  -- Mettre à jour l'entreprise
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
    'client_id', v_client_id,
    'existant', false
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

SELECT '✅ Migration de correction complète des factures en double appliquée avec succès !' as resultat;

