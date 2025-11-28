-- ============================================================================
-- CORRECTION COMPLÈTE ET FINALE DU WORKFLOW DE PAIEMENT
-- ============================================================================
-- 
-- PROBLÈMES IDENTIFIÉS :
-- 1. ❌ AUCUN PLAN dans plans_abonnement → Les plans ne s'affichent pas
-- 2. ❌ Fonction creer_facture_et_abonnement_apres_paiement incomplète
-- 3. ❌ Colonne client_id dans abonnements doit référencer auth.users(id)
-- 4. ❌ Pas de colonne role dans espaces_membres_clients
-- 
-- CORRECTIONS APPLIQUÉES :
-- 1. ✅ Insérer les 4 plans d'abonnement de base
-- 2. ✅ Corriger creer_facture_et_abonnement_apres_paiement complètement
-- 3. ✅ Utiliser v_user_id dans abonnements (pas v_client_id)
-- 4. ✅ Utiliser statut_compte au lieu de role
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1 : INSÉRER LES PLANS D'ABONNEMENT (SI NÉCESSAIRE)
-- ============================================================================

DO $$
DECLARE
  v_plan_count INTEGER;
BEGIN
  -- Compter les plans existants
  SELECT COUNT(*) INTO v_plan_count FROM plans_abonnement WHERE actif = true;
  
  IF v_plan_count = 0 THEN
    RAISE NOTICE '📋 Aucun plan trouvé, insertion des 4 plans de base...';
    
    -- Insérer les 4 plans d'abonnement
    INSERT INTO plans_abonnement (
      nom, description, prix_mensuel, prix_annuel, 
      max_entreprises, max_utilisateurs, max_factures_mois, 
      ordre, actif, fonctionnalites
    ) VALUES
    (
      'Starter', 
      'Pour les entrepreneurs qui démarrent leur activité', 
      9.90, 99.00, 
      1, 1, 50, 
      1, true, 
      '{"facturation": true, "clients": true, "dashboard": true}'::jsonb
    ),
    (
      'Business', 
      'Pour les petites entreprises en croissance', 
      29.90, 299.00, 
      3, 5, 200, 
      2, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true}'::jsonb
    ),
    (
      'Professional', 
      'Pour les entreprises établies', 
      79.90, 799.00, 
      10, 20, 1000, 
      3, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true}'::jsonb
    ),
    (
      'Enterprise', 
      'Solution complète pour grandes structures', 
      199.90, 1999.00, 
      999, 999, 99999, 
      4, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true, "support_dedie": true, "personnalisation": true}'::jsonb
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ 4 plans d''abonnement insérés avec succès !';
  ELSE
    RAISE NOTICE '✅ % plans déjà présents dans la base', v_plan_count;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2 : CORRIGER creer_facture_et_abonnement_apres_paiement
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
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  v_statut_initial := v_paiement.statut;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Statut initial: %', v_statut_initial;
  
  -- 2. Marquer le paiement comme "payé" si nécessaire
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
  
  -- 3. Parser les notes (TEXT → JSONB)
  v_notes_json := NULL;
  v_entreprise_id_from_notes := NULL;
  v_client_id_from_notes := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      v_notes_json := v_paiement.notes::jsonb;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Notes parsées';
      
      -- Récupérer entreprise_id depuis notes si NULL
      IF v_paiement.entreprise_id IS NULL AND v_notes_json ? 'entreprise_id' THEN
        v_entreprise_id_from_notes := (v_notes_json->>'entreprise_id')::uuid;
        UPDATE paiements
        SET entreprise_id = v_entreprise_id_from_notes, updated_at = now()
        WHERE id = p_paiement_id;
        SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID récupéré depuis notes: %', v_entreprise_id_from_notes;
      END IF;
      
      -- Récupérer client_id et plan_id depuis notes
      IF v_notes_json ? 'client_id' THEN
        v_client_id_from_notes := (v_notes_json->>'client_id')::uuid;
      END IF;
      
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé dans notes: %', v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
    END;
  END IF;
  
  -- 4. Récupérer entreprise_id
  v_entreprise_id := v_paiement.entreprise_id;
  
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID manquant';
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise ID manquant.');
  END IF;
  
  v_user_id := v_paiement.user_id;
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, v_montant_ht * 0.20);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, v_montant_ht * 1.20);
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] Entreprise: %, User: %, Montant TTC: %', v_entreprise_id, v_user_id, v_montant_ttc;
  
  -- 5. Fallback pour plan_id (chercher dans abonnements existants)
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
  
  -- 6. Fallback 2 : Chercher via get_paiement_info_for_stripe
  IF v_plan_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Tentative via get_paiement_info_for_stripe...';
    BEGIN
      SELECT (result->>'plan_id')::uuid INTO v_plan_id
      FROM (SELECT get_paiement_info_for_stripe(p_paiement_id) as result) sub
      WHERE (result->>'plan_id')::uuid IS NOT NULL;
      
      IF v_plan_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé via get_paiement_info_for_stripe: %', v_plan_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur get_paiement_info_for_stripe: %', SQLERRM;
    END;
  END IF;
  
  -- 7. Si plan_id toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan ID non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID manquant.');
  END IF;
  
  -- 8. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan non trouvé: %', v_plan_id;
    RETURN jsonb_build_object('success', false, 'error', 'Plan non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
  
  -- 9. Récupérer le client
  v_client_id := NULL;
  
  IF v_client_id_from_notes IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_client_id_from_notes;
    IF FOUND THEN 
      v_client_id := v_client.id;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client trouvé via notes: %', v_client_id;
    END IF;
  END IF;
  
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
  
  -- 10. Générer numéro facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;
  
  -- 11. Créer la facture
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
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id::text, v_numero_facture;
  
  -- 12. Créer l'abonnement
  -- ⚠️ IMPORTANT: client_id dans abonnements référence auth.users(id), donc utiliser v_user_id
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 Création abonnement...';
  INSERT INTO abonnements (
    client_id, entreprise_id, plan_id, statut, date_debut,
    date_prochain_paiement, montant_mensuel, mode_paiement
  )
  VALUES (
    v_user_id, v_entreprise_id, v_plan_id, 'actif', CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month', v_montant_ht, 'mensuel'
  )
  RETURNING id INTO v_abonnement_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé: %', v_abonnement_id;
  
  -- 13. Créer/Mettre à jour l'espace membre client
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 👤 Création espace membre...';
    INSERT INTO espaces_membres_clients (
      client_id, entreprise_id, user_id, actif, modules_actifs, statut_compte
    )
    VALUES (
      v_client_id, v_entreprise_id, v_user_id, true,
      jsonb_build_object(
        'tableau_de_bord', true, 'mon_entreprise', true,
        'factures', true, 'documents', true, 'abonnements', true
      ),
      'actif'
    )
    RETURNING id INTO v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
  ELSE
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔄 Mise à jour espace membre...';
    UPDATE espaces_membres_clients
    SET actif = true,
        statut_compte = 'actif',
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 14. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible';
  END;
  
  -- 15. Activer entreprise et client
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
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: %', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Version corrigée complète.';

-- ============================================================================
-- ÉTAPE 3 : VÉRIFICATIONS FINALES
-- ============================================================================

DO $$
DECLARE
  v_plan_count INTEGER;
  v_func_exists BOOLEAN;
BEGIN
  -- Vérifier les plans
  SELECT COUNT(*) INTO v_plan_count FROM plans_abonnement WHERE actif = true;
  IF v_plan_count >= 4 THEN
    RAISE NOTICE '✅ % plans d''abonnement disponibles', v_plan_count;
  ELSE
    RAISE WARNING '⚠️ Seulement % plans trouvés (attendu: 4)', v_plan_count;
  END IF;
  
  -- Vérifier la fonction
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
  ) INTO v_func_exists;
  
  IF v_func_exists THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement créée';
  ELSE
    RAISE WARNING '⚠️ Fonction creer_facture_et_abonnement_apres_paiement non trouvée';
  END IF;
END $$;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

SELECT '✅ Corrections complètes appliquées !' as resultat;

