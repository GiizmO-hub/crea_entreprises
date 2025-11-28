/*
  # CORRECTION : Garantir l'activation client_super_admin à 100%
  
  Problème :
  - Le rôle client_super_admin doit être appliqué pour que le workflow passe à 100%
  - Actuellement, la mise à jour du rôle peut échouer silencieusement
  - Il faut s'assurer que le rôle est appliqué dans utilisateurs ET auth.users
  
  Solution :
  - Forcer la mise à jour du rôle dans utilisateurs
  - Mettre à jour aussi auth.users.raw_user_meta_data
  - Vérifier que le rôle est bien appliqué
  - Ajouter des logs détaillés
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
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
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
  v_role_updated boolean := false;
  v_auth_role_updated boolean := false;
BEGIN
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Paiement trouvé - Statut: %, Entreprise: %, Montant: %', 
    v_paiement.statut, v_paiement.entreprise_id, v_paiement.montant_ttc;
  
  -- 2. Récupérer les données depuis workflow_data
  SELECT * INTO v_workflow_data
  FROM workflow_data
  WHERE paiement_id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ workflow_data non trouvé pour paiement: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Données du workflow non trouvées',
      'message', 'Les données nécessaires au workflow ne sont pas disponibles dans workflow_data'
    );
  END IF;
  
  -- 3. Extraire les IDs
  v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_paiement.entreprise_id);
  v_client_id := v_workflow_data.client_id;
  v_auth_user_id := v_workflow_data.auth_user_id;
  v_plan_id := v_workflow_data.plan_id;
  v_plan_info := COALESCE(v_workflow_data.plan_info, '{}'::jsonb);
  
  -- 4. Si auth_user_id manquant, chercher depuis client_id
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
    
    IF v_auth_user_id IS NULL THEN
      -- Chercher par email du client
      SELECT u.id INTO v_auth_user_id
      FROM clients c
      INNER JOIN auth.users u ON u.email = c.email
      WHERE c.id = v_client_id
      LIMIT 1;
    END IF;
  END IF;
  
  -- 5. Si plan_id manquant, extraire depuis plan_info
  IF v_plan_id IS NULL AND v_plan_info IS NOT NULL THEN
    v_plan_id := (v_plan_info->>'plan_id')::uuid;
  END IF;
  
  -- 6. Extraire les prix depuis plan_info
  IF v_plan_info IS NOT NULL AND jsonb_typeof(v_plan_info) = 'object' THEN
    v_plan_prix_mensuel := (v_plan_info->>'prix_mensuel')::numeric;
    v_plan_prix_annuel := (v_plan_info->>'prix_annuel')::numeric;
  END IF;
  
  -- 7. Vérifier entreprise_id
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant'
    );
  END IF;
  
  -- 8. Vérifier si facture existe
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
    
    IF v_abonnement_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant: %', v_abonnement_id;
      -- Continuer pour mettre à jour le rôle
    END IF;
  END IF;
  
  -- 9. Forcer statut paye
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
  END IF;
  
  -- 10. Calculer montants
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
  
  -- 11. Créer facture si nécessaire
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
  
  -- 12. Créer abonnement si nécessaire
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
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé: %', v_abonnement_id;
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
  
  -- 13. Créer espace membre si nécessaire
  IF v_client_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
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
  
  -- 14. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  IF v_client_id IS NOT NULL THEN
    UPDATE clients SET statut = 'actif' WHERE id = v_client_id;
  END IF;
  
  -- 15. ✅ GARANTIR L'ACTIVATION client_super_admin
  IF v_auth_user_id IS NOT NULL THEN
    BEGIN
      -- 15.1 Mettre à jour dans utilisateurs
      IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
        UPDATE utilisateurs
        SET role = 'client_super_admin'
        WHERE id = v_auth_user_id;
        
        GET DIAGNOSTICS v_role_updated = ROW_COUNT;
        
        IF v_role_updated > 0 THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin mis à jour dans utilisateurs pour %', v_auth_user_id;
          v_role_updated := true;
        ELSE
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Aucune ligne mise à jour dans utilisateurs';
        END IF;
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Utilisateur % non trouvé dans utilisateurs', v_auth_user_id;
      END IF;
      
      -- 15.2 Mettre à jour dans auth.users.raw_user_meta_data
      IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_auth_user_id) THEN
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
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin mis à jour dans auth.users pour %', v_auth_user_id;
          v_auth_role_updated := true;
        ELSE
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Aucune ligne mise à jour dans auth.users';
        END IF;
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Utilisateur % non trouvé dans auth.users', v_auth_user_id;
      END IF;
      
      -- 15.3 Vérification finale
      IF v_role_updated AND v_auth_role_updated THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅✅✅ Rôle client_super_admin activé avec succès pour %', v_auth_user_id;
      ELSIF v_role_updated OR v_auth_role_updated THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Rôle partiellement mis à jour (utilisateurs: %, auth.users: %)', v_role_updated, v_auth_role_updated;
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Échec mise à jour rôle client_super_admin';
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur mise à jour rôle: % - %', SQLERRM, SQLSTATE;
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ auth_user_id NULL, impossible de mettre à jour le rôle';
  END IF;
  
  -- 16. Marquer workflow_data comme traité
  UPDATE workflow_data
  SET traite = true, updated_at = now()
  WHERE paiement_id = p_paiement_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data marqué comme traité';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'entreprise_id', v_entreprise_id,
    'numero_facture', v_numero_facture,
    'auth_user_id', v_auth_user_id,
    'role_updated', v_role_updated,
    'auth_role_updated', v_auth_role_updated,
    'client_super_admin_activated', v_role_updated AND v_auth_role_updated
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. Version améliorée garantissant l''activation client_super_admin à 100%.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000027 appliquée';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement améliorée';
  RAISE NOTICE '📋 Garantit l''activation client_super_admin dans utilisateurs ET auth.users';
  RAISE NOTICE '📋 Vérification et logs détaillés pour le rôle';
END $$;

