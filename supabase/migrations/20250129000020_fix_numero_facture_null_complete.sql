/*
  # CORRECTION URGENTE : Génération du numero de facture
  
  Problème :
  - La fonction creer_facture_et_abonnement_apres_paiement insère une facture SANS numero
  - La colonne numero est NOT NULL dans la table factures
  - Erreur : "null value in column "numero" of relation "factures" violates non-null constraint"
  
  Solution :
  - Générer le numero AVANT l'INSERT
  - Forme : FAC-YYYYMMDD-XXXXXXXX (8 premiers caractères du paiement_id)
*/

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_plan_id uuid;
  v_plan RECORD;
  v_facture_id uuid;
  v_facture_existante uuid;
  v_numero_facture text;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_notes jsonb;
  v_client_email text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_info jsonb;
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
  
  -- 2. ✅ PROTECTION DOUBLONS : Vérifier si une facture existe déjà
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (doublon évité): %', v_facture_existante;
    v_facture_id := v_facture_existante;
    
    SELECT id INTO v_abonnement_id 
    FROM abonnements 
    WHERE facture_id = v_facture_id
    OR (entreprise_id = v_paiement.entreprise_id AND facture_id IS NULL)
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Facture déjà créée (doublon évité)',
      'facture_id', v_facture_id,
      'abonnement_id', v_abonnement_id,
      'already_exists', true,
      'entreprise_id', v_paiement.entreprise_id
    );
  END IF;
  
  -- 3. Forcer le statut à 'paye' si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Statut paiement mis à jour à "paye"';
  END IF;
  
  -- 4. Extraire les montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  -- 5. ✅ PRIORITÉ 1 : Récupérer entreprise_id depuis la colonne entreprise_id du paiement
  v_entreprise_id := v_paiement.entreprise_id;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Entreprise ID (depuis colonne paiement): %', v_entreprise_id;
  
  -- 6. ✅ PRIORITÉ 2 : Si NULL, parser les notes pour récupérer entreprise_id
  IF v_entreprise_id IS NULL THEN
    BEGIN
      v_notes := CASE 
        WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN (v_paiement.notes::text)::jsonb
        WHEN pg_typeof(v_paiement.notes) = 'text'::regtype THEN (v_paiement.notes::text)::jsonb
        ELSE v_paiement.notes::jsonb
      END;
      
      -- Extraire entreprise_id depuis notes
      IF (v_notes->>'entreprise_id') IS NOT NULL THEN
        v_entreprise_id := (v_notes->>'entreprise_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé dans notes: %', v_entreprise_id;
      END IF;
      
      v_client_id := COALESCE(v_client_id, (v_notes->>'client_id')::uuid);
      v_auth_user_id := COALESCE(v_auth_user_id, (v_notes->>'auth_user_id')::uuid);
      v_plan_id := COALESCE(v_plan_id, (v_notes->>'plan_id')::uuid);
      
      -- Extraire plan_id depuis plan_info si présent
      IF v_plan_id IS NULL AND v_notes->'plan_info' IS NOT NULL THEN
        v_plan_info := v_notes->'plan_info';
        IF v_plan_info->>'plan_id' IS NOT NULL THEN
          v_plan_id := (v_plan_info->>'plan_id')::uuid;
        END IF;
      END IF;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes parsées - Entreprise: %, Client: %, User: %, Plan: %', 
        v_entreprise_id, v_client_id, v_auth_user_id, v_plan_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
    END;
  ELSE
    -- Si entreprise_id existe déjà, parser quand même les notes pour les autres infos
    BEGIN
      v_notes := CASE 
        WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN (v_paiement.notes::text)::jsonb
        WHEN pg_typeof(v_paiement.notes) = 'text'::regtype THEN (v_paiement.notes::text)::jsonb
        ELSE v_paiement.notes::jsonb
      END;
      
      v_client_id := COALESCE(v_client_id, (v_notes->>'client_id')::uuid);
      v_auth_user_id := COALESCE(v_auth_user_id, (v_notes->>'auth_user_id')::uuid);
      v_plan_id := COALESCE(v_plan_id, (v_notes->>'plan_id')::uuid);
      
      -- Extraire plan_id depuis plan_info si présent
      IF v_plan_id IS NULL AND v_notes->'plan_info' IS NOT NULL THEN
        v_plan_info := v_notes->'plan_info';
        IF v_plan_info->>'plan_id' IS NOT NULL THEN
          v_plan_id := (v_plan_info->>'plan_id')::uuid;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  -- 7. ✅ PRIORITÉ 3 : Si toujours NULL, chercher via user_id du paiement
  IF v_entreprise_id IS NULL AND v_paiement.user_id IS NOT NULL THEN
    SELECT id INTO v_entreprise_id
    FROM entreprises
    WHERE user_id = v_paiement.user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_entreprise_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé via user_id: %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 8. Si entreprise_id toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant',
      'message', 'Paiement validé mais erreur lors de la création automatique',
      'paiement_id', p_paiement_id,
      'paiement_user_id', v_paiement.user_id,
      'paiement_entreprise_id', v_paiement.entreprise_id,
      'notes', v_paiement.notes
    );
  END IF;
  
  -- 9. Récupérer le plan si plan_id fourni
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
    IF NOT FOUND THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé', v_plan_id;
      v_plan_id := NULL;
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
    END IF;
  END IF;
  
  -- 10. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
    IF v_client_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client ID trouvé via entreprise: %', v_client_id;
    END IF;
  END IF;
  
  -- 11. Récupérer auth_user_id si nécessaire
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id 
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
    
    IF v_auth_user_id IS NULL THEN
      SELECT email INTO v_client_email FROM clients WHERE id = v_client_id;
      IF v_client_email IS NOT NULL THEN
        SELECT id INTO v_auth_user_id 
        FROM auth.users 
        WHERE email = v_client_email
        LIMIT 1;
      END IF;
    END IF;
    
    IF v_auth_user_id IS NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM entreprises
      WHERE id = v_entreprise_id;
    END IF;
  END IF;
  
  -- 12. ✅ CORRECTION CRITIQUE : Générer le numero de facture AVANT l'INSERT
  v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
  
  -- Éviter les doublons en bouclant jusqu'à trouver un numero unique
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
  END LOOP;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Numéro de facture généré: %', v_numero_facture;
  
  -- 13. Créer la facture avec le numero (CRITIQUE : ne pas oublier numero dans INSERT)
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
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  
  -- 14. Créer l'abonnement si plan_id fourni
  IF v_plan_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
    INSERT INTO abonnements (
      entreprise_id, client_id, plan_id, 
      date_debut, date_fin, statut, facture_id
    )
    VALUES (
      v_entreprise_id, v_auth_user_id, v_plan_id,
      CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif', v_facture_id
    )
    ON CONFLICT (entreprise_id, plan_id) DO UPDATE
    SET statut = 'actif', date_debut = CURRENT_DATE, date_fin = CURRENT_DATE + INTERVAL '1 month', facture_id = v_facture_id
    RETURNING id INTO v_abonnement_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé/mis à jour: %', v_abonnement_id;
  END IF;
  
  -- 15. Créer ou mettre à jour l'espace membre client
  IF v_client_id IS NOT NULL THEN
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
        jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        ),
        'actif', v_abonnement_id
      )
      RETURNING id INTO v_espace_membre_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
    ELSE
      UPDATE espaces_membres_clients
      SET actif = true,
          statut_compte = 'actif',
          user_id = COALESCE(v_auth_user_id, user_id),
          abonnement_id = COALESCE(v_abonnement_id, abonnement_id)
      WHERE id = v_espace_membre_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
    END IF;
  END IF;
  
  -- 16. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND v_client_id IS NOT NULL;
  
  -- 17. Mettre à jour le rôle du client dans la table utilisateurs
  IF v_auth_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE id = v_auth_user_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'entreprise_id', v_entreprise_id,
    'numero_facture', v_numero_facture
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. CORRIGÉE : génère le numero de facture AVANT l''INSERT pour éviter l''erreur NULL.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000020 appliquée';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement corrigée - Génération du numero de facture AVANT l''INSERT';
END $$;

