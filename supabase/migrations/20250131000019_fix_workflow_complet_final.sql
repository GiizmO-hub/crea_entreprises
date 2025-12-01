/*
  # FIX WORKFLOW COMPLET - Création entreprise -> workflow_data -> paiement -> validation -> suite
  
  PROBLÈMES IDENTIFIÉS:
  1. La fonction creer_facture_et_abonnement_apres_paiement ne lit PAS depuis workflow_data
  2. Le statut du client reste 'en_attente' au lieu de passer à 'actif' après paiement
  3. L'abonnement ne se met pas à jour directement après le paiement
  4. Le workflow_data n'est pas marqué comme traité
  
  SOLUTION:
  1. Modifier creer_facture_et_abonnement_apres_paiement pour lire depuis workflow_data (PRIORITÉ)
  2. Mettre à jour le statut du client à 'actif' après paiement
  3. Créer/mettre à jour l'abonnement immédiatement après le paiement
  4. Marquer workflow_data comme traité
  5. Synchroniser les modules depuis le plan
*/

-- ============================================================================
-- PARTIE 1 : Recréer complètement creer_facture_et_abonnement_apres_paiement
-- ============================================================================

DROP FUNCTION IF EXISTS creer_facture_et_abonnement_apres_paiement(uuid);

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
  v_workflow_data RECORD;
  v_client RECORD;
  v_plan RECORD;
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_numero_facture text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_id uuid;
  v_client_id uuid;
  v_entreprise_id uuid;
  v_auth_user_id uuid;
  v_plan_info jsonb;
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
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Paiement trouvé - Entreprise: %, Montant: %', 
    v_entreprise_id, v_montant_ttc;
  
  -- 2. ✅ PRIORITÉ : Récupérer les données depuis workflow_data
  SELECT * INTO v_workflow_data
  FROM workflow_data
  WHERE paiement_id = p_paiement_id
    AND traite = false
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE '⚠️ [creer_facture_et_abonnement_apres_paiement] workflow_data non trouvé - Tentative depuis les notes...';
    
    -- ✅ FALLBACK : Essayer de récupérer depuis les notes du paiement
    BEGIN
      IF v_paiement.notes IS NOT NULL THEN
        DECLARE
          v_notes_json jsonb;
        BEGIN
          -- Parser les notes
          IF pg_typeof(v_paiement.notes) = 'jsonb'::regtype THEN
            v_notes_json := v_paiement.notes::jsonb;
          ELSE
            v_notes_json := v_paiement.notes::text::jsonb;
          END IF;
          
          -- Extraire les données depuis les notes
          IF v_notes_json ? 'plan_id' THEN
            v_plan_id := (v_notes_json->>'plan_id')::uuid;
          END IF;
          
          IF v_notes_json ? 'client_id' THEN
            v_client_id := (v_notes_json->>'client_id')::uuid;
          END IF;
          
          IF v_notes_json ? 'auth_user_id' THEN
            v_auth_user_id := (v_notes_json->>'auth_user_id')::uuid;
          END IF;
          
          IF v_notes_json ? 'entreprise_id' THEN
            v_entreprise_id := COALESCE((v_notes_json->>'entreprise_id')::uuid, v_entreprise_id);
          END IF;
          
          IF v_notes_json ? 'plan_info' THEN
            v_plan_info := v_notes_json->'plan_info';
          END IF;
          
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Données extraites depuis les notes - Plan: %, Client: %, User: %', 
            v_plan_id, v_client_id, v_auth_user_id;
          
          -- ✅ CRÉER workflow_data depuis les notes pour référence future
          IF v_plan_id IS NOT NULL AND v_client_id IS NOT NULL THEN
            BEGIN
              INSERT INTO workflow_data (
                paiement_id,
                entreprise_id,
                client_id,
                auth_user_id,
                plan_id,
                plan_info,
                traite
              )
              VALUES (
                p_paiement_id,
                v_entreprise_id,
                v_client_id,
                v_auth_user_id,
                v_plan_id,
                v_plan_info,
                false
              )
              ON CONFLICT (paiement_id) DO UPDATE
              SET entreprise_id = EXCLUDED.entreprise_id,
                  client_id = EXCLUDED.client_id,
                  auth_user_id = EXCLUDED.auth_user_id,
                  plan_id = EXCLUDED.plan_id,
                  plan_info = EXCLUDED.plan_info,
                  traite = false,
                  updated_at = now();
              
              RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] workflow_data créé depuis les notes';
            EXCEPTION
              WHEN OTHERS THEN
                RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur création workflow_data: %', SQLERRM;
            END;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %', SQLERRM;
        END;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur traitement notes: %', SQLERRM;
    END;
    
    -- Vérifier que les données essentielles sont présentes
    IF v_plan_id IS NULL OR v_client_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Données du workflow non trouvées',
        'message', 'Les données nécessaires au workflow ne sont pas disponibles dans workflow_data ni dans les notes du paiement',
        'details', jsonb_build_object(
          'paiement_id', p_paiement_id,
          'plan_id_trouve', v_plan_id IS NOT NULL,
          'client_id_trouve', v_client_id IS NOT NULL,
          'notes_presentes', v_paiement.notes IS NOT NULL
        )
      );
    END IF;
  ELSE
    -- ✅ Utiliser les données de workflow_data
    v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_entreprise_id);
    v_client_id := v_workflow_data.client_id;
    v_auth_user_id := v_workflow_data.auth_user_id;
    v_plan_id := v_workflow_data.plan_id;
    v_plan_info := COALESCE(v_workflow_data.plan_info, '{}'::jsonb);
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] workflow_data trouvé - Entreprise: %, Client: %, Plan: %', 
      v_entreprise_id, v_client_id, v_plan_id;
  END IF;
  
  -- 3. Vérifier que les IDs essentiels sont présents
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ID d''entreprise manquant'
    );
  END IF;
  
  IF v_client_id IS NULL THEN
    -- Essayer de trouver le client depuis l'entreprise
    SELECT id INTO v_client_id
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_client_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Aucun client trouvé pour cette entreprise'
      );
    END IF;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant. Impossible de créer l''abonnement.'
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan trouvé: % (Prix: %€)', v_plan.nom, v_plan.prix_mensuel;
  
  -- 5. Récupérer le client
  SELECT * INTO v_client
  FROM clients
  WHERE id = v_client_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Client non trouvé: %s', v_client_id)
    );
  END IF;
  
  -- 6. Récupérer l'auth.user_id si manquant
  IF v_auth_user_id IS NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
      AND entreprise_id = v_entreprise_id
    LIMIT 1;
    
    IF v_auth_user_id IS NULL THEN
      v_auth_user_id := v_paiement.user_id;
    END IF;
  END IF;
  
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun auth.user_id trouvé pour ce client'
    );
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé: % (Email: %)', v_client.nom, v_client.email;
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Auth User ID: %', v_auth_user_id;
  
  -- 7. Vérifier si une facture existe déjà
  SELECT id INTO v_facture_id
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_id IS NULL THEN
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
      source,
      paiement_id
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
      'plateforme',
      p_paiement_id
    )
    RETURNING id INTO v_facture_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée: % (%)', v_facture_id, v_numero_facture;
  ELSE
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture existante: % (%)', v_facture_id, v_numero_facture;
  END IF;
  
  -- 8. ✅ CRÉER/METTRE À JOUR L'ABONNEMENT immédiatement
  SELECT id INTO v_abonnement_id
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id
    AND plan_id = v_plan_id
  LIMIT 1;
  
  IF v_abonnement_id IS NULL THEN
    -- Créer un nouvel abonnement
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
      v_auth_user_id,
      v_plan_id,
      v_facture_id,
      'actif',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month',
      COALESCE(v_plan.prix_mensuel, v_montant_ht),
      'mensuel'
    )
    RETURNING id INTO v_abonnement_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé: %', v_abonnement_id;
  ELSE
    -- Mettre à jour l'abonnement existant
    UPDATE abonnements
    SET 
      client_id = v_auth_user_id,
      facture_id = v_facture_id,
      statut = 'actif',
      date_debut = CURRENT_DATE,
      date_prochain_paiement = CURRENT_DATE + INTERVAL '1 month',
      montant_mensuel = COALESCE(v_plan.prix_mensuel, v_montant_ht),
      updated_at = now()
    WHERE id = v_abonnement_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement mis à jour: %', v_abonnement_id;
  END IF;
  
  -- 9. ✅ CRÉER/METTRE À JOUR L'ESPACE MEMBRE
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
      v_auth_user_id,
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
        user_id = COALESCE(v_auth_user_id, user_id),
        actif = true,
        statut_compte = 'actif',
        updated_at = now()
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 10. ✅ SYNCHRONISER LES MODULES depuis le plan
  BEGIN
    PERFORM sync_client_modules_from_plan(v_espace_membre_id);
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés depuis le plan';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules: %', SQLERRM;
  END;
  
  -- 11. ✅ CORRECTION CRITIQUE : METTRE À JOUR LE STATUT DU CLIENT À 'actif'
  UPDATE clients
  SET statut = 'actif',
      updated_at = now()
  WHERE id = v_client_id
    AND statut != 'actif';
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Statut client mis à jour à "actif"';
  
  -- 12. Mettre à jour l'entreprise
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye',
      updated_at = now()
  WHERE id = v_entreprise_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise mise à jour';
  
  -- 13. ✅ MARQUER workflow_data COMME TRAITÉ
  -- Marquer tous les workflow_data pour ce paiement comme traité
  UPDATE workflow_data
  SET traite = true,
      updated_at = now()
  WHERE paiement_id = p_paiement_id
    AND traite = false;
  
  IF FOUND THEN
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] workflow_data marqué comme traité';
  END IF;
  
  RAISE NOTICE '🎉 [creer_facture_et_abonnement_apres_paiement] TERMINÉ AVEC SUCCÈS !';
  
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
    'client_statut', 'actif'
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
'Crée automatiquement facture, abonnement, espace client après validation d''un paiement. Lit depuis workflow_data en priorité. Met à jour le statut client à "actif".';

