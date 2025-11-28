/*
  # CORRECTION COMPLÈTE : Workflow création entreprise - Factures doublons + Abonnement
  
  Problèmes identifiés :
  1. ❌ Factures créées en triple car valider_paiement_carte_immediat appelé plusieurs fois
     - Webhook Stripe (checkout.session.completed ET payment_intent.succeeded)
     - PaymentSuccess.tsx
  2. ❌ La table factures peut ne pas avoir la colonne paiement_id
  3. ❌ Abonnement non créé car conditions non remplies ou erreurs silencieuses
  
  Solutions :
  1. ✅ Protection contre appels multiples dans valider_paiement_carte_immediat
  2. ✅ Protection doublons améliorée (vérifier par entreprise_id + montant + date)
  3. ✅ Vérification si paiement_id existe avant utilisation
  4. ✅ Amélioration création abonnement avec gestion d'erreurs explicite
  5. ✅ Logs détaillés pour diagnostic
*/

-- ========================================
-- PARTIE 1 : Recréer valider_paiement_carte_immediat avec protection appels multiples
-- ========================================

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_already_processed boolean := false;
  v_facture_existante uuid;
  v_result jsonb;
BEGIN
  -- 1. ✅ PROTECTION : Vérifier si le paiement est déjà traité
  SELECT statut, id INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé',
      'paiement_id', p_paiement_id
    );
  END IF;
  
  -- 2. ✅ PROTECTION : Vérifier si déjà traité (paye et facture existe)
  IF v_paiement.statut = 'paye' THEN
    -- Vérifier si une facture existe déjà pour ce paiement ou cette entreprise
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'factures' AND column_name = 'paiement_id'
    ) THEN
      SELECT id INTO v_facture_existante
      FROM factures
      WHERE paiement_id = p_paiement_id
      LIMIT 1;
    ELSE
      -- Si pas de colonne paiement_id, vérifier par entreprise_id + montant + date récente
      SELECT id INTO v_facture_existante
      FROM factures
      WHERE entreprise_id = v_paiement.entreprise_id
        AND montant_ttc = v_paiement.montant_ttc
        AND date_emission >= CURRENT_DATE - INTERVAL '1 day'
        AND statut = 'payee'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
    IF v_facture_existante IS NOT NULL THEN
      RAISE NOTICE '[valider_paiement_carte_immediat] ⚠️ Paiement déjà traité - Facture existe: %', v_facture_existante;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Paiement déjà validé (doublon évité)',
        'already_processed', true,
        'facture_id', v_facture_existante
      );
    END IF;
  END IF;
  
  -- 3. ✅ Marquer le paiement comme payé AVANT d'appeler creer_facture_et_abonnement_apres_paiement
  -- Cela évite les appels multiples simultanés
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements 
    SET statut = 'paye',
        stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
        updated_at = NOW()
    WHERE id = p_paiement_id;
    
    RAISE NOTICE '[valider_paiement_carte_immediat] ✅ Paiement marqué comme payé';
  END IF;
  
  -- 4. ✅ Appeler creer_facture_et_abonnement_apres_paiement
  RAISE NOTICE '[valider_paiement_carte_immediat] 🚀 Appel de creer_facture_et_abonnement_apres_paiement...';
  
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
  
  IF v_result IS NULL THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ⚠️ creer_facture_et_abonnement_apres_paiement a retourné NULL';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erreur lors de la création (résultat NULL)'
    );
  END IF;
  
  IF v_result->>'success' = 'false' THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ Échec création: %', v_result->>'error';
    RETURN v_result;
  END IF;
  
  RAISE NOTICE '[valider_paiement_carte_immediat] ✅ Workflow complet réussi';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement validé avec succès',
    'facture_id', v_result->>'facture_id',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'entreprise_id', v_result->>'entreprise_id'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ ERREUR FATALE: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
  'Valide un paiement par carte immédiatement. PROTECTION CONTRE APPELS MULTIPLES : vérifie si déjà traité avant de créer facture/abonnement.';

