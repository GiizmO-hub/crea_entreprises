/*
  # Fix FINAL COMPLET: Toutes les sources de "query returned more than one row"
  
  PROBLÈME:
  - L'erreur persiste malgré toutes les corrections
  - Il peut y avoir plusieurs entreprises pour un même user_id
  - Les triggers peuvent causer des problèmes
  - Les fonctions appelées par les triggers peuvent avoir des problèmes
  
  SOLUTION COMPLÈTE:
  - Corriger TOUTES les fonctions liées aux abonnements
  - S'assurer que TOUS les SELECT ... INTO utilisent LIMIT 1 ou des sous-requêtes
  - Corriger les triggers et leurs fonctions
  - Ajouter des vérifications supplémentaires
*/

-- ============================================================================
-- FIX 1: link_abonnement_to_client_space - Trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION link_abonnement_to_client_space()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_espace_record record;
  v_count integer := 0;
BEGIN
  RAISE NOTICE '🔗 [link_abonnement_to_client_space] DÉBUT - Abonnement ID: %, Entreprise ID: %', NEW.id, NEW.entreprise_id;
  
  -- Si l'abonnement est actif et a un plan_id
  IF NEW.statut = 'actif' AND NEW.plan_id IS NOT NULL AND NEW.entreprise_id IS NOT NULL THEN
    -- Trouver tous les espaces clients de cette entreprise qui n'ont pas encore d'abonnement
    FOR v_espace_record IN
      SELECT id
      FROM espaces_membres_clients
      WHERE entreprise_id = NEW.entreprise_id
        AND (abonnement_id IS NULL OR abonnement_id != NEW.id)
    LOOP
      -- Lier l'abonnement actif à cet espace
      UPDATE espaces_membres_clients
      SET abonnement_id = NEW.id,
          updated_at = NOW()
      WHERE id = v_espace_record.id;
      
      -- Synchroniser immédiatement les modules
      PERFORM sync_client_modules_from_plan(v_espace_record.id);
      
      v_count := v_count + 1;
      RAISE NOTICE '✅ [link_abonnement_to_client_space] Abonnement % lié à l''espace client %', NEW.id, v_espace_record.id;
    END LOOP;
    
    RAISE NOTICE '✅ [link_abonnement_to_client_space] TERMINÉ - % espace(s) lié(s)', v_count;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION link_abonnement_to_client_space IS 'Lie automatiquement un abonnement aux espaces clients de l''entreprise - Version finale sécurisée';

-- ============================================================================
-- FIX 2: sync_modules_on_abonnement_change - Trigger function (simplifiée)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_modules_on_abonnement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_espace_record record;
  v_count integer := 0;
BEGIN
  RAISE NOTICE '🔄 [sync_modules_on_abonnement_change] DÉBUT - Abonnement ID: %', NEW.id;
  
  -- Si l'abonnement est actif, synchroniser tous les espaces liés
  IF NEW.statut = 'actif' AND NEW.id IS NOT NULL THEN
    FOR v_espace_record IN
      SELECT id
      FROM espaces_membres_clients
      WHERE abonnement_id = NEW.id
    LOOP
      PERFORM sync_client_modules_from_plan(v_espace_record.id);
      v_count := v_count + 1;
      RAISE NOTICE '✅ [sync_modules_on_abonnement_change] Modules synchronisés pour espace %', v_espace_record.id;
    END LOOP;
    
    RAISE NOTICE '✅ [sync_modules_on_abonnement_change] TERMINÉ - % espace(s) synchronisé(s)', v_count;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_modules_on_abonnement_change IS 'Synchronise automatiquement les modules lorsque l''abonnement change - Version finale sécurisée';

