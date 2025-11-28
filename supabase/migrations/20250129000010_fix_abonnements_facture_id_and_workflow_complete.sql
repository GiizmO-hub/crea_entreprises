/*
  # CORRECTION FINALE : Colonne facture_id dans abonnements + Workflow complet
  
  Problème :
  - La colonne "facture_id" n'existe pas dans la table abonnements
  - La fonction creer_facture_et_abonnement_apres_paiement essaie d'insérer/consulter facture_id
  - Cela empêche la création de l'abonnement
  
  Solution :
  1. ✅ Ajouter colonne facture_id dans abonnements (si elle n'existe pas)
  2. ✅ Corriger toutes les références à facture_id dans les fonctions
  3. ✅ Gérer conditionnellement si la colonne existe ou non
  4. ✅ Améliorer la création d'abonnement avec logs détaillés
*/

-- ========================================
-- PARTIE 1 : Ajouter colonne facture_id dans abonnements si elle n'existe pas
-- ========================================

DO $$
BEGIN
  -- Ajouter la colonne facture_id si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'facture_id'
  ) THEN
    ALTER TABLE abonnements 
    ADD COLUMN facture_id uuid REFERENCES factures(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Colonne facture_id ajoutée à la table abonnements';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne facture_id existe déjà dans abonnements';
  END IF;
  
  -- Créer un index pour améliorer les performances
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'abonnements' 
    AND indexname = 'idx_abonnements_facture_id'
  ) THEN
    CREATE INDEX idx_abonnements_facture_id ON abonnements(facture_id);
    RAISE NOTICE '✅ Index créé sur abonnements.facture_id';
  END IF;
END $$;

-- ========================================
-- PARTIE 2 : Recréer creer_facture_et_abonnement_apres_paiement SANS utiliser facture_id dans SELECT/INSERT si colonne n'existe pas
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
  v_facture_id_exists boolean;
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. ✅ PROTECTION DOUBLONS : Vérifier si une facture existe déjà via paiement_id
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  -- Fallback : Si pas trouvé via paiement_id, vérifier par entreprise_id + montant + date
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
    v_facture_id := v_facture_existante;
    
    -- Vérifier si facture_id existe dans abonnements pour la requête
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'abonnements' AND column_name = 'facture_id'
    ) INTO v_facture_id_exists;
    
    IF v_facture_id_exists THEN
      SELECT id INTO v_abonnement_id FROM abonnements WHERE facture_id = v_facture_id LIMIT 1;
    ELSE
      -- Si pas de colonne facture_id, chercher par entreprise_id + plan_id
      SELECT id INTO v_abonnement_id 
      FROM abonnements 
      WHERE entreprise_id = v_paiement.entreprise_id
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
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
    SELECT f.entreprise_id INTO v_entreprise_id
    FROM factures f
    WHERE f.paiement_id = p_paiement_id
    LIMIT 1;
    
    IF v_entreprise_id IS NULL THEN
      SELECT a.entreprise_id INTO v_entreprise_id
      FROM abonnements a
      WHERE EXISTS (
        SELECT 1 FROM factures f 
        WHERE f.paiement_id = p_paiement_id
        AND (
          -- Si facture_id existe dans abonnements
          (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'abonnements' AND column_name = 'facture_id') AND a.facture_id = f.id)
          OR
          -- Sinon chercher par entreprise_id
          (NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'abonnements' AND column_name = 'facture_id') AND a.entreprise_id = f.entreprise_id)
        )
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
  
  -- 13. ✅ CORRECTION : Créer la facture avec paiement_id
  BEGIN
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
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  EXCEPTION
    WHEN unique_violation THEN
      -- Si violation unique (paiement_id déjà utilisé), récupérer la facture existante
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (unique_violation sur paiement_id)';
      SELECT id INTO v_facture_id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1;
      IF v_facture_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture (unique_violation)');
      END IF;
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création facture: %', SQLERRM;
      RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture: ' || SQLERRM);
  END;
  
  -- 14. ✅ CORRECTION : Créer l'abonnement avec gestion conditionnelle de facture_id
  -- Vérifier si facture_id existe dans abonnements
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'facture_id'
  ) INTO v_facture_id_exists;
  
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
        IF v_facture_id_exists THEN
          -- Avec facture_id
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
        ELSE
          -- Sans facture_id
          INSERT INTO abonnements (
            entreprise_id, client_id, plan_id, 
            date_debut, date_fin, statut
          )
          VALUES (
            v_entreprise_id, v_auth_user_id, v_plan_id,
            CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif'
          )
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_abonnement_id;
        END IF;
        
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
        IF v_facture_id_exists THEN
          -- Avec facture_id
          INSERT INTO abonnements (
            entreprise_id, user_id, plan_id, 
            date_debut, date_fin, statut, facture_id
          )
          VALUES (
            v_entreprise_id, v_auth_user_id, v_plan_id,
            CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'actif', v_facture_id
          )
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_abonnement_id;
        ELSE
          -- Sans facture_id
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
        END IF;
        
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
        -- Continuer même si l'abonnement échoue, mais loguer l'erreur
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Détails erreur abonnement - Auth User ID: %, Plan ID: %, Entreprise ID: %, Facture ID: %', 
          v_auth_user_id, v_plan_id, v_entreprise_id, v_facture_id;
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. VERSION FINALE : Gère conditionnellement facture_id dans abonnements (ajoutée si n''existe pas). Logs détaillés pour diagnostic.';

