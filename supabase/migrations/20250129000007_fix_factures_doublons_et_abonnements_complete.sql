/*
  # CORRECTION : Factures en triple + Abonnement non créé
  
  Problèmes :
  1. Factures créées en triple car la fonction est appelée plusieurs fois (webhook + PaymentSuccess)
  2. Abonnement ne se crée pas car v_auth_user_id ou v_plan_id peuvent être NULL
  3. Pas de protection contre les doublons de factures
  
  Solutions :
  1. Vérifier si une facture existe déjà pour ce paiement avant d'en créer une
  2. Ajouter des logs détaillés pour comprendre pourquoi l'abonnement ne se crée pas
  3. Vérifier la structure réelle de la table abonnements (user_id vs client_id)
  4. Améliorer la récupération de v_auth_user_id et v_plan_id
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
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. ✅ PROTECTION DOUBLONS : Vérifier si une facture existe déjà pour ce paiement
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'paiement_id'
  ) THEN
    SELECT id INTO v_facture_existante
    FROM factures
    WHERE paiement_id = p_paiement_id
    LIMIT 1;
    
    IF v_facture_existante IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante pour ce paiement: %', v_facture_existante;
      -- Récupérer les IDs existants pour retour
      SELECT id INTO v_facture_id FROM factures WHERE id = v_facture_existante;
      SELECT id INTO v_abonnement_id FROM abonnements WHERE facture_id = v_facture_id LIMIT 1;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Facture déjà créée (doublon évité)',
        'facture_id', v_facture_id,
        'abonnement_id', v_abonnement_id,
        'already_exists', true
      );
    END IF;
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
  
  -- 7. ✅ PRIORITÉ 3-5 : Recherche entreprise_id dans factures, abonnements, clients (comme avant)
  IF v_entreprise_id IS NULL THEN
    -- Chercher via factures liées
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'factures' AND column_name = 'paiement_id'
    ) THEN
      SELECT f.entreprise_id INTO v_entreprise_id
      FROM factures f
      WHERE f.paiement_id = p_paiement_id
      LIMIT 1;
    END IF;
    
    -- Chercher via abonnements liés
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
    
    -- Chercher via clients
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
    -- Essayer de trouver le plan_id dans les factures ou abonnements existants
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
  END IF;
  
  -- 10. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  END IF;
  
  -- 11. ✅ AMÉLIORATION : Récupérer auth_user_id depuis PLUSIEURS sources avec logs
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Recherche auth_user_id...';
    
    -- PRIORITÉ 1 : Depuis espaces_membres_clients
    IF v_client_id IS NOT NULL THEN
      SELECT user_id INTO v_auth_user_id
      FROM espaces_membres_clients
      WHERE client_id = v_client_id
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via espaces_membres_clients: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- PRIORITÉ 2 : Depuis auth.users via l'email du client
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
    
    -- PRIORITÉ 3 : Depuis utilisateurs table via l'email
    IF v_auth_user_id IS NULL AND v_client_email IS NOT NULL THEN
      SELECT id INTO v_auth_user_id
      FROM utilisateurs
      WHERE email = v_client_email
      LIMIT 1;
      
      IF v_auth_user_id IS NOT NULL THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Auth User ID trouvé via utilisateurs: %', v_auth_user_id;
      END IF;
    END IF;
    
    -- PRIORITÉ 4 : Depuis l'entreprise
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
  
  -- 13. ✅ CORRECTION : Créer la facture avec les BONNES colonnes (date_emission, pas date_facture)
  -- Vérifier si paiement_id existe dans factures
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'paiement_id'
  ) THEN
    -- Si paiement_id existe, l'utiliser
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
    -- Si paiement_id n'existe pas, ne pas l'inclure
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
  
  -- 14. ✅ CORRECTION : Créer l'abonnement avec vérification de la structure de la table
  -- Vérifier si la table a user_id ou client_id
  IF v_auth_user_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 Création abonnement - User: %, Plan: %, Entreprise: %', 
      v_auth_user_id, v_plan_id, v_entreprise_id;
    
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
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé avec client_id: %', v_abonnement_id;
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
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé avec user_id: %', v_abonnement_id;
    ELSE
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Colonne client_id ou user_id introuvable dans abonnements';
    END IF;
    
    IF v_abonnement_id IS NULL THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Échec de la création de l''abonnement (possible doublon ou contrainte)';
      
      -- Essayer de récupérer l'abonnement existant
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'facture_id'
      ) THEN
        SELECT id INTO v_abonnement_id FROM abonnements WHERE facture_id = v_facture_id LIMIT 1;
      END IF;
      
      IF v_abonnement_id IS NULL THEN
        SELECT id INTO v_abonnement_id 
        FROM abonnements 
        WHERE entreprise_id = v_entreprise_id 
        AND plan_id = v_plan_id
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;
    END IF;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement non créé - Auth User ID: %, Plan ID: %', 
      v_auth_user_id, v_plan_id;
  END IF;
  
  -- 15. Créer ou mettre à jour l'espace membre client
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
  
  UPDATE clients 
  SET statut = 'actif' 
  WHERE id = v_client_id;
  
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. CORRIGÉE : Protection contre doublons de factures, logs détaillés pour abonnement, vérification structure table abonnements.';

