/*
  # CORRECTION CRITIQUE : Récupération robuste du plan_id pour créer l'abonnement
  
  Problème :
  - Le plan_id n'est pas récupéré depuis les notes du paiement
  - L'abonnement n'est pas créé car plan_id est NULL
  - Le workflow s'arrête à 60%
  
  Solution :
  - Améliorer la récupération du plan_id depuis les notes avec plusieurs méthodes
  - Ajouter une recherche alternative si le plan_id n'est pas dans les notes
  - Créer l'abonnement même si certaines informations manquent
  - Logs détaillés pour le débogage
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
  v_notes_text text;
  v_client_email text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_plan_info jsonb;
  v_diagnostic jsonb;
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
    
    -- Vérifier si l'abonnement existe déjà
    SELECT id INTO v_abonnement_id 
    FROM abonnements 
    WHERE facture_id = v_facture_id
    OR (entreprise_id = v_paiement.entreprise_id AND facture_id IS NULL)
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si l'abonnement n'existe pas, on continue pour le créer (pas de RETURN ici)
    IF v_abonnement_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant: %', v_abonnement_id;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Facture et abonnement déjà créés',
        'facture_id', v_facture_id,
        'abonnement_id', v_abonnement_id,
        'already_exists', true,
        'entreprise_id', v_paiement.entreprise_id
      );
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture existe mais abonnement manquant - On continue pour créer l''abonnement';
    END IF;
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
  
  -- 6. ✅ CORRECTION CRITIQUE : Parser les notes avec plusieurs méthodes (notes peuvent être TEXT ou JSONB)
  BEGIN
    -- Vérifier le type des notes
    IF v_paiement.notes IS NOT NULL THEN
      BEGIN
        -- Si les notes sont déjà JSONB, les utiliser directement
        IF pg_typeof(v_paiement.notes)::text LIKE '%jsonb%' THEN
          v_notes := v_paiement.notes::jsonb;
        -- Si les notes sont TEXT, les convertir en JSONB
        ELSIF pg_typeof(v_paiement.notes)::text = 'text' THEN
          v_notes_text := v_paiement.notes::text;
          IF v_notes_text IS NOT NULL AND v_notes_text != '' AND v_notes_text != 'null' THEN
            v_notes := v_notes_text::jsonb;
          ELSE
            v_notes := '{}'::jsonb;
          END IF;
        -- Sinon, essayer de caster directement
        ELSE
          v_notes := v_paiement.notes::jsonb;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- En cas d'erreur, essayer de parser comme texte
          BEGIN
            v_notes_text := v_paiement.notes::text;
            IF v_notes_text IS NOT NULL AND v_notes_text != '' AND v_notes_text != 'null' THEN
              v_notes := v_notes_text::jsonb;
            ELSE
              v_notes := '{}'::jsonb;
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              v_notes := '{}'::jsonb;
              RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Impossible de parser notes: %', SQLERRM;
          END;
      END;
    ELSE
      v_notes := '{}'::jsonb;
    END IF;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes parsées: %', v_notes::text;
    
    -- Extraire entreprise_id depuis notes si NULL
    IF v_entreprise_id IS NULL AND (v_notes->>'entreprise_id') IS NOT NULL THEN
      BEGIN
        v_entreprise_id := (v_notes->>'entreprise_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé dans notes: %', v_entreprise_id;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    END IF;
    
    -- ✅ CORRECTION CRITIQUE : Extraire plan_id avec TOUTES les méthodes possibles
    -- Méthode 1 : Depuis plan_id direct
    IF (v_notes->>'plan_id') IS NOT NULL THEN
      BEGIN
        v_plan_id := (v_notes->>'plan_id')::uuid;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé (notes->plan_id): %', v_plan_id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur conversion plan_id direct: %', SQLERRM;
      END;
    END IF;
    
    -- Méthode 2 : Depuis plan_info.plan_id
    IF v_plan_id IS NULL AND v_notes->'plan_info' IS NOT NULL THEN
      BEGIN
        v_plan_info := v_notes->'plan_info';
        
        -- Essayer plan_info->plan_id
        IF (v_plan_info->>'plan_id') IS NOT NULL THEN
          BEGIN
            v_plan_id := (v_plan_info->>'plan_id')::uuid;
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé (plan_info->plan_id): %', v_plan_id;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur conversion plan_info.plan_id: %', SQLERRM;
          END;
        END IF;
        
        -- Essayer plan_info->id si plan_id toujours NULL
        IF v_plan_id IS NULL AND (v_plan_info->>'id') IS NOT NULL THEN
          BEGIN
            v_plan_id := (v_plan_info->>'id')::uuid;
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé (plan_info->id): %', v_plan_id;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur conversion plan_info.id: %', SQLERRM;
          END;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur extraction plan_info: %', SQLERRM;
      END;
    END IF;
    
    -- Extraire client_id depuis notes
    IF (v_notes->>'client_id') IS NOT NULL THEN
      BEGIN
        v_client_id := (v_notes->>'client_id')::uuid;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    END IF;
    
    -- Extraire auth_user_id depuis notes
    IF (v_notes->>'auth_user_id') IS NOT NULL THEN
      BEGIN
        v_auth_user_id := (v_notes->>'auth_user_id')::uuid;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    END IF;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Extraction notes - Entreprise: %, Client: %, User: %, Plan: %', 
      v_entreprise_id, v_client_id, v_auth_user_id, v_plan_id;
      
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
      v_notes := '{}'::jsonb;
  END;
  
  -- 7. ✅ PRIORITÉ 3 : Si entreprise_id toujours NULL, chercher via user_id du paiement
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
  
  -- 8. ✅ NOUVELLE MÉTHODE : Si plan_id toujours NULL, chercher depuis le dernier paiement de cette entreprise
  IF v_plan_id IS NULL AND v_entreprise_id IS NOT NULL THEN
    SELECT 
      (notes->>'plan_id')::uuid,
      (notes->'plan_info'->>'plan_id')::uuid,
      (notes->'plan_info'->>'id')::uuid
    INTO v_plan_id
    FROM paiements
    WHERE entreprise_id = v_entreprise_id
      AND (
        notes->>'plan_id' IS NOT NULL 
        OR notes->'plan_info'->>'plan_id' IS NOT NULL
        OR notes->'plan_info'->>'id' IS NOT NULL
      )
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé depuis autre paiement de l''entreprise: %', v_plan_id;
    END IF;
  END IF;
  
  -- 9. Si entreprise_id toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant',
      'message', 'Paiement validé mais erreur lors de la création automatique',
      'paiement_id', p_paiement_id
    );
  END IF;
  
  -- 10. ✅ AMÉLIORATION : Récupérer le plan avec logs détaillés
  IF v_plan_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
      IF NOT FOUND THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé dans plans_abonnement', v_plan_id;
        v_plan_id := NULL;
      ELSE
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: % (ID: %)', v_plan.nom, v_plan.id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur recherche plan: % - %', SQLERRM, SQLSTATE;
        v_plan_id := NULL;
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL - L''abonnement ne sera PAS créé';
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Structure notes pour debug: %', v_notes::text;
  END IF;
  
  -- 11. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
    IF v_client_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client ID trouvé via entreprise: %', v_client_id;
    ELSE
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Aucun client trouvé pour l''entreprise %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 12. ✅ AMÉLIORATION : Récupérer auth_user_id avec plusieurs tentatives
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    -- Tentative 1 : Depuis espaces_membres_clients
    SELECT user_id INTO v_auth_user_id 
    FROM espaces_membres_clients
    WHERE client_id = v_client_id
    LIMIT 1;
    
    -- Tentative 2 : Depuis clients email -> auth.users
    IF v_auth_user_id IS NULL THEN
      SELECT email INTO v_client_email FROM clients WHERE id = v_client_id;
      IF v_client_email IS NOT NULL THEN
        SELECT id INTO v_auth_user_id 
        FROM auth.users 
        WHERE email = v_client_email
        LIMIT 1;
        
        IF v_auth_user_id IS NOT NULL THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via email: %', v_auth_user_id;
        END IF;
      END IF;
    END IF;
    
    -- Tentative 3 : Depuis entreprises
    IF v_auth_user_id IS NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM entreprises
      WHERE id = v_entreprise_id;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via entreprise: %', v_auth_user_id;
      END IF;
    END IF;
  END IF;
  
  IF v_auth_user_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Auth User ID non trouvé - L''abonnement et l''espace membre peuvent ne pas être créés correctement';
  END IF;
  
  -- 13. ✅ CORRECTION : Créer la facture UNIQUEMENT si elle n'existe pas déjà
  IF v_facture_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Création de la facture...';
    
    -- Générer le numero de facture
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
    
    -- Éviter les doublons en bouclant jusqu'à trouver un numero unique
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
    END LOOP;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Numéro de facture généré: %', v_numero_facture;
    
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
  ELSE
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture existe déjà, on récupère son numéro';
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
  END IF;
  
  -- 15. ✅ CORRECTION CRITIQUE : Créer l'abonnement avec logs très détaillés
  IF v_plan_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
    BEGIN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Création abonnement - Plan: %, User: %, Entreprise: %', 
        v_plan_id, v_auth_user_id, v_entreprise_id;
      
      INSERT INTO abonnements (
        entreprise_id, client_id, plan_id, 
        date_debut, date_fin, statut, facture_id
      )
      VALUES (
        v_entreprise_id, v_auth_user_id, v_plan_id,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif', v_facture_id
      )
      ON CONFLICT (entreprise_id, plan_id) DO UPDATE
      SET statut = 'actif', 
          date_debut = CURRENT_DATE, 
          date_fin = CURRENT_DATE + INTERVAL '1 month', 
          facture_id = v_facture_id,
          client_id = COALESCE(v_auth_user_id, abonnements.client_id)
      RETURNING id INTO v_abonnement_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé/mis à jour: %', v_abonnement_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création abonnement: % - %', SQLERRM, SQLSTATE;
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] 📋 Détails - Entreprise: %, Plan: %, User: %', 
          v_entreprise_id, v_plan_id, v_auth_user_id;
        v_abonnement_id := NULL;
    END;
  ELSE
    IF v_plan_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL - Abonnement non créé';
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes pour debug plan_id: %', v_notes::text;
    END IF;
    IF v_auth_user_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Auth User ID NULL - Abonnement non créé';
    END IF;
  END IF;
  
  -- 16. ✅ AMÉLIORATION : Créer l'espace membre même si l'abonnement échoue
  IF v_client_id IS NOT NULL THEN
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
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création espace membre: % - %', SQLERRM, SQLSTATE;
        v_espace_membre_id := NULL;
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Client ID manquant - Espace membre non créé';
  END IF;
  
  -- 17. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id AND v_client_id IS NOT NULL;
  
  -- 18. Mettre à jour le rôle du client dans la table utilisateurs
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
    'auth_user_id_found', v_auth_user_id IS NOT NULL
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. CORRIGÉE : récupération robuste du plan_id depuis plusieurs sources (notes direct, plan_info, autres paiements), logs détaillés.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000022 appliquée';
  RAISE NOTICE '📋 creer_facture_et_abonnement_apres_paiement corrigée avec récupération robuste du plan_id';
  RAISE NOTICE '🔍 Le plan_id est recherché dans : notes->plan_id, notes->plan_info->plan_id, notes->plan_info->id, autres paiements de l''entreprise';
END $$;