-- ============================================================================
-- PARTIE 2 : Vérifier et recréer le trigger si nécessaire
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;

CREATE OR REPLACE FUNCTION trigger_creer_facture_abonnement_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Si le paiement passe à "paye" (et n'était pas déjà payé)
  IF NEW.statut = 'paye' 
     AND (OLD.statut IS NULL OR OLD.statut != 'paye')
     AND NEW.entreprise_id IS NOT NULL THEN
    
    RAISE NOTICE '[trigger_creer_facture_abonnement_apres_paiement] 🚀 Paiement validé - ID: %, Entreprise: %', 
      NEW.id, NEW.entreprise_id;
    
    -- Appeler la fonction de création
    BEGIN
      v_result := creer_facture_et_abonnement_apres_paiement(NEW.id);
      
      IF v_result->>'success' = 'true' THEN
        RAISE NOTICE '[trigger_creer_facture_abonnement_apres_paiement] ✅ Workflow terminé avec succès';
      ELSE
        RAISE WARNING '[trigger_creer_facture_abonnement_apres_paiement] ❌ Erreur workflow: %', v_result->>'error';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[trigger_creer_facture_abonnement_apres_paiement] ❌ Exception: % - %', SQLERRM, SQLSTATE;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_paiement_creer_facture_abonnement
  AFTER UPDATE OF statut ON paiements
  FOR EACH ROW
  WHEN (
    NEW.statut = 'paye' 
    AND (OLD.statut IS NULL OR OLD.statut != 'paye') 
    AND NEW.entreprise_id IS NOT NULL
  )
  EXECUTE FUNCTION trigger_creer_facture_abonnement_apres_paiement();

COMMENT ON TRIGGER trigger_paiement_creer_facture_abonnement ON paiements IS 
'Trigger automatique qui crée facture et abonnement quand un paiement est validé.';

-- ============================================================================
-- PARTIE 3 : Corriger les clients existants avec statut 'en_attente' qui ont un abonnement actif
-- ============================================================================

DO $$
DECLARE
  v_client RECORD;
  v_count_fixed INTEGER := 0;
BEGIN
  FOR v_client IN
    SELECT DISTINCT c.id
    FROM clients c
    JOIN abonnements a ON a.entreprise_id = c.entreprise_id
    WHERE c.statut = 'en_attente'
      AND a.statut = 'actif'
      AND EXISTS (
        SELECT 1 FROM paiements p
        WHERE p.entreprise_id = c.entreprise_id
        AND p.statut = 'paye'
      )
  LOOP
    UPDATE clients
    SET statut = 'actif',
        updated_at = now()
    WHERE id = v_client.id;
    
    v_count_fixed := v_count_fixed + 1;
    RAISE NOTICE '✅ Client % mis à jour à "actif"', v_client.id;
  END LOOP;
  
  IF v_count_fixed > 0 THEN
    RAISE NOTICE '✅ % client(s) corrigé(s) (statut mis à "actif")', v_count_fixed;
  ELSE
    RAISE NOTICE 'ℹ️ Aucun client à corriger';
  END IF;
END $$;

SELECT '✅ Migration de correction du workflow complet appliquée avec succès !' as resultat;