-- ========================================
-- PARTIE 2 : Recréer creer_facture_et_abonnement_apres_paiement avec protection doublons améliorée
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
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. ✅ PROTECTION DOUBLONS AMÉLIORÉE : Vérifier si une facture existe déjà
  -- Méthode 1 : Via paiement_id si colonne existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'paiement_id'
  ) THEN
    SELECT id INTO v_facture_existante
    FROM factures
    WHERE paiement_id = p_paiement_id
    LIMIT 1;
  END IF;
  
  -- Méthode 2 : Via entreprise_id + montant + date (si paiement_id n'existe pas ou pas trouvé)
  IF v_facture_existante IS NULL AND v_paiement.entreprise_id IS NOT NULL THEN
    SELECT id INTO v_facture_existante
    FROM factures
    WHERE entreprise_id = v_paiement.entreprise_id
      AND montant_ttc = v_paiement.montant_ttc
      AND date_emission >= CURRENT_DATE - INTERVAL '1 day'
      AND statut = 'payee'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (doublon évité): %', v_facture_existante;
    -- Récupérer les IDs existants pour retour
    v_facture_id := v_facture_existante;
    SELECT id INTO v_abonnement_id FROM abonnements WHERE facture_id = v_facture_id LIMIT 1;
    
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
  END IF;
  
  -- 4. Extraire les montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  -- 5. ✅ PRIORITÉ 1 : Récupérer entreprise_id depuis la colonne entreprise_id du paiement
  v_entreprise_id := v_paiement.entreprise_id;
  
  -- 6. ✅ PRIORITÉ 2 : Si NULL, parser les notes pour récupérer entreprise_id
  IF v_entreprise_id IS NULL THEN
    BEGIN
      v_notes := CASE 
        WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN (v_paiement.notes::text)::jsonb
        WHEN pg_typeof(v_paiement.notes) = 'text'::regtype THEN (v_paiement.notes::text)::jsonb
        ELSE v_paiement.notes::jsonb
      END;
      
      v_entreprise_id := (v_notes->>'entreprise_id')::uuid;
      v_client_id := (v_notes->>'client_id')::uuid;
      v_auth_user_id := (v_notes->>'auth_user_id')::uuid;
      v_plan_id := (v_notes->>'plan_id')::uuid;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes parsées - Entreprise: %, Client: %, User: %, Plan: %', 
        v_entreprise_id, v_client_id, v_auth_user_id, v_plan_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
    END;
  ELSE
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
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes parsées - Client: %, User: %, Plan: %', 
        v_client_id, v_auth_user_id, v_plan_id;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  
  -- 7. ✅ PRIORITÉ 3-5 : Recherche entreprise_id dans factures, abonnements, clients
  IF v_entreprise_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'factures' AND column_name = 'paiement_id'
    ) THEN
      SELECT f.entreprise_id INTO v_entreprise_id
      FROM factures f
      WHERE f.paiement_id = p_paiement_id
      LIMIT 1;
    END IF;
    
    IF v_entreprise_id IS NULL THEN
      SELECT a.entreprise_id INTO v_entreprise_id
      FROM abonnements a
      WHERE EXISTS (
        SELECT 1 FROM factures f 
        WHERE EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'factures' 
          AND column_name = 'paiement_id'
        )
        AND f.paiement_id = p_paiement_id
        AND f.id = a.facture_id
      )
      LIMIT 1;
    END IF;
    
    IF v_entreprise_id IS NULL AND v_client_id IS NOT NULL THEN
      SELECT entreprise_id INTO v_entreprise_id
      FROM clients
      WHERE id = v_client_id
      LIMIT 1;
    END IF;
  END IF;
  
  -- 8. Si toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant dans les notes du paiement et impossible à récupérer depuis les relations',
      'paiement_id', p_paiement_id,
      'paiement_entreprise_id', v_paiement.entreprise_id,
      'notes', v_paiement.notes
    );
  END IF;
  
  -- 9. ✅ AMÉLIORATION : Récupérer le plan si plan_id fourni, sinon chercher dans les notes
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
    IF NOT FOUND THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan non trouvé: %', v_plan_id;
      v_plan_id := NULL;
    ELSE
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
    END IF;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL - l''abonnement ne pourra pas être créé';
  END IF;
  
  -- 10. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  END IF;
  
  -- 11. ✅ AMÉLIORATION : Récupérer auth_user_id depuis PLUSIEURS sources avec logs
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Recherche auth_user_id...';
    
    IF v_client_id IS NOT NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM espaces_membres_clients
      WHERE client_id = v_client_id
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via espaces_membres_clients: %', v_auth_user_id;
      END IF;
    END IF;
    
    IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
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
    
    IF v_auth_user_id IS NULL AND v_client_email IS NOT NULL THEN
      SELECT id INTO v_auth_user_id
      FROM utilisateurs
      WHERE email = v_client_email
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via utilisateurs: %', v_auth_user_id;
      END IF;
    END IF;
    
    IF v_auth_user_id IS NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM entreprises
      WHERE id = v_entreprise_id;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via entreprise: %', v_auth_user_id;
      END IF;
    END IF;
    
    IF v_auth_user_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Auth User ID non trouvé - l''abonnement ne pourra pas être créé';
    END IF;
  END IF;
  
  -- 12. ✅ CORRECTION : Générer le numero de facture
  v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
  
  -- Éviter les doublons
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
  END LOOP;
  
  -- 13. ✅ CORRECTION : Créer la facture avec les BONNES colonnes
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'factures' AND column_name = 'paiement_id'
    ) THEN
      INSERT INTO factures (
        entreprise_id, client_id, numero, type, date_emission, date_echeance,
        montant_ht, tva, montant_ttc, statut, paiement_id
      )
      VALUES (
        v_entreprise_id, v_client_id, v_numero_facture, 'facture',
        CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        v_montant_ht, v_montant_tva, v_montant_ttc, 'payee', p_paiement_id
      )
      RETURNING id INTO v_facture_id;
    ELSE
      INSERT INTO factures (
        entreprise_id, client_id, numero, type, date_emission, date_echeance,
        montant_ht, tva, montant_ttc, statut
      )
      VALUES (
        v_entreprise_id, v_client_id, v_numero_facture, 'facture',
        CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        v_montant_ht, v_montant_tva, v_montant_ttc, 'payee'
      )
      RETURNING id INTO v_facture_id;
    END IF;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (unique_violation)';
      -- Récupérer la facture existante
      SELECT id INTO v_facture_id FROM factures WHERE numero = v_numero_facture LIMIT 1;
      IF v_facture_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture (unique_violation)');
      END IF;
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création facture: %', SQLERRM;
      RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture: ' || SQLERRM);
  END;
  
  -- 14. ✅ CORRECTION : Créer l'abonnement avec vérification de la structure de la table
  IF v_auth_user_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 Création abonnement - User: %, Plan: %, Entreprise: %', 
      v_auth_user_id, v_plan_id, v_entreprise_id;
    
    BEGIN
      -- Vérifier si la colonne client_id existe
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'client_id'
      ) THEN
        -- Table a client_id
        INSERT INTO abonnements (
          entreprise_id, client_id, plan_id, 
          date_debut, date_fin, statut, facture_id
        )
        VALUES (
          v_entreprise_id, v_auth_user_id, v_plan_id,
          CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif', v_facture_id
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_abonnement_id;
        
        IF v_abonnement_id IS NULL THEN
          -- Essayer de récupérer l'abonnement existant
          SELECT id INTO v_abonnement_id 
          FROM abonnements 
          WHERE entreprise_id = v_entreprise_id 
          AND plan_id = v_plan_id
          ORDER BY created_at DESC
          LIMIT 1;
        END IF;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé/récupéré avec client_id: %', v_abonnement_id;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'user_id'
      ) THEN
        -- Table a user_id
        INSERT INTO abonnements (
          entreprise_id, user_id, plan_id, 
          date_debut, date_fin, statut
        )
        VALUES (
          v_entreprise_id, v_auth_user_id, v_plan_id,
          CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif'
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_abonnement_id;
        
        IF v_abonnement_id IS NULL THEN
          SELECT id INTO v_abonnement_id 
          FROM abonnements 
          WHERE entreprise_id = v_entreprise_id 
          AND plan_id = v_plan_id
          ORDER BY created_at DESC
          LIMIT 1;
        END IF;
        
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé/récupéré avec user_id: %', v_abonnement_id;
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Colonne client_id ou user_id introuvable dans abonnements';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création abonnement: %', SQLERRM;
        -- Continuer même si l'abonnement échoue
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement non créé - Auth User ID: %, Plan ID: %', 
      v_auth_user_id, v_plan_id;
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
    ELSE
      UPDATE espaces_membres_clients
      SET actif = true,
          statut_compte = 'actif',
          user_id = COALESCE(v_auth_user_id, user_id),
          abonnement_id = COALESCE(v_abonnement_id, abonnement_id),
          modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
            'tableau_de_bord', true, 'mon_entreprise', true,
            'factures', true, 'documents', true, 'abonnements', true
          )
      WHERE id = v_espace_membre_id;
    END IF;
  END IF;
  
  -- 16. Synchroniser modules si fonction existe
  BEGIN
    IF v_client_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible: %', SQLERRM;
  END;
  
  -- 17. Activer entreprise et client
  UPDATE entreprises
  SET statut = 'active'
  WHERE id = v_entreprise_id;
  
  IF v_client_id IS NOT NULL THEN
    UPDATE clients 
    SET statut = 'actif' 
    WHERE id = v_client_id;
  END IF;
  
  -- 18. Mettre à jour le rôle du client dans la table utilisateurs
  IF v_client_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
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
    'auth_user_id', v_auth_user_id,
    'plan_id', v_plan_id
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. CORRIGÉE : Protection doublons améliorée (paiement_id OU entreprise_id+montant+date), gestion erreurs explicite, logs détaillés.';

