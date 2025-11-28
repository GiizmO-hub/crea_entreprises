/*
  # CORRECTION COMPLÈTE DU WORKFLOW QUI S'ARRÊTE À 40%
  
  PROBLÈME IDENTIFIÉ:
  - Le workflow s'arrête à 40% après le paiement
  - Le paiement est validé mais la création automatique (facture, abonnement, espace client) ne se fait pas
  - La fonction valider_paiement_carte_immediat doit appeler creer_facture_et_abonnement_apres_paiement
  
  CORRECTIONS:
  1. ✅ S'assurer que valider_paiement_carte_immediat appelle TOUJOURS creer_facture_et_abonnement_apres_paiement
  2. ✅ S'assurer que creer_facture_et_abonnement_apres_paiement utilise correctement auth.users.id pour client_id dans abonnements
  3. ✅ Améliorer la gestion des erreurs avec des logs détaillés
  4. ✅ S'assurer que le paiement est bien marqué comme 'paye' avant d'appeler la fonction
*/

-- ============================================================================
-- PARTIE 1 : Recréer creer_facture_et_abonnement_apres_paiement avec corrections
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
  v_client_id uuid;  -- ID de la table clients
  v_entreprise_id uuid;
  v_user_id uuid;    -- user_id du propriétaire de l'entreprise (paiements.user_id)
  v_auth_user_id uuid;  -- auth.users.id pour utiliser dans abonnements.client_id
  v_espace_membre_id uuid;
  v_notes_json jsonb;
  v_entreprise_id_from_notes uuid;
  v_client_id_from_notes uuid;
  v_auth_user_id_from_notes uuid;
  v_plan_id_from_notes uuid;
