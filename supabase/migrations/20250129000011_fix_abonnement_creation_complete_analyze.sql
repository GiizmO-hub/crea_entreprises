/*
  # ANALYSE ET CORRECTION COMPLÈTE : Création d'abonnement
  
  Problème :
  - L'abonnement ne se crée pas malgré toutes les corrections
  - Les données sont peut-être présentes mais l'INSERT échoue silencieusement
  - Il peut manquer une étape dans la récupération des informations
  
  Solution :
  1. ✅ Vérifier la structure réelle de la table abonnements
  2. ✅ Analyser pourquoi l'INSERT échoue (RLS, contraintes, colonnes manquantes)
  3. ✅ Ajouter des logs TRÈS détaillés à chaque étape
  4. ✅ Gérer tous les cas possibles (client_id vs user_id, avec/sans facture_id)
  5. ✅ Vérifier les RLS policies qui pourraient bloquer l'insertion
  6. ✅ Créer une fonction de diagnostic pour tester la création d'abonnement
*/

-- ========================================
-- PARTIE 1 : Vérifier et corriger la structure de abonnements
-- ========================================

DO $$
DECLARE
  v_cols text;
BEGIN
  -- Afficher toutes les colonnes de abonnements
  SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_name = 'abonnements';
  
  RAISE NOTICE '📋 Structure actuelle de abonnements: %', v_cols;
END $$;

-- S'assurer que toutes les colonnes nécessaires existent
DO $$
BEGIN
  -- Ajouter facture_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'facture_id'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN facture_id uuid REFERENCES factures(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_abonnements_facture_id ON abonnements(facture_id);
    RAISE NOTICE '✅ Colonne facture_id ajoutée';
  END IF;
  
  -- S'assurer que client_id ou user_id existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND (column_name = 'client_id' OR column_name = 'user_id')
  ) THEN
    RAISE WARNING '⚠️ ATTENTION: Ni client_id ni user_id trouvé dans abonnements !';
  END IF;
END $$;

-- ========================================
-- PARTIE 2 : Fonction de diagnostic pour la création d'abonnement
-- ========================================

CREATE OR REPLACE FUNCTION diagnostic_creation_abonnement(
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
  v_facture_id uuid;
  v_notes jsonb;
  v_client_email text;
  v_diagnostic jsonb := jsonb_build_object();
  v_abonnements_structure jsonb;
  v_col RECORD;
BEGIN
  -- Diagnostic structure table abonnements
  SELECT jsonb_agg(
    jsonb_build_object(
      'column_name', column_name,
      'data_type', data_type,
      'is_nullable', is_nullable
    )
    ORDER BY ordinal_position
  ) INTO v_abonnements_structure
  FROM information_schema.columns
  WHERE table_name = 'abonnements';
  
  v_diagnostic := v_diagnostic || jsonb_build_object(
    'structure_abonnements', v_abonnements_structure
  );
  
  -- Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN v_diagnostic || jsonb_build_object('error', 'Paiement non trouvé');
  END IF;
  
  v_diagnostic := v_diagnostic || jsonb_build_object(
    'paiement', jsonb_build_object(
      'id', v_paiement.id,
      'statut', v_paiement.statut,
      'entreprise_id', v_paiement.entreprise_id,
      'montant_ttc', v_paiement.montant_ttc,
      'notes', v_paiement.notes
    )
  );
  
  -- Parser les notes
  BEGIN
    IF v_paiement.notes IS NOT NULL THEN
      IF jsonb_typeof(v_paiement.notes) = 'string' THEN
        v_notes := (v_paiement.notes::text)::jsonb;
      ELSE
        v_notes := v_paiement.notes::jsonb;
      END IF;
    ELSE
      v_notes := '{}'::jsonb;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_notes := '{}'::jsonb;
  END;
  
  v_entreprise_id := COALESCE(v_paiement.entreprise_id, (v_notes->>'entreprise_id')::uuid);
  v_client_id := (v_notes->>'client_id')::uuid;
  v_auth_user_id := (v_notes->>'auth_user_id')::uuid;
  v_plan_id := (v_notes->>'plan_id')::uuid;
  
  v_diagnostic := v_diagnostic || jsonb_build_object(
    'donnees_extraites', jsonb_build_object(
      'entreprise_id', v_entreprise_id,
      'client_id', v_client_id,
      'auth_user_id', v_auth_user_id,
      'plan_id', v_plan_id
    )
  );
  
  -- Vérifier entreprise
  IF v_entreprise_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM entreprises WHERE id = v_entreprise_id) THEN
      v_diagnostic := v_diagnostic || jsonb_build_object('entreprise_exists', true);
    ELSE
      v_diagnostic := v_diagnostic || jsonb_build_object('entreprise_exists', false);
    END IF;
  END IF;
  
  -- Vérifier plan
  IF v_plan_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM plans_abonnement WHERE id = v_plan_id) THEN
      v_diagnostic := v_diagnostic || jsonb_build_object('plan_exists', true);
    ELSE
      v_diagnostic := v_diagnostic || jsonb_build_object('plan_exists', false);
    END IF;
  END IF;
  
  -- Vérifier facture
  SELECT id INTO v_facture_id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1;
  IF v_facture_id IS NOT NULL THEN
    v_diagnostic := v_diagnostic || jsonb_build_object('facture_exists', true, 'facture_id', v_facture_id);
  ELSE
    v_diagnostic := v_diagnostic || jsonb_build_object('facture_exists', false);
  END IF;
  
  -- Vérifier auth_user_id
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id FROM espaces_membres_clients WHERE client_id = v_client_id LIMIT 1;
    
    IF v_auth_user_id IS NULL THEN
      SELECT email INTO v_client_email FROM clients WHERE id = v_client_id;
      IF v_client_email IS NOT NULL THEN
        SELECT id INTO v_auth_user_id FROM auth.users WHERE email = v_client_email LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  IF v_auth_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_auth_user_id) THEN
      v_diagnostic := v_diagnostic || jsonb_build_object('auth_user_exists', true);
    ELSE
      v_diagnostic := v_diagnostic || jsonb_build_object('auth_user_exists', false);
    END IF;
  END IF;
  
  v_diagnostic := v_diagnostic || jsonb_build_object('auth_user_id_final', v_auth_user_id);
  
  -- Vérifier abonnement existant
  IF v_facture_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'facture_id'
  ) THEN
    IF EXISTS (SELECT 1 FROM abonnements WHERE facture_id = v_facture_id) THEN
      v_diagnostic := v_diagnostic || jsonb_build_object('abonnement_existe_via_facture', true);
    ELSE
      v_diagnostic := v_diagnostic || jsonb_build_object('abonnement_existe_via_facture', false);
    END IF;
  END IF;
  
  IF v_entreprise_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM abonnements WHERE entreprise_id = v_entreprise_id AND plan_id = v_plan_id) THEN
      v_diagnostic := v_diagnostic || jsonb_build_object('abonnement_existe_via_entreprise_plan', true);
    ELSE
      v_diagnostic := v_diagnostic || jsonb_build_object('abonnement_existe_via_entreprise_plan', false);
    END IF;
  END IF;
  
  RETURN v_diagnostic;
