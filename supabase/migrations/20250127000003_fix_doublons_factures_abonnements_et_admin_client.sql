/*
  # CORRECTION : Éviter les doublons et attribuer le rôle admin au client
  
  PROBLÈMES IDENTIFIÉS:
  1. ❌ Plusieurs factures créées pour le même paiement
  2. ❌ Plusieurs abonnements créés pour la même entreprise
  3. ❌ Le client n'est pas passé en admin (client_super_admin)
  
  CORRECTIONS:
  1. ✅ Vérifier si une facture existe déjà pour ce paiement avant de créer
  2. ✅ Vérifier si un abonnement existe déjà pour cette entreprise/plan avant de créer
  3. ✅ Créer/mettre à jour le rôle client_super_admin dans la table utilisateurs
  4. ✅ S'assurer que le client a bien les droits admin dans son espace
*/

-- ============================================================================
-- PARTIE 1 : Corriger creer_facture_et_abonnement_apres_paiement
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
  v_auth_user_id uuid;  -- L'ID de auth.users pour le client
  v_espace_membre_id uuid;
  v_notes_json jsonb;
  v_statut_initial text;
  v_entreprise_id_from_notes uuid;
  v_client_id_from_notes uuid;
  v_auth_user_id_from_notes uuid;
  v_facture_existante RECORD;
  v_abonnement_existant RECORD;
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
  
  -- 3. Parser les notes (TEXT → JSONB)
  v_notes_json := NULL;
  v_entreprise_id_from_notes := NULL;
  v_client_id_from_notes := NULL;
  v_auth_user_id_from_notes := NULL;
  
  IF v_paiement.notes IS NOT NULL AND v_paiement.notes != '' THEN
    BEGIN
      -- Parser les notes (peut être TEXT ou JSONB)
      IF pg_typeof(v_paiement.notes) = 'text'::regtype THEN
        v_notes_json := v_paiement.notes::jsonb;
      ELSE
        v_notes_json := v_paiement.notes;
      END IF;
      
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
      
      -- Récupérer client_id et auth_user_id depuis notes
      IF v_notes_json ? 'client_id' THEN
        v_client_id_from_notes := (v_notes_json->>'client_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client ID trouvé dans notes: %', v_client_id_from_notes;
      END IF;
      
      IF v_notes_json ? 'auth_user_id' THEN
        v_auth_user_id_from_notes := (v_notes_json->>'auth_user_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé dans notes: %', v_auth_user_id_from_notes;
      END IF;
      
      -- Récupérer plan_id depuis notes
      IF v_notes_json ? 'plan_id' THEN
        v_plan_id := (v_notes_json->>'plan_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé dans notes: %', v_plan_id;
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
  
  -- 6. Si plan_id toujours NULL, erreur
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan ID non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Plan ID manquant.');
  END IF;
  
  -- 7. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan non trouvé: %', v_plan_id;
    RETURN jsonb_build_object('success', false, 'error', 'Plan non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
  
  -- 8. ✅ Récupérer le client (depuis notes ou depuis entreprise)
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
  
  -- 9. ✅ Récupérer auth_user_id (l'ID de auth.users pour le client)
  -- C'est cet ID qui doit être utilisé dans abonnements.client_id
  v_auth_user_id := NULL;
  
  -- Priorité 1: auth_user_id depuis notes
  IF v_auth_user_id_from_notes IS NOT NULL THEN
    -- Vérifier que cet user existe dans auth.users
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
  
  -- 10. ✅ VÉRIFIER SI UNE FACTURE EXISTE DÉJÀ pour ce paiement
  SELECT * INTO v_facture_existante
  FROM factures
  WHERE notes IS NOT NULL 
    AND (notes::jsonb->>'paiement_id' = p_paiement_id::text 
         OR notes LIKE '%' || p_paiement_id::text || '%')
  LIMIT 1;
  
  IF v_facture_existante.id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante pour ce paiement: %', v_facture_existante.id;
    v_facture_id := v_facture_existante.id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Utilisation de la facture existante';
  ELSE
    -- 11. Générer numéro facture unique
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    END LOOP;
    
    -- 12. Créer la facture
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
  END IF;
  
  -- 13. ✅ VÉRIFIER SI UN ABONNEMENT EXISTE DÉJÀ pour cette entreprise/plan
  SELECT * INTO v_abonnement_existant
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id 
    AND plan_id = v_plan_id
    AND statut = 'actif'
  LIMIT 1;
  
  IF v_abonnement_existant.id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant pour cette entreprise/plan: %', v_abonnement_existant.id;
    v_abonnement_id := v_abonnement_existant.id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Utilisation de l''abonnement existant';
  ELSE
    -- 14. Créer l'abonnement
    -- ⚠️ IMPORTANT: client_id dans abonnements référence auth.users(id), donc utiliser v_auth_user_id
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 Création abonnement...';
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
  END IF;
  
  -- 15. Créer/Mettre à jour l'espace membre client
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
      v_client_id, v_entreprise_id, v_auth_user_id, true,
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
        user_id = COALESCE(v_auth_user_id, user_id),  -- Mettre à jour user_id si nécessaire
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 16. ✅ CRÉER/METTRE À JOUR LE RÔLE client_super_admin dans utilisateurs
  IF v_auth_user_id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔐 Attribution du rôle client_super_admin...';
    
    -- Vérifier si l'utilisateur existe déjà dans la table utilisateurs
    IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
      -- Mettre à jour le rôle
      UPDATE utilisateurs
      SET role = 'client_super_admin',
          updated_at = now()
      WHERE id = v_auth_user_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin mis à jour dans utilisateurs';
    ELSE
      -- Créer l'entrée avec le rôle client_super_admin
      INSERT INTO utilisateurs (
        id, email, nom, prenom, role, statut, created_at, updated_at
      )
      VALUES (
        v_auth_user_id,
        v_client.email,
        v_client.nom,
        v_client.prenom,
        'client_super_admin',
        'active',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET role = 'client_super_admin',
          updated_at = now();
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin créé dans utilisateurs';
    END IF;
    
    -- Mettre à jour aussi dans auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'role', 'client_super_admin',
          'type', 'client',
          'is_client_super_admin', true
        )
    WHERE id = v_auth_user_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Métadonnées auth.users mises à jour avec client_super_admin';
  END IF;
  
  -- 17. Synchroniser modules (si fonction existe)
  BEGIN
    PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Modules synchronisés';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible';
  END;
  
  -- 18. Activer entreprise et client
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
    'numero_facture', COALESCE(v_numero_facture, v_facture_existante.numero),
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'email', v_client.email,
    'client_role', 'client_super_admin'
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
  'Crée automatiquement facture, abonnement, espace client avec droits admin après validation d''un paiement. Évite les doublons et attribue le rôle client_super_admin.';

-- ============================================================================
-- PARTIE 2 : Vérifications finales
-- ============================================================================

SELECT '✅ Migration de correction des doublons et attribution rôle admin appliquée avec succès !' as resultat;

