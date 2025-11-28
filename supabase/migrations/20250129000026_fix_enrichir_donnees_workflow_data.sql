/*
  # CORRECTION : Enrichir la récupération des données depuis workflow_data
  
  Problème :
  - On ne récupère que les IDs depuis workflow_data
  - On n'utilise pas plan_info qui contient toutes les informations du plan
  - Certains IDs peuvent être NULL mais plan_info contient les infos nécessaires
  
  Solution :
  - Extraire toutes les informations depuis plan_info (jsonb)
  - Utiliser les montants depuis plan_info si disponibles
  - Vérifier et récupérer les IDs manquants depuis d'autres sources
  - Utiliser les informations enrichies pour créer l'abonnement
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
  
  -- 2. ✅ ENRICHIR : Récupérer TOUTES les données depuis workflow_data
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
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data trouvé';
  RAISE NOTICE '  - Entreprise: %, Client: %, Auth User: %, Plan: %', 
    v_workflow_data.entreprise_id, v_workflow_data.client_id, 
    v_workflow_data.auth_user_id, v_workflow_data.plan_id;
  RAISE NOTICE '  - Plan Info: %', v_workflow_data.plan_info;
  
  -- 3. ✅ ENRICHIR : Extraire les IDs depuis workflow_data avec fallbacks
  v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_paiement.entreprise_id);
  v_client_id := v_workflow_data.client_id;
  v_auth_user_id := v_workflow_data.auth_user_id;
  v_plan_id := v_workflow_data.plan_id;
  v_plan_info := COALESCE(v_workflow_data.plan_info, '{}'::jsonb);
  
  -- 4. ✅ ENRICHIR : Si auth_user_id manquant, chercher depuis client_id
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
    
    IF v_auth_user_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID récupéré depuis espaces_membres_clients: %', v_auth_user_id;
    END IF;
  END IF;
  
  -- 5. ✅ ENRICHIR : Si plan_id manquant mais présent dans plan_info
  IF v_plan_id IS NULL AND v_plan_info IS NOT NULL THEN
    v_plan_id := (v_plan_info->>'plan_id')::uuid;
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID récupéré depuis plan_info: %', v_plan_id;
    END IF;
  END IF;
  
  -- 6. ✅ ENRICHIR : Extraire les prix depuis plan_info
  IF v_plan_info IS NOT NULL AND jsonb_typeof(v_plan_info) = 'object' THEN
    v_plan_prix_mensuel := (v_plan_info->>'prix_mensuel')::numeric;
    v_plan_prix_annuel := (v_plan_info->>'prix_annuel')::numeric;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 💰 Prix depuis plan_info - Mensuel: %, Annuel: %', 
      v_plan_prix_mensuel, v_plan_prix_annuel;
  END IF;
  
  -- 7. Si entreprise_id toujours NULL, essayer de le trouver depuis le paiement
  IF v_entreprise_id IS NULL THEN
    SELECT entreprise_id INTO v_entreprise_id
    FROM paiements
    WHERE id = p_paiement_id;
    
    IF v_entreprise_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'ID d''entreprise manquant',
        'message', 'Paiement validé mais erreur lors de la création automatique'
      );
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID récupéré depuis paiement: %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 8. Vérifier si une facture existe déjà
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante: %', v_facture_existante;
    v_facture_id := v_facture_existante;
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
    
    -- Vérifier si l'abonnement existe déjà
    SELECT id INTO v_abonnement_id 
    FROM abonnements 
    WHERE facture_id = v_facture_id
       OR (entreprise_id = v_entreprise_id AND plan_id = v_plan_id AND v_plan_id IS NOT NULL)
    LIMIT 1;
    
    -- Si abonnement existe, retourner
    IF v_abonnement_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant: %', v_abonnement_id;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Facture et abonnement déjà créés',
        'facture_id', v_facture_id,
        'abonnement_id', v_abonnement_id,
        'already_exists', true,
        'entreprise_id', v_entreprise_id
      );
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture existe mais abonnement manquant - On continue';
    END IF;
  END IF;
  
  -- 9. Forcer le statut à 'paye' si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Statut paiement mis à jour à "paye"';
  END IF;
  
  -- 10. ✅ ENRICHIR : Extraire les montants avec priorités
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  -- Calculer montant_mensuel avec priorité : paiement > plan_info > plan
  v_montant_mensuel := v_montant_ttc;
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    IF v_plan_prix_mensuel IS NOT NULL AND v_plan_prix_mensuel > 0 THEN
      v_montant_mensuel := v_plan_prix_mensuel;
    ELSIF v_plan_prix_annuel IS NOT NULL AND v_plan_prix_annuel > 0 THEN
      v_montant_mensuel := v_plan_prix_annuel / 12;
    END IF;
  END IF;
  
  -- Déterminer mode_paiement
  IF v_plan_prix_annuel IS NOT NULL AND v_plan_prix_annuel > 0 AND v_montant_ttc >= v_plan_prix_annuel THEN
    v_mode_paiement := 'annuel';
  ELSE
    v_mode_paiement := 'mensuel';
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 💰 Montants - HT: %, TVA: %, TTC: %, Mensuel: %, Mode: %', 
    v_montant_ht, v_montant_tva, v_montant_ttc, v_montant_mensuel, v_mode_paiement;
  
  -- 11. Créer la facture si elle n'existe pas
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
    RETURNING id, numero INTO v_facture_id, v_numero_facture;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  END IF;
  
  -- 12. ✅ ENRICHIR : Récupérer le plan depuis la base OU utiliser plan_info
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
    IF NOT FOUND THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé dans la base, utilisation de plan_info', v_plan_id;
      -- Utiliser plan_info comme fallback
      IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
        v_montant_mensuel := COALESCE(v_plan_prix_mensuel, 0);
        IF v_montant_mensuel = 0 AND v_plan_prix_annuel IS NOT NULL AND v_plan_prix_annuel > 0 THEN
          v_montant_mensuel := v_plan_prix_annuel / 12;
        END IF;
      END IF;
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
      IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
        v_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
        IF v_montant_mensuel = 0 AND v_plan.prix_annuel IS NOT NULL AND v_plan.prix_annuel > 0 THEN
          v_montant_mensuel := v_plan.prix_annuel / 12;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- 13. ✅ CRÉER L'ABONNEMENT avec toutes les informations enrichies
  IF v_plan_id IS NOT NULL AND v_entreprise_id IS NOT NULL AND v_montant_mensuel > 0 THEN
    BEGIN
      -- Si auth_user_id manquant, on peut quand même créer l'abonnement
      IF v_auth_user_id IS NULL THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Auth User ID NULL, création abonnement sans client_id';
      END IF;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Création abonnement - Plan: %, User: %, Entreprise: %, Montant: %, Mode: %', 
        v_plan_id, v_auth_user_id, v_entreprise_id, v_montant_mensuel, v_mode_paiement;
      
      INSERT INTO abonnements (
        entreprise_id, 
        client_id, 
        plan_id, 
        date_debut, 
        date_fin, 
        statut, 
        facture_id,
        montant_mensuel,
        mode_paiement,
        date_prochain_paiement
      )
      VALUES (
        v_entreprise_id, 
        v_auth_user_id, -- Peut être NULL
        v_plan_id,
        CURRENT_DATE, 
        CASE 
          WHEN v_mode_paiement = 'annuel' THEN CURRENT_DATE + INTERVAL '1 year'
          ELSE CURRENT_DATE + INTERVAL '1 month'
        END, 
        'actif', 
        v_facture_id,
        v_montant_mensuel,
        v_mode_paiement,
        CASE 
          WHEN v_mode_paiement = 'annuel' THEN CURRENT_DATE + INTERVAL '1 year'
          ELSE CURRENT_DATE + INTERVAL '1 month'
        END
      )
      RETURNING id INTO v_abonnement_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé: %', v_abonnement_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Abonnement existe déjà, récupérer son ID
        SELECT id INTO v_abonnement_id
        FROM abonnements
        WHERE entreprise_id = v_entreprise_id 
          AND plan_id = v_plan_id
        LIMIT 1;
        
        -- Mettre à jour avec les nouvelles infos
        UPDATE abonnements
        SET statut = 'actif',
            facture_id = v_facture_id,
            montant_mensuel = COALESCE(v_montant_mensuel, abonnements.montant_mensuel),
            client_id = COALESCE(v_auth_user_id, abonnements.client_id),
            mode_paiement = COALESCE(v_mode_paiement, abonnements.mode_paiement),
            date_debut = CURRENT_DATE,
            date_fin = CASE 
              WHEN COALESCE(v_mode_paiement, abonnements.mode_paiement) = 'annuel' 
              THEN CURRENT_DATE + INTERVAL '1 year'
              ELSE CURRENT_DATE + INTERVAL '1 month'
            END
        WHERE id = v_abonnement_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement existant mis à jour: %', v_abonnement_id;
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création abonnement: % - %', SQLERRM, SQLSTATE;
        v_abonnement_id := NULL;
    END;
  ELSE
    IF v_plan_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL';
    END IF;
    IF v_entreprise_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Entreprise ID NULL';
    END IF;
    IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Montant mensuel NULL ou 0';
    END IF;
  END IF;
  
  -- 14. Créer l'espace membre
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
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
      ELSE
        UPDATE espaces_membres_clients
        SET actif = true,
            statut_compte = 'actif',
            user_id = COALESCE(v_auth_user_id, user_id),
            abonnement_id = COALESCE(v_abonnement_id, abonnement_id),
            modules_actifs = COALESCE(v_plan_info->'fonctionnalites', modules_actifs)
        WHERE id = v_espace_membre_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création espace membre: %', SQLERRM;
        v_espace_membre_id := NULL;
    END;
  END IF;
  
  -- 15. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  IF v_client_id IS NOT NULL THEN
    UPDATE clients SET statut = 'actif' WHERE id = v_client_id;
  END IF;
  
  -- 16. Mettre à jour le rôle du client
  IF v_auth_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
        UPDATE utilisateurs
        SET role = 'client_super_admin'
        WHERE id = v_auth_user_id;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Rôle client_super_admin mis à jour';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur mise à jour rôle: %', SQLERRM;
    END;
  END IF;
  
  -- 17. Marquer workflow_data comme traité
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
    'plan_id', v_plan_id,
    'plan_id_found', v_plan_id IS NOT NULL,
    'auth_user_id', v_auth_user_id,
    'auth_user_id_found', v_auth_user_id IS NOT NULL,
    'montant_mensuel', v_montant_mensuel,
    'mode_paiement', v_mode_paiement,
    'plan_info_used', v_plan_info IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'message', 'Paiement validé mais erreur lors de la création automatique'
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. Version enrichie utilisant toutes les informations de workflow_data et plan_info.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000026 appliquée';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement enrichie avec toutes les données';
  RAISE NOTICE '📋 Utilise plan_info pour extraire prix et autres infos';
  RAISE NOTICE '📋 Récupère les IDs manquants depuis différentes sources';
END $$;

