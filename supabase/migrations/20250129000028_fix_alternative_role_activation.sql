/*
  # CORRECTION : Récupération alternative du rôle client_super_admin
  
  Problème :
  - Le auth_user_id n'est pas toujours bien récupéré
  - Le rôle n'est pas activé si auth_user_id est NULL
  - Il faut trouver l'utilisateur par d'autres moyens (email, client_id)
  
  Solution :
  - Récupérer l'utilisateur par email du client
  - Récupérer l'utilisateur depuis clients directement
  - Récupérer depuis paiements.notes si disponible
  - Activer le rôle même si on trouve l'utilisateur tardivement
*/

-- ========================================
-- Corriger creer_facture_et_abonnement_apres_paiement
-- ========================================

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
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_client_email text;
  v_plan_id uuid;
  v_plan RECORD;
  v_plan_info jsonb;
  v_facture_id uuid;
  v_facture_existante uuid;
  v_numero_facture text;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_montant_mensuel numeric;
  v_plan_prix_mensuel numeric;
  v_plan_prix_annuel numeric;
  v_mode_paiement text;
  v_role_updated integer := 0;
  v_auth_role_updated integer := 0;
BEGIN
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. Récupérer workflow_data
  SELECT * INTO v_workflow_data
  FROM workflow_data
  WHERE paiement_id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ workflow_data non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Données du workflow non trouvées');
  END IF;
  
  -- 3. ✅ NOUVEAU : Récupérer les IDs avec extraction depuis workflow_data
  v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_paiement.entreprise_id);
  v_client_id := v_workflow_data.client_id;
  v_auth_user_id := v_workflow_data.auth_user_id;
  v_plan_id := v_workflow_data.plan_id;
  v_plan_info := COALESCE(v_workflow_data.plan_info, '{}'::jsonb);
  
  -- 4. ✅ NOUVEAU : Récupérer le client pour obtenir son email
  IF v_client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_client_id;
    IF FOUND THEN
      v_client_email := v_client.email;
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client trouvé - Email: %', v_client_email;
    END IF;
  END IF;
  
  -- 5. ✅ NOUVEAU : MULTI-MÉTHODES pour récupérer auth_user_id
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 auth_user_id NULL, recherche alternative...';
    
    -- Méthode 1 : Depuis espaces_membres_clients
    IF v_client_id IS NOT NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM espaces_membres_clients
      WHERE client_id = v_client_id
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ auth_user_id trouvé via espaces_membres_clients: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- Méthode 2 : Depuis clients.email -> auth.users
    IF v_auth_user_id IS NULL AND v_client_email IS NOT NULL THEN
      SELECT id INTO v_auth_user_id
      FROM auth.users
      WHERE email = v_client_email
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ auth_user_id trouvé via email client: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- Méthode 3 : Depuis utilisateurs par email
    IF v_auth_user_id IS NULL AND v_client_email IS NOT NULL THEN
      SELECT id INTO v_auth_user_id
      FROM utilisateurs
      WHERE email = v_client_email
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ auth_user_id trouvé via utilisateurs.email: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- Méthode 4 : Depuis entreprises.user_id
    IF v_auth_user_id IS NULL AND v_entreprise_id IS NOT NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM entreprises
      WHERE id = v_entreprise_id
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ auth_user_id trouvé via entreprises.user_id: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- Méthode 5 : Depuis clients liés à l'entreprise
    IF v_auth_user_id IS NULL AND v_entreprise_id IS NOT NULL THEN
      SELECT u.id INTO v_auth_user_id
      FROM clients c
      INNER JOIN utilisateurs u ON u.email = c.email
      WHERE c.entreprise_id = v_entreprise_id
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ auth_user_id trouvé via clients/entreprises: %', v_auth_user_id;
      END IF;
    END IF;
  END IF;
  
  -- 6. Extraire plan_id depuis plan_info si nécessaire
  IF v_plan_id IS NULL AND v_plan_info IS NOT NULL THEN
    v_plan_id := (v_plan_info->>'plan_id')::uuid;
  END IF;
  
  -- 7. Extraire prix depuis plan_info
  IF v_plan_info IS NOT NULL AND jsonb_typeof(v_plan_info) = 'object' THEN
    v_plan_prix_mensuel := (v_plan_info->>'prix_mensuel')::numeric;
    v_plan_prix_annuel := (v_plan_info->>'prix_annuel')::numeric;
  END IF;
  
  -- 8. Vérifier entreprise_id
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'ID d''entreprise manquant');
  END IF;
  
  -- 9. Vérifier facture
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    v_facture_id := v_facture_existante;
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
    
    SELECT id INTO v_abonnement_id 
    FROM abonnements 
    WHERE facture_id = v_facture_id
       OR (entreprise_id = v_entreprise_id AND plan_id = v_plan_id AND v_plan_id IS NOT NULL)
    LIMIT 1;
  END IF;
  
  -- 10. Forcer statut paye
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
  END IF;
  
  -- 11. Calculer montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  v_montant_mensuel := v_montant_ttc;
  
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    IF v_plan_prix_mensuel IS NOT NULL AND v_plan_prix_mensuel > 0 THEN
      v_montant_mensuel := v_plan_prix_mensuel;
    ELSIF v_plan_prix_annuel IS NOT NULL AND v_plan_prix_annuel > 0 THEN
      v_montant_mensuel := v_plan_prix_annuel / 12;
    END IF;
  END IF;
  
  v_mode_paiement := CASE 
    WHEN v_plan_prix_annuel IS NOT NULL AND v_plan_prix_annuel > 0 AND v_montant_ttc >= v_plan_prix_annuel THEN 'annuel'
    ELSE 'mensuel'
  END;
  
  -- 12. Créer facture si nécessaire
  IF v_facture_id IS NULL THEN
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
    
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
    END LOOP;
    
    INSERT INTO factures (
      entreprise_id, client_id, numero, montant_ht, tva, montant_ttc,
      date_emission, date_echeance, statut, paiement_id
    )
    VALUES (
      v_entreprise_id, v_client_id, v_numero_facture,
      v_montant_ht, v_montant_tva, v_montant_ttc,
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'payee', p_paiement_id
    )
    RETURNING id INTO v_facture_id;
  END IF;
  
  -- 13. Créer abonnement si nécessaire
  IF v_plan_id IS NOT NULL AND v_entreprise_id IS NOT NULL AND v_montant_mensuel > 0 AND v_abonnement_id IS NULL THEN
    BEGIN
      INSERT INTO abonnements (
        entreprise_id, client_id, plan_id, 
        date_debut, date_fin, statut, facture_id,
        montant_mensuel, mode_paiement, date_prochain_paiement
      )
      VALUES (
        v_entreprise_id, v_auth_user_id, v_plan_id,
        CURRENT_DATE, 
        CASE WHEN v_mode_paiement = 'annuel' THEN CURRENT_DATE + INTERVAL '1 year' ELSE CURRENT_DATE + INTERVAL '1 month' END, 
        'actif', v_facture_id,
        v_montant_mensuel, v_mode_paiement,
        CASE WHEN v_mode_paiement = 'annuel' THEN CURRENT_DATE + INTERVAL '1 year' ELSE CURRENT_DATE + INTERVAL '1 month' END
      )
      RETURNING id INTO v_abonnement_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_abonnement_id
        FROM abonnements
        WHERE entreprise_id = v_entreprise_id AND plan_id = v_plan_id
        LIMIT 1;
        
        UPDATE abonnements
        SET statut = 'actif',
            facture_id = v_facture_id,
            montant_mensuel = COALESCE(v_montant_mensuel, abonnements.montant_mensuel),
            client_id = COALESCE(v_auth_user_id, abonnements.client_id),
            mode_paiement = COALESCE(v_mode_paiement, abonnements.mode_paiement)
        WHERE id = v_abonnement_id;
    END;
  END IF;
  
  -- 14. Créer espace membre si nécessaire
  IF v_client_id IS NOT NULL AND v_entreprise_id IS NOT NULL THEN
    BEGIN
      SELECT id INTO v_espace_membre_id
      FROM espaces_membres_clients
      WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id;
      
      IF v_espace_membre_id IS NULL THEN
        INSERT INTO espaces_membres_clients (
          client_id, entreprise_id, user_id, actif,
          modules_actifs, statut_compte, abonnement_id
        )
        VALUES (
          v_client_id, v_entreprise_id, v_auth_user_id, true,
          COALESCE(v_plan_info->'fonctionnalites', jsonb_build_object(
            'tableau_de_bord', true, 'mon_entreprise', true,
            'factures', true, 'documents', true, 'abonnements', true
          )),
          'actif', v_abonnement_id
        )
        RETURNING id INTO v_espace_membre_id;
      ELSE
        UPDATE espaces_membres_clients
        SET actif = true,
            statut_compte = 'actif',
            user_id = COALESCE(v_auth_user_id, user_id),
            abonnement_id = COALESCE(v_abonnement_id, abonnement_id),
            modules_actifs = COALESCE(v_plan_info->'fonctionnalites', modules_actifs)
        WHERE id = v_espace_membre_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur espace membre: %', SQLERRM;
    END;
  END IF;
  
  -- 15. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  IF v_client_id IS NOT NULL THEN
    UPDATE clients SET statut = 'actif' WHERE id = v_client_id;
  END IF;
  
  -- 16. ✅ NOUVEAU : ACTIVER client_super_admin avec MULTI-MÉTHODES
  -- Si auth_user_id est maintenant disponible, activer le rôle
  IF v_auth_user_id IS NOT NULL THEN
    BEGIN
      -- Méthode 1 : Mettre à jour utilisateurs par ID
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE id = v_auth_user_id;
      
      GET DIAGNOSTICS v_role_updated = ROW_COUNT;
      
      IF v_role_updated > 0 THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle mis à jour dans utilisateurs (ID: %)', v_auth_user_id;
      ELSE
        -- Méthode 2 : Si pas trouvé par ID, chercher par email
        IF v_client_email IS NOT NULL THEN
          UPDATE utilisateurs
          SET role = 'client_super_admin'
          WHERE email = v_client_email;
          
          GET DIAGNOSTICS v_role_updated = ROW_COUNT;
          
          IF v_role_updated > 0 THEN
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle mis à jour dans utilisateurs (Email: %)', v_client_email;
          END IF;
        END IF;
      END IF;
      
      -- Méthode 3 : Mettre à jour auth.users par ID
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"client_super_admin"'::jsonb,
        true
      )
      WHERE id = v_auth_user_id;
      
      GET DIAGNOSTICS v_auth_role_updated = ROW_COUNT;
      
      IF v_auth_role_updated > 0 THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle mis à jour dans auth.users (ID: %)', v_auth_user_id;
      ELSE
        -- Méthode 4 : Si pas trouvé par ID, chercher par email
        IF v_client_email IS NOT NULL THEN
          UPDATE auth.users
          SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"client_super_admin"'::jsonb,
            true
          )
          WHERE email = v_client_email;
          
          GET DIAGNOSTICS v_auth_role_updated = ROW_COUNT;
          
          IF v_auth_role_updated > 0 THEN
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle mis à jour dans auth.users (Email: %)', v_client_email;
          END IF;
        END IF;
      END IF;
      
      -- Vérification finale
      IF v_role_updated > 0 OR v_auth_role_updated > 0 THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅✅✅ Rôle client_super_admin activé !';
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Aucune mise à jour de rôle effectuée';
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur mise à jour rôle: % - %', SQLERRM, SQLSTATE;
    END;
  ELSIF v_client_email IS NOT NULL THEN
    -- ✅ NOUVEAU : Essayer même sans auth_user_id, juste avec l'email
    BEGIN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Tentative activation rôle sans auth_user_id, avec email: %', v_client_email;
      
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE email = v_client_email;
      
      GET DIAGNOSTICS v_role_updated = ROW_COUNT;
      
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"client_super_admin"'::jsonb,
        true
      )
      WHERE email = v_client_email;
      
      GET DIAGNOSTICS v_auth_role_updated = ROW_COUNT;
      
      IF v_role_updated > 0 OR v_auth_role_updated > 0 THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅✅✅ Rôle activé via email uniquement !';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur activation via email: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Impossible d''activer le rôle : auth_user_id et email manquants';
  END IF;
  
  -- 17. Marquer workflow_data comme traité
  UPDATE workflow_data
  SET traite = true, updated_at = now()
  WHERE paiement_id = p_paiement_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'entreprise_id', v_entreprise_id,
    'auth_user_id', v_auth_user_id,
    'client_email', v_client_email,
    'role_updated', v_role_updated > 0,
    'auth_role_updated', v_auth_role_updated > 0,
    'client_super_admin_activated', (v_role_updated > 0 OR v_auth_role_updated > 0)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. Version avec récupération alternative du rôle et activation multi-méthodes.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000028 appliquée';
  RAISE NOTICE '📋 Récupération alternative de auth_user_id (5 méthodes)';
  RAISE NOTICE '📋 Activation rôle par ID OU par email';
  RAISE NOTICE '📋 Fonction robuste même si auth_user_id manquant';
END $$;