BEGIN
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Paiement trouvé - Statut: %, Entreprise: %', 
    v_paiement.statut, v_paiement.entreprise_id;
  
  -- 2. ✅ FORCER le paiement comme "payé" si nécessaire
  IF v_paiement.statut != 'paye' THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Marquage du paiement comme "payé"...';
    UPDATE paiements
    SET methode_paiement = COALESCE(NULLIF(methode_paiement, ''), 'stripe'),
        statut = 'paye',
        date_paiement = COALESCE(date_paiement, CURRENT_DATE),
        updated_at = now()
    WHERE id = p_paiement_id;
    SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Paiement marqué comme "payé"';
  END IF;
  
  -- 3. Parser les notes pour récupérer les IDs nécessaires
  v_notes_json := NULL;
  v_entreprise_id_from_notes := NULL;
  v_client_id_from_notes := NULL;
  v_auth_user_id_from_notes := NULL;
  v_plan_id_from_notes := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      -- Parser les notes (peut être TEXT ou JSONB)
      IF pg_typeof(v_paiement.notes) = 'text'::regtype THEN
        v_notes_json := v_paiement.notes::jsonb;
      ELSE
        v_notes_json := v_paiement.notes;
      END IF;
      
      -- Récupérer entreprise_id depuis notes si NULL
      IF v_paiement.entreprise_id IS NULL AND v_notes_json ? 'entreprise_id' THEN
        v_entreprise_id_from_notes := (v_notes_json->>'entreprise_id')::uuid;
        UPDATE paiements
        SET entreprise_id = v_entreprise_id_from_notes, updated_at = now()
        WHERE id = p_paiement_id;
        SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID récupéré depuis notes: %', v_entreprise_id_from_notes;
      END IF;
      
      -- Récupérer client_id depuis notes
      IF v_notes_json ? 'client_id' THEN
        v_client_id_from_notes := (v_notes_json->>'client_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client ID trouvé dans notes: %', v_client_id_from_notes;
      END IF;
      
      -- Récupérer auth_user_id depuis notes
      IF v_notes_json ? 'auth_user_id' THEN
        v_auth_user_id_from_notes := (v_notes_json->>'auth_user_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé dans notes: %', v_auth_user_id_from_notes;
      END IF;
      
      -- Récupérer plan_id depuis notes
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id_from_notes := (v_notes_json->>'plan_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé dans notes: %', v_plan_id_from_notes;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
    END;
  END IF;
  
  -- 4. Récupérer entreprise_id (depuis paiement ou notes)
  v_entreprise_id := COALESCE(v_paiement.entreprise_id, v_entreprise_id_from_notes);
  
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID manquant';
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise ID manquant.');
  END IF;
  
  v_user_id := v_paiement.user_id;  -- L'user_id du propriétaire de l'entreprise
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📊 Entreprise: %, User: %, Montant TTC: %€', 
    v_entreprise_id, v_user_id, v_montant_ttc;
  
  -- 5. Récupérer plan_id (depuis notes ou chercher dans abonnements existants)
  v_plan_id := v_plan_id_from_notes;
  
  IF v_plan_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Recherche plan_id dans abonnements existants...';
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id AND plan_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé dans abonnements: %', v_plan_id;
    END IF;
  END IF;
  
  -- Si plan_id toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan ID non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID manquant.');
  END IF;
  
  -- 6. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan non trouvé: %', v_plan_id;
    RETURN jsonb_build_object('success', false, 'error', 'Plan non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
  
  -- 7. Récupérer le client (depuis notes ou depuis entreprise)
  v_client_id := NULL;
  
  -- Priorité 1: client_id depuis notes
  IF v_client_id_from_notes IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_client_id_from_notes;
    IF FOUND THEN 
      v_client_id := v_client.id;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client trouvé via notes: %', v_client_id;
    END IF;
  END IF;
  
  -- Priorité 2: client depuis entreprise
  IF v_client_id IS NULL THEN
    SELECT * INTO v_client FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
    IF FOUND THEN 
      v_client_id := v_client.id;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client trouvé via entreprise: %', v_client_id;
    END IF;
  END IF;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Aucun client trouvé pour entreprise: %', v_entreprise_id;
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client trouvé pour cette entreprise.');
  END IF;
  
  -- 8. ✅ Récupérer auth_user_id (l'ID de auth.users pour le client) - CRUCIAL pour abonnements.client_id
  v_auth_user_id := NULL;
  
  -- Priorité 1: auth_user_id depuis notes
  IF v_auth_user_id_from_notes IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_auth_user_id_from_notes) THEN
      v_auth_user_id := v_auth_user_id_from_notes;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via notes: %', v_auth_user_id;
    END IF;
  END IF;
  
  -- Priorité 2: auth_user_id depuis email du client
  IF v_auth_user_id IS NULL AND v_client.email IS NOT NULL THEN
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = v_client.email
    LIMIT 1;
    
    IF v_auth_user_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via email client: %', v_auth_user_id;
    END IF;
  END IF;
  
  -- Priorité 3: auth_user_id depuis espaces_membres_clients
  IF v_auth_user_id IS NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id
    LIMIT 1;
    
    IF v_auth_user_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via espace membre: %', v_auth_user_id;
    END IF;
  END IF;
  
  -- Si toujours NULL, utiliser le user_id du paiement (propriétaire de l'entreprise)
  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := v_user_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Utilisation du user_id du paiement comme fallback: %', v_auth_user_id;
  END IF;
  
  -- 9. Générer numéro facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- 10. Créer la facture
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📄 Création facture...';
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
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  
  -- 11. Créer l'abonnement
  -- ⚠️ IMPORTANT: client_id dans abonnements référence auth.users(id), donc utiliser v_auth_user_id
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 Création abonnement avec client_id (auth.users.id): %...', v_auth_user_id;
  INSERT INTO abonnements (
    client_id, entreprise_id, plan_id, statut, date_debut,
    date_prochain_paiement, montant_mensuel, mode_paiement
  )
  VALUES (
    v_auth_user_id, v_entreprise_id, v_plan_id, 'actif', CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month', v_montant_ht, 'mensuel'
  )
  RETURNING id INTO v_abonnement_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé: %', v_abonnement_id;
  
  -- 12. Créer/Mettre à jour l'espace membre client
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 👤 Création espace membre...';
    INSERT INTO espaces_membres_clients (
      client_id, entreprise_id, user_id, actif, modules_actifs, statut_compte, role
    )
    VALUES (
      v_client_id, v_entreprise_id, v_auth_user_id, true,
      jsonb_build_object(
        'tableau_de_bord', true, 'mon_entreprise', true,
        'factures', true, 'documents', true, 'abonnements', true
      ),
      'actif', 'client_super_admin'
    )
    RETURNING id INTO v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
  ELSE
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔄 Mise à jour espace membre...';
    UPDATE espaces_membres_clients
    SET actif = true,
        statut_compte = 'actif',
        role = 'client_super_admin',
        user_id = COALESCE(v_auth_user_id, user_id),
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 13. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible: %', SQLERRM;
  END;
  
  -- 14. Activer entreprise et client
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🏢 Activation entreprise et client...';
  UPDATE entreprises
  SET statut = 'active', statut_paiement = 'paye'
  WHERE id = v_entreprise_id AND (statut != 'active' OR statut_paiement != 'paye');
  
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND statut != 'actif';
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🎉 TERMINÉ AVEC SUCCÈS !';
  
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
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Version corrigée complète qui gère correctement client_id pour abonnements (doit être auth.users.id).';

-- ============================================================================
-- PARTIE 2 : Recréer valider_paiement_carte_immediat pour appeler TOUJOURS creer_facture_et_abonnement_apres_paiement
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
  
  -- 2. Marquer le paiement comme payé (même s'il est déjà payé, on le met à jour)
  RAISE NOTICE '📝 [valider_paiement_carte_immediat] Marquage du paiement comme payé...';
  
  UPDATE paiements
  SET methode_paiement = COALESCE(NULLIF(methode_paiement, ''), 'stripe'),
      statut = 'paye',
      date_paiement = COALESCE(date_paiement, CURRENT_DATE),
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  RAISE NOTICE '✅ [valider_paiement_carte_immediat] Paiement marqué comme payé';
  
  -- 3. ✅ CRUCIAL: Appeler TOUJOURS creer_facture_et_abonnement_apres_paiement
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
    'email', v_result->>'email'
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
  'Valide un paiement par carte immédiatement. Déclenche AUTOMATIQUEMENT la création complète (facture, abonnement, espace client, droits admin). Version corrigée qui appelle TOUJOURS creer_facture_et_abonnement_apres_paiement.';

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement recréée avec succès';
  ELSE
    RAISE EXCEPTION '❌ Fonction creer_facture_et_abonnement_apres_paiement non trouvée après création';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_carte_immediat') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_carte_immediat recréée avec succès';
  ELSE
    RAISE EXCEPTION '❌ Fonction valider_paiement_carte_immediat non trouvée après création';
  END IF;
END $$;

SELECT '✅ Migration de correction du workflow 40% appliquée avec succès !' as resultat;

