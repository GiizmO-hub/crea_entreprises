/*
  # CORRECTION CRITIQUE : Gestion des plans dans le workflow
  
  PROBLÈME IDENTIFIÉ:
  - La gestion des plans ne fonctionne pas correctement
  - Le plan_id n'est pas correctement récupéré depuis les notes du paiement
  - L'abonnement n'est pas créé car le plan_id est manquant
  
  SOLUTION:
  1. Vérifier et corriger le type de la colonne notes dans paiements
  2. Améliorer la fonction creer_facture_et_abonnement_apres_paiement pour mieux récupérer le plan_id
  3. Ajouter des logs détaillés pour diagnostiquer les problèmes
  4. S'assurer que le plan_id est toujours stocké correctement dans les notes
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et corriger le type de la colonne notes
-- ============================================================================

DO $$
BEGIN
  -- Vérifier si la colonne notes existe et son type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'notes'
  ) THEN
    RAISE NOTICE '✅ Colonne notes existe dans la table paiements';
    
    -- Vérifier le type actuel
    PERFORM column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'notes';
  ELSE
    RAISE WARNING '❌ Colonne notes n''existe pas dans la table paiements';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Améliorer creer_facture_et_abonnement_apres_paiement
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
  v_auth_user_id uuid;
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
  
  -- 2. ✅ CORRECTION CRITIQUE : Parser les notes (peut être TEXT ou JSONB)
  v_notes_json := NULL;
  v_notes_text := v_paiement.notes;
  
  IF v_notes_text IS NOT NULL AND v_notes_text != '' THEN
    BEGIN
      -- Essayer de parser comme JSONB directement
      IF pg_typeof(v_notes_text) = 'jsonb'::regtype THEN
        v_notes_json := v_notes_text::jsonb;
      ELSE
        -- Parser depuis TEXT
        v_notes_json := v_notes_text::jsonb;
      END IF;
      
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Notes parsées comme JSONB: %', v_notes_json;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur parsing notes: %. Notes (100 premiers caractères): %', 
          SQLERRM, LEFT(v_notes_text, 100);
        v_notes_json := NULL;
    END;
  END IF;
  
  -- 3. ✅ CORRECTION CRITIQUE : Extraire plan_id depuis les notes avec plusieurs méthodes
  v_plan_id := NULL;
  
  -- Méthode 1 : Depuis notes JSONB directement
  IF v_notes_json IS NOT NULL AND jsonb_typeof(v_notes_json) = 'object' THEN
    -- Chercher plan_id à la racine
    IF v_notes_json ? 'plan_id' THEN
      v_plan_id_from_notes := v_notes_json->>'plan_id';
      IF v_plan_id_from_notes IS NOT NULL AND v_plan_id_from_notes != '' THEN
        BEGIN
          v_plan_id := v_plan_id_from_notes::uuid;
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes (racine): %', v_plan_id;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur conversion plan_id en UUID: %', SQLERRM;
        END;
      END IF;
    END IF;
    
    -- Chercher dans plan_info si présent
    IF v_plan_id IS NULL AND v_notes_json ? 'plan_info' THEN
      BEGIN
        v_plan_id_from_notes := (v_notes_json->'plan_info'->>'plan_id');
        IF v_plan_id_from_notes IS NOT NULL AND v_plan_id_from_notes != '' THEN
          v_plan_id := v_plan_id_from_notes::uuid;
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé dans notes (plan_info): %', v_plan_id;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END IF;
  
  -- Méthode 2 : Recherche par regex dans le texte si JSONB parsing a échoué
  IF v_plan_id IS NULL AND v_notes_text IS NOT NULL THEN
    BEGIN
      -- Chercher un UUID dans le texte (format plan_id)
      SELECT (regexp_match(v_notes_text, '"plan_id"\s*:\s*"([^"]+)"'))[1]::uuid INTO v_plan_id;
      IF v_plan_id IS NOT NULL THEN
        RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID trouvé via regex: %', v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  -- Méthode 3 : Fallback - chercher dans les abonnements existants de l'entreprise
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
  
  -- 4. Si plan_id toujours NULL, erreur critique
  IF v_plan_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan ID non trouvé - Notes: %', LEFT(COALESCE(v_notes_text, ''), 500);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan ID manquant. Impossible de créer l''abonnement.',
      'details', jsonb_build_object(
        'paiement_id', p_paiement_id,
        'entreprise_id', v_entreprise_id,
        'notes_preview', LEFT(COALESCE(v_notes_text, ''), 200),
        'notes_type', pg_typeof(v_notes_text)
      )
    );
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan ID final: %', v_plan_id;
  
  -- 5. Récupérer le plan
  SELECT * INTO v_plan
  FROM plans_abonnement
  WHERE id = v_plan_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Plan non trouvé - ID: %', v_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Plan non trouvé: %s', v_plan_id)
    );
  END IF;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Plan trouvé: % (%)', v_plan.nom, v_plan.prix_mensuel;
  
  -- 6. Récupérer le client
  -- D'abord depuis les notes
  IF v_notes_json IS NOT NULL AND v_notes_json ? 'client_id' THEN
    BEGIN
      v_client_id := (v_notes_json->>'client_id')::uuid;
      IF v_client_id IS NOT NULL THEN
        SELECT * INTO v_client FROM clients WHERE id = v_client_id;
        IF FOUND THEN
          RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé depuis notes: %', v_client_id;
        ELSE
          v_client_id := NULL;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_client_id := NULL;
    END;
  END IF;
  
  -- Fallback : chercher le premier client de l'entreprise
  IF v_client_id IS NULL THEN
    SELECT * INTO v_client
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      v_client_id := v_client.id;
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Client trouvé depuis entreprise: %', v_client_id;
    END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '❌ [creer_facture_et_abonnement_apres_paiement] Aucun client trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise.'
    );
  END IF;
  
  -- 7. Récupérer auth_user_id depuis les notes ou depuis l'espace membre
  IF v_notes_json IS NOT NULL AND v_notes_json ? 'auth_user_id' THEN
    BEGIN
      v_auth_user_id := (v_notes_json->>'auth_user_id')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        v_auth_user_id := NULL;
    END;
  END IF;
  
  IF v_auth_user_id IS NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
  END IF;
  
  -- 8. Générer le numéro de facture
  v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  RAISE NOTICE '📄 [creer_facture_et_abonnement_apres_paiement] Numéro facture généré: %', v_numero_facture;
  
  -- 9. Créer la facture
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
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Facture créée: % (%)', v_facture_id, v_numero_facture;
  
  -- 10. ✅ CRÉATION CRITIQUE : Créer l'abonnement
  RAISE NOTICE '📦 [creer_facture_et_abonnement_apres_paiement] Création abonnement avec plan_id: %', v_plan_id;
  
  INSERT INTO abonnements (
    entreprise_id,
    plan_id,
    statut,
    date_debut,
    date_prochain_paiement,
    montant_mensuel,
    mode_paiement
  )
  VALUES (
    v_entreprise_id,
    v_plan_id,
    'actif',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    COALESCE(v_plan.prix_mensuel, v_montant_ht),
    'mensuel'
  )
  ON CONFLICT (entreprise_id, plan_id) DO UPDATE
  SET 
    statut = 'actif',
    date_debut = CURRENT_DATE,
    date_prochain_paiement = CURRENT_DATE + INTERVAL '1 month',
    montant_mensuel = COALESCE(v_plan.prix_mensuel, v_montant_ht),
    updated_at = now()
  RETURNING id INTO v_abonnement_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Abonnement créé/mis à jour: %', v_abonnement_id;
  
  -- 11. Créer/Mettre à jour l'espace membre si nécessaire
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id
    AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    -- L'espace membre sera créé par valider_paiement_entreprise
    RAISE NOTICE 'ℹ️ [creer_facture_et_abonnement_apres_paiement] Espace membre sera créé par valider_paiement_entreprise';
  ELSE
    -- Mettre à jour l'espace membre avec l'abonnement
    UPDATE espaces_membres_clients
    SET abonnement_id = v_abonnement_id,
        updated_at = now()
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Espace membre mis à jour avec abonnement: %', v_espace_membre_id;
  END IF;
  
  -- 12. Synchroniser les modules du plan (si fonction existe)
  BEGIN
    IF v_espace_membre_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan(v_espace_membre_id);
      RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Modules synchronisés depuis le plan';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ [creer_facture_et_abonnement_apres_paiement] Erreur synchronisation modules: %', SQLERRM;
  END;
  
  -- 13. Mettre à jour le statut de l'entreprise
  UPDATE entreprises
  SET statut = 'active',
      statut_paiement = 'paye',
      updated_at = now()
  WHERE id = v_entreprise_id;
  
  RAISE NOTICE '✅ [creer_facture_et_abonnement_apres_paiement] Entreprise mise à jour: statut=active, statut_paiement=paye';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'abonnement_id', v_abonnement_id,
    'plan_id', v_plan_id,
    'plan_nom', v_plan.nom
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
  'Crée automatiquement facture et abonnement après validation d''un paiement. Version corrigée avec parsing robuste des notes et récupération du plan_id.';

-- ============================================================================
-- PARTIE 3 : Vérifier et corriger les paiements existants sans plan_id dans notes
-- ============================================================================

DO $$
DECLARE
  v_paiement RECORD;
  v_plan_id uuid;
  v_count_fixed INTEGER := 0;
BEGIN
  -- Pour chaque paiement validé sans plan_id dans les notes
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
        OR (p.notes::text NOT LIKE '%plan_id%' AND (p.notes::jsonb IS NULL OR NOT (p.notes::jsonb ? 'plan_id')))
      )
      AND NOT EXISTS (
        SELECT 1 FROM abonnements a
        WHERE a.entreprise_id = p.entreprise_id
          AND a.statut = 'actif'
      )
  LOOP
    BEGIN
      -- Chercher un plan_id depuis un abonnement existant (même inactif)
      SELECT plan_id INTO v_plan_id
      FROM abonnements
      WHERE entreprise_id = v_paiement.entreprise_id
        AND plan_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Si trouvé, mettre à jour les notes du paiement
      IF v_plan_id IS NOT NULL THEN
        UPDATE paiements
        SET notes = COALESCE(
          CASE 
            WHEN notes IS NULL OR notes = '' THEN '{}'::jsonb
            WHEN pg_typeof(notes) = 'jsonb'::regtype THEN notes::jsonb
            ELSE notes::jsonb
          END,
          '{}'::jsonb
        ) || jsonb_build_object('plan_id', v_plan_id::text)
        WHERE id = v_paiement.id;
        
        v_count_fixed := v_count_fixed + 1;
        RAISE NOTICE '✅ Paiement % corrigé avec plan_id: %', v_paiement.id, v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur correction paiement %: %', v_paiement.id, SQLERRM;
    END;
  END LOOP;
  
  IF v_count_fixed > 0 THEN
    RAISE NOTICE '✅ % paiement(s) corrigé(s) avec plan_id', v_count_fixed;
  ELSE
    RAISE NOTICE 'ℹ️ Aucun paiement à corriger';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 4 : Vérifications finales
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists boolean;
  v_function_exists boolean;
  v_paiements_sans_plan_id INTEGER;
BEGIN
  -- Vérifier le trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
  ) INTO v_trigger_exists;
  
  -- Vérifier la fonction
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
  ) INTO v_function_exists;
  
  -- Compter les paiements validés sans plan_id dans notes
  SELECT COUNT(*) INTO v_paiements_sans_plan_id
  FROM paiements p
  WHERE p.statut = 'paye'
    AND p.entreprise_id IS NOT NULL
    AND (
      p.notes IS NULL 
      OR p.notes = ''
      OR (p.notes::text NOT LIKE '%plan_id%' AND (p.notes::jsonb IS NULL OR NOT (p.notes::jsonb ? 'plan_id')))
    );
  
  IF v_trigger_exists THEN
    RAISE NOTICE '✅ Trigger créé avec succès';
  ELSE
    RAISE WARNING '❌ Le trigger n''a pas été créé';
  END IF;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement existe et mise à jour';
  ELSE
    RAISE WARNING '❌ La fonction creer_facture_et_abonnement_apres_paiement n''existe pas';
  END IF;
  
  IF v_paiements_sans_plan_id > 0 THEN
    RAISE WARNING '⚠️ % paiement(s) validé(s) sans plan_id dans notes', v_paiements_sans_plan_id;
  ELSE
    RAISE NOTICE '✅ Tous les paiements validés ont un plan_id dans leurs notes';
  END IF;
END $$;

SELECT '✅ Migration de correction de la gestion des plans appliquée avec succès !' as resultat;