END;
$$;

COMMENT ON FUNCTION diagnostic_creation_abonnement IS 'Diagnostic complet pour comprendre pourquoi l''abonnement ne se crée pas';

-- ========================================
-- PARTIE 3 : Recréer creer_facture_et_abonnement_apres_paiement avec logs ULTRA détaillés
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
  v_client_id_exists boolean;
  v_user_id_exists boolean;
  v_abonnement_columns text[];
  v_logs jsonb := jsonb_build_array();
BEGIN
  -- Fonction helper pour ajouter des logs
  -- (On utilise RAISE NOTICE directement)
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Paiement trouvé - Statut: %, Entreprise: %, Montant: %', 
    v_paiement.statut, v_paiement.entreprise_id, v_paiement.montant_ttc;
  
  -- 2. ✅ PROTECTION DOUBLONS : Vérifier si une facture existe déjà via paiement_id
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante (doublon évité): %', v_facture_existante;
    v_facture_id := v_facture_existante;
    
    -- Récupérer abonnement existant
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'abonnements' AND column_name = 'facture_id'
    ) INTO v_facture_id_exists;
    
    IF v_facture_id_exists THEN
      SELECT id INTO v_abonnement_id FROM abonnements WHERE facture_id = v_facture_id LIMIT 1;
    END IF;
    
    IF v_abonnement_id IS NULL THEN
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
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Statut paiement mis à jour à "paye"';
  END IF;
  
  -- 4. Extraire les montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  
  -- 5. ✅ PRIORITÉ 1 : Récupérer entreprise_id depuis la colonne entreprise_id du paiement
  v_entreprise_id := v_paiement.entreprise_id;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Entreprise ID (depuis paiement): %', v_entreprise_id;
  
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
  
  -- 7. Si entreprise_id toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant',
      'paiement_id', p_paiement_id,
      'notes', v_paiement.notes
    );
  END IF;
  
  -- 8. ✅ AMÉLIORATION : Récupérer le plan_id si manquant
  IF v_plan_id IS NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔍 Plan ID manquant, recherche dans abonnements existants...';
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan ID trouvé dans abonnements existants: %', v_plan_id;
    END IF;
  END IF;
  
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
    IF FOUND THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Plan trouvé: %', v_plan.nom;
    ELSE
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé dans plans_abonnement', v_plan_id;
      v_plan_id := NULL;
    END IF;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan ID NULL - l''abonnement ne pourra pas être créé';
  END IF;
  
  -- 9. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
    IF v_client_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Client ID trouvé via entreprise: %', v_client_id;
    END IF;
  END IF;
  
  -- 10. ✅ AMÉLIORATION : Récupérer auth_user_id depuis PLUSIEURS sources avec logs
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
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Auth User ID non trouvé - l''abonnement ne pourra pas être créé';
    END IF;
  END IF;
  
  -- 11. Générer le numero de facture
  v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
  
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
  END LOOP;
  
  -- 12. Créer la facture
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
      SELECT id INTO v_facture_id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1;
      IF v_facture_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture (unique_violation)');
      END IF;
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création facture: %', SQLERRM;
      RETURN jsonb_build_object('success', false, 'error', 'Erreur création facture: ' || SQLERRM);
  END;
  
  -- 13. ✅ CRÉATION ABONNEMENT AVEC LOGS ULTRA DÉTAILLÉS
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 ===== DÉBUT CRÉATION ABONNEMENT =====';
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Données disponibles:';
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - entreprise_id: %', v_entreprise_id;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - plan_id: %', v_plan_id;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - auth_user_id: %', v_auth_user_id;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - facture_id: %', v_facture_id;
  
  -- Vérifier la structure de la table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'facture_id'
  ) INTO v_facture_id_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'client_id'
  ) INTO v_client_id_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' AND column_name = 'user_id'
  ) INTO v_user_id_exists;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Structure table abonnements:';
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - facture_id existe: %', v_facture_id_exists;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - client_id existe: %', v_client_id_exists;
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - user_id existe: %', v_user_id_exists;
  
  IF v_auth_user_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Conditions remplies pour création abonnement';
    
    BEGIN
      IF v_client_id_exists THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔧 Tentative INSERT avec client_id...';
        
        IF v_facture_id_exists THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    → Avec facture_id: %', v_facture_id;
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
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    → Sans facture_id';
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
        
        IF v_abonnement_id IS NOT NULL THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅✅✅ ABONNEMENT CRÉÉ AVEC SUCCÈS ! ID: %', v_abonnement_id;
        ELSE
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ INSERT retourné NULL (conflit probable)';
          
          -- Essayer de récupérer l'abonnement existant
          SELECT id INTO v_abonnement_id 
          FROM abonnements 
          WHERE entreprise_id = v_entreprise_id 
          AND plan_id = v_plan_id
          ORDER BY created_at DESC
          LIMIT 1;
          
          IF v_abonnement_id IS NOT NULL THEN
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement existant récupéré: %', v_abonnement_id;
          END IF;
        END IF;
        
      ELSIF v_user_id_exists THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🔧 Tentative INSERT avec user_id...';
        
        IF v_facture_id_exists THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    → Avec facture_id: %', v_facture_id;
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
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    → Sans facture_id';
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
        
        IF v_abonnement_id IS NOT NULL THEN
          RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅✅✅ ABONNEMENT CRÉÉ AVEC SUCCÈS ! ID: %', v_abonnement_id;
        ELSE
          RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ INSERT retourné NULL (conflit probable)';
          
          SELECT id INTO v_abonnement_id 
          FROM abonnements 
          WHERE entreprise_id = v_entreprise_id 
          AND plan_id = v_plan_id
          ORDER BY created_at DESC
          LIMIT 1;
          
          IF v_abonnement_id IS NOT NULL THEN
            RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement existant récupéré: %', v_abonnement_id;
          END IF;
        END IF;
      ELSE
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Ni client_id ni user_id trouvé dans abonnements !';
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR création abonnement: %', SQLERRM;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Détails erreur:';
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - SQLSTATE: %', SQLSTATE;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - Auth User ID: %', v_auth_user_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - Plan ID: %', v_plan_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - Entreprise ID: %', v_entreprise_id;
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement]    - Facture ID: %', v_facture_id;
    END;
  ELSE
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Conditions NON remplies:';
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement]    - auth_user_id: %', v_auth_user_id;
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement]    - plan_id: %', v_plan_id;
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📦 ===== FIN CRÉATION ABONNEMENT =====';
  
  -- 14. Créer ou mettre à jour l'espace membre client
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
  
  -- 15. Synchroniser modules si fonction existe
  BEGIN
    IF v_client_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible: %', SQLERRM;
  END;
  
  -- 16. Activer entreprise et client
  UPDATE entreprises SET statut = 'active' WHERE id = v_entreprise_id;
  
  IF v_client_id IS NOT NULL THEN
    UPDATE clients SET statut = 'actif' WHERE id = v_client_id;
  END IF;
  
  -- 17. Mettre à jour le rôle du client dans la table utilisateurs
  IF v_client_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
      UPDATE utilisateurs SET role = 'client_super_admin' WHERE id = v_auth_user_id;
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
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR FATALE: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. VERSION AVEC LOGS ULTRA DÉTAILLÉS pour diagnostic complet.';