-- ============================================================================
-- FIX 3: sync_client_modules_from_plan - Corriger pour éviter multi-row
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(p_espace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
BEGIN
  RAISE NOTICE '🔄 [sync_client_modules_from_plan] DÉBUT - Espace ID: %', p_espace_id;
  
  -- ✅ CORRECTION: Utiliser une sous-requête avec LIMIT 1
  SELECT abonnement_id INTO v_abonnement_id
  FROM (
    SELECT abonnement_id
    FROM espaces_membres_clients
    WHERE id = p_espace_id
    LIMIT 1
  ) sub;
  
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ [sync_client_modules_from_plan] Aucun abonnement lié à l''espace client %', p_espace_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Abonnement trouvé: %', v_abonnement_id;
  
  -- ✅ CORRECTION: Utiliser une sous-requête avec LIMIT 1
  SELECT plan_id INTO v_plan_id
  FROM (
    SELECT plan_id
    FROM abonnements
    WHERE id = v_abonnement_id
      AND statut = 'actif'
    LIMIT 1
  ) sub;
  
  IF v_plan_id IS NULL THEN
    RAISE NOTICE '⚠️ [sync_client_modules_from_plan] Aucun plan actif pour l''abonnement %', v_abonnement_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Plan trouvé: %', v_plan_id;
  
  -- Construire le JSON des modules actifs depuis plans_modules
  FOR v_module_record IN
    SELECT pm.module_code
    FROM plans_modules pm
    JOIN modules_activation ma ON ma.module_code = pm.module_code
    WHERE pm.plan_id = v_plan_id
      AND pm.inclus = true
      AND ma.est_cree = true
      AND ma.actif = true
  LOOP
    v_modules_json := jsonb_set(
      v_modules_json,
      ARRAY[v_module_record.module_code],
      'true'::jsonb
    );
  END LOOP;
  
  -- Mettre à jour modules_actifs dans l'espace client
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = NOW()
  WHERE id = p_espace_id;
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Modules synchronisés pour l''espace client %', p_espace_id;
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan IS 'Synchronise les modules d''un espace client depuis son plan - Version finale avec sous-requêtes sécurisées';

-- ============================================================================
-- FIX 4: create_abonnement_complete - Version ULTRA SÉCURISÉE
-- ============================================================================

CREATE OR REPLACE FUNCTION create_abonnement_complete(
  p_client_id uuid,
  p_plan_id uuid,
  p_entreprise_id uuid DEFAULT NULL,
  p_mode_paiement text DEFAULT 'mensuel',
  p_date_debut date DEFAULT CURRENT_DATE,
  p_date_fin date DEFAULT NULL,
  p_montant_mensuel numeric DEFAULT NULL,
  p_options_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_statut text DEFAULT 'actif'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_montant numeric;
  v_total_montant numeric;
  v_entreprise_id uuid;
  v_user_id uuid;
  v_client_user_id uuid;
  v_client_email text;
  v_client_exists boolean;
  i integer;
BEGIN
  RAISE NOTICE '🚀 [create_abonnement_complete] DÉBUT - Client ID: %, Plan ID: %', p_client_id, p_plan_id;
  
  -- Récupérer le user_id actuel
  v_user_id := auth.uid();
  RAISE NOTICE '👤 [create_abonnement_complete] User ID: %', v_user_id;
  
  -- Vérifier que le client existe
  SELECT EXISTS(SELECT 1 FROM clients WHERE id = p_client_id) INTO v_client_exists;
  
  IF NOT v_client_exists THEN
    RAISE WARNING '❌ [create_abonnement_complete] Client non trouvé - ID: %', p_client_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;

  -- ✅ CORRECTION: Utiliser sous-requête avec LIMIT 1 pour éviter multi-row
  SELECT entreprise_id INTO v_entreprise_id
  FROM (
    SELECT entreprise_id
    FROM clients
    WHERE id = p_client_id
    LIMIT 1
  ) sub;

  -- ✅ MAX() OK pour text (email)
  SELECT MAX(email) INTO v_client_email
  FROM clients
  WHERE id = p_client_id;

  RAISE NOTICE '✅ [create_abonnement_complete] Client trouvé - Entreprise ID: %, Email: %', v_entreprise_id, v_client_email;

  -- Si aucune entreprise trouvée dans le client, utiliser celle fournie en paramètre
  IF v_entreprise_id IS NULL THEN
    RAISE NOTICE '⚠️ [create_abonnement_complete] Pas d''entreprise dans le client, utilisation du paramètre...';
    IF p_entreprise_id IS NOT NULL THEN
      v_entreprise_id := p_entreprise_id;
      RAISE NOTICE '✅ [create_abonnement_complete] Entreprise ID depuis paramètre: %', v_entreprise_id;
    ELSE
      -- ✅ CORRECTION CRITIQUE: Utiliser une CTE avec DISTINCT ON pour garantir UNE SEULE ligne
      -- Gère le cas où plusieurs entreprises existent pour le même user_id
      WITH entreprises_user AS (
        SELECT DISTINCT ON (user_id) id
        FROM entreprises
        WHERE user_id = v_user_id
        ORDER BY user_id, created_at DESC
      )
      SELECT id INTO v_entreprise_id
      FROM entreprises_user
      LIMIT 1;
      
      IF v_entreprise_id IS NULL THEN
        RAISE WARNING '❌ [create_abonnement_complete] Aucune entreprise trouvée pour user %', v_user_id;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Aucune entreprise trouvée. Veuillez créer une entreprise d''abord.'
        );
      END IF;
      
      RAISE NOTICE '✅ [create_abonnement_complete] Entreprise ID depuis user (plus récente): %', v_entreprise_id;
    END IF;
  END IF;

  -- ✅ CORRECTION: Utiliser sous-requête avec LIMIT 1
  SELECT user_id INTO v_client_user_id
  FROM (
    SELECT user_id
    FROM espaces_membres_clients
    WHERE client_id = p_client_id
    LIMIT 1
  ) sub;

  -- Si pas trouvé dans espace membre, essayer de trouver via email du client
  IF v_client_user_id IS NULL AND v_client_email IS NOT NULL THEN
    -- ✅ CORRECTION: Utiliser sous-requête avec LIMIT 1 et ORDER BY
    SELECT id INTO v_client_user_id
    FROM (
      SELECT id
      FROM auth.users
      WHERE email = v_client_email
      ORDER BY created_at DESC
      LIMIT 1
    ) sub;
    
    IF v_client_user_id IS NOT NULL THEN
      RAISE NOTICE '👤 [create_abonnement_complete] User ID trouvé via email: %', v_client_user_id;
    END IF;
  ELSE
    IF v_client_user_id IS NOT NULL THEN
      RAISE NOTICE '👤 [create_abonnement_complete] User ID trouvé via espace membre: %', v_client_user_id;
    END IF;
  END IF;
  
  -- Si toujours NULL, on peut laisser NULL (client_id est nullable)
  IF v_client_user_id IS NULL THEN
    RAISE NOTICE '⚠️ [create_abonnement_complete] Pas de user_id trouvé pour le client, client_id sera NULL';
  END IF;

  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE WARNING '❌ [create_abonnement_complete] Plan non trouvé ou inactif - ID: %', p_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé ou inactif'
    );
  END IF;

  -- Récupérer le montant du plan si non fourni
  IF p_montant_mensuel IS NULL THEN
    SELECT (
      CASE 
        WHEN p_mode_paiement = 'annuel' THEN prix_annuel / 12
        ELSE prix_mensuel
      END
    ) INTO v_plan_montant
    FROM plans_abonnement
    WHERE id = p_plan_id
    LIMIT 1;
    
    v_plan_montant := COALESCE(v_plan_montant, 0);
    
    RAISE NOTICE '💰 [create_abonnement_complete] Montant plan calculé: %', v_plan_montant;
  ELSE
    v_plan_montant := p_montant_mensuel;
    RAISE NOTICE '💰 [create_abonnement_complete] Montant plan personnalisé: %', v_plan_montant;
  END IF;

  -- Calculer le montant total avec les options
  v_total_montant := v_plan_montant;
  
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    RAISE NOTICE '⚙️ [create_abonnement_complete] Calcul des options...';
    
    v_total_montant := v_plan_montant + COALESCE(
      (SELECT SUM(prix_mensuel) 
       FROM options_supplementaires 
       WHERE id = ANY(p_options_ids) 
       AND actif = true), 
      0
    );
    
    RAISE NOTICE '💰 [create_abonnement_complete] Montant total (plan + options): %', v_total_montant;
  END IF;

  -- Créer l'abonnement
  RAISE NOTICE '📝 [create_abonnement_complete] Création de l''abonnement...';
  RAISE NOTICE '   → entreprise_id: %', v_entreprise_id;
  RAISE NOTICE '   → client_id (user_id): %', v_client_user_id;
  RAISE NOTICE '   → plan_id: %', p_plan_id;
  RAISE NOTICE '   → montant: %', v_total_montant;
  
  INSERT INTO abonnements (
    entreprise_id,
    client_id,
    plan_id,
    statut,
    date_debut,
    date_fin,
    montant_mensuel,
    mode_paiement
  )
  VALUES (
    v_entreprise_id,
    v_client_user_id,
    p_plan_id,
    p_statut,
    p_date_debut,
    p_date_fin,
    v_total_montant,
    p_mode_paiement
  )
  RETURNING id INTO v_abonnement_id;

  RAISE NOTICE '✅ [create_abonnement_complete] Abonnement créé - ID: %', v_abonnement_id;

  -- Ajouter les options si fournies
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    RAISE NOTICE '⚙️ [create_abonnement_complete] Ajout des options (% options)...', array_length(p_options_ids, 1);
    
    FOR i IN 1..array_length(p_options_ids, 1) LOOP
      IF EXISTS (
        SELECT 1 FROM options_supplementaires 
        WHERE id = p_options_ids[i] AND actif = true
      ) THEN
        INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_activation)
        VALUES (v_abonnement_id, p_options_ids[i], true, p_date_debut)
        ON CONFLICT (abonnement_id, option_id) DO UPDATE
        SET actif = true,
            date_activation = p_date_debut,
            date_desactivation = NULL;
        
        RAISE NOTICE '✅ [create_abonnement_complete] Option ajoutée: %', p_options_ids[i];
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE '✅ [create_abonnement_complete] TERMINÉ AVEC SUCCÈS';

  RETURN jsonb_build_object(
    'success', true,
    'abonnement_id', v_abonnement_id,
    'montant_mensuel', v_total_montant,
    'message', 'Abonnement créé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [create_abonnement_complete] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION create_abonnement_complete IS 'Créer un abonnement complet - VERSION FINALE ULTRA SÉCURISÉE avec toutes les corrections multi-row';

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

DO $$
DECLARE
  func_count integer;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'create_abonnement_complete',
    'link_abonnement_to_client_space',
    'sync_modules_on_abonnement_change',
    'sync_client_modules_from_plan'
  );
  
  IF func_count = 4 THEN
    RAISE NOTICE '✅ Toutes les fonctions critiques ont été créées/mises à jour';
  ELSE
    RAISE WARNING '⚠️  Seulement % fonction(s) trouvée(s) sur 4 attendues', func_count;
  END IF;
END $$;

