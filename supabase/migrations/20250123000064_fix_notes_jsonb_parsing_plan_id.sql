/*
  # CORRECTION : Parsing JSONB des notes pour récupérer plan_id
  
  PROBLÈME:
  - La colonne notes dans paiements est de type TEXT
  - create_complete_entreprise_automated stocke les notes comme TEXT (JSON converti en text)
  - creer_facture_et_abonnement_apres_paiement essaie de lire comme JSONB directement
  - Le plan_id n'est pas récupéré correctement
  
  SOLUTION:
  - Modifier creer_facture_et_abonnement_apres_paiement pour parser le TEXT en JSONB
  - Ajouter des fallbacks pour récupérer plan_id depuis différentes sources
  - Améliorer la gestion d'erreurs
*/

-- ============================================================================
-- ÉTAPE 1 : Modifier creer_facture_et_abonnement_apres_paiement pour parser notes comme JSONB
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Montant: %', 
    v_entreprise_id, v_montant_ttc;
  
  -- 2. ✅ CORRECTION : Parser les notes (TEXT) en JSONB
  v_notes_json := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      -- Essayer de parser comme JSONB
      v_notes_json := v_paiement.notes::jsonb;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées comme JSONB';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %. Notes: %', SQLERRM, LEFT(v_paiement.notes, 100);
        v_notes_json := NULL;
    END;
  END IF;
  
  -- 3. Extraire plan_id depuis les notes parsées
  IF v_notes_json IS NOT NULL AND jsonb_typeof(v_notes_json) = 'object' THEN
    IF v_notes_json ? 'plan_id' THEN
      v_plan_id := (v_notes_json->>'plan_id')::uuid;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes: %', v_plan_id;
    END IF;
  END IF;
  
  -- 4. ✅ FALLBACK : Si plan_id pas dans notes, chercher dans les abonnements existants de l'entreprise
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
  
  -- 5. ✅ FALLBACK 2 : Si toujours pas trouvé, chercher via get_paiement_info_for_stripe
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
  
  -- 6. Si plan_id toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé - Notes: %', LEFT(COALESCE(v_paiement.notes, ''), 200);
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
  
  -- 7. Récupérer le plan
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
  
  -- 8. Récupérer le client associé à l'entreprise
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
  
  -- 9. Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Création facture - Numéro: %', v_numero_facture;
  
  -- 10. Créer la facture
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
  
  -- 11. Créer l'abonnement
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
  
  -- 12. Créer/Mettre à jour l'espace membre client avec droits admin
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
  
  -- 13. Synchroniser les modules depuis le plan
  RAISE NOTICE '🔄 [creer_facture_et_abonnement_apres_paiement] Synchronisation modules depuis plan...';
  
  -- Appeler la fonction de synchronisation si elle existe
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules (non bloquant): %', SQLERRM;
  END;
  
  -- 14. Activer l'entreprise si elle n'est pas déjà active
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye'
  WHERE id = v_entreprise_id
    AND (statut != 'active' OR statut_paiement != 'paye');
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise activée';
  
  -- 15. Activer le client
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
      'client_activé', true,
      'plan_id', v_plan_id::text
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
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Version corrigée avec parsing JSONB des notes et fallbacks pour plan_id.';

-- ============================================================================
-- ÉTAPE 2 : Créer une fonction helper pour récupérer plan_id depuis paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION get_plan_id_from_paiement(
  p_paiement_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_plan_id uuid;
  v_notes_json jsonb;
BEGIN
  -- Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Parser les notes en JSONB
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      v_notes_json := v_paiement.notes::jsonb;
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
        RETURN v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  -- Fallback : chercher dans abonnements existants
  SELECT plan_id INTO v_plan_id
  FROM abonnements
  WHERE entreprise_id = v_paiement.entreprise_id
    AND plan_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_plan_id;
END;
$$;

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement mise à jour avec parsing JSONB';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_plan_id_from_paiement') THEN
    RAISE NOTICE '✅ Fonction get_plan_id_from_paiement créée';
  END IF;
END $$;

