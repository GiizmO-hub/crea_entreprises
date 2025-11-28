/*
  # Fix CRITIQUE: Erreur "function max(uuid) does not exist"
  
  PROBLÈME:
  - PostgreSQL n'a pas de fonction MAX() pour les types UUID
  - Les migrations précédentes utilisent MAX(id) sur des UUID
  - Erreur: "function max(uuid) does not exist (SQLSTATE: 42883)"
  
  SOLUTION:
  - Remplacer tous les MAX(uuid) par des sous-requêtes avec LIMIT 1 et ORDER BY
  - Utiliser (SELECT id FROM ... LIMIT 1) au lieu de MAX(id)
  - Garder MAX() uniquement pour les colonnes numériques/text
*/

-- ============================================================================
-- FIX 1: create_abonnement_complete - Remplacer MAX() sur UUID
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
  RAISE NOTICE '🔍 [create_abonnement_complete] Vérification du client...';
  
  SELECT EXISTS(SELECT 1 FROM clients WHERE id = p_client_id) INTO v_client_exists;
  
  IF NOT v_client_exists THEN
    RAISE WARNING '❌ [create_abonnement_complete] Client non trouvé - ID: %', p_client_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;

  -- ✅ FIX: Utiliser une sous-requête au lieu de MAX() pour UUID
  SELECT entreprise_id INTO v_entreprise_id
  FROM clients
  WHERE id = p_client_id
  LIMIT 1;

  -- ✅ FIX: Utiliser MAX() uniquement pour text (email)
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
      -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
      SELECT id INTO v_entreprise_id
      FROM entreprises
      WHERE user_id = v_user_id
      ORDER BY created_at DESC
      LIMIT 1;
      
      RAISE NOTICE '✅ [create_abonnement_complete] Entreprise ID depuis user (première trouvée): %', v_entreprise_id;
    END IF;
  END IF;

  -- Vérifier qu'on a une entreprise
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '❌ [create_abonnement_complete] Aucune entreprise trouvée';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune entreprise trouvée pour ce client. Veuillez créer une entreprise d''abord.'
    );
  END IF;

  -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
  SELECT user_id INTO v_client_user_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  LIMIT 1;

  -- Si pas trouvé dans espace membre, essayer de trouver via email du client
  IF v_client_user_id IS NULL AND v_client_email IS NOT NULL THEN
    -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
    SELECT id INTO v_client_user_id
    FROM auth.users
    WHERE email = v_client_email
    ORDER BY created_at DESC
    LIMIT 1;
    
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
  RAISE NOTICE '🔍 [create_abonnement_complete] Vérification du plan...';
  
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE WARNING '❌ [create_abonnement_complete] Plan non trouvé ou inactif - ID: %', p_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé ou inactif'
    );
  END IF;

  -- Récupérer le montant du plan si non fourni (MAX() OK pour numeric)
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
    
    -- Si NULL, mettre à 0
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
    
    -- Utiliser COALESCE pour garantir une valeur même si aucune option trouvée
    v_total_montant := v_plan_montant + COALESCE(
      (SELECT SUM(prix_mensuel) 
       FROM options_supplementaires 
       WHERE id = ANY(p_options_ids) 
       AND actif = true), 
      0
    );
    
    RAISE NOTICE '💰 [create_abonnement_complete] Montant total (plan + options): %', v_total_montant;
  END IF;

  -- Créer l'abonnement avec TOUS les champs requis
  RAISE NOTICE '📝 [create_abonnement_complete] Création de l''abonnement...';
  RAISE NOTICE '   → entreprise_id: %', v_entreprise_id;
  RAISE NOTICE '   → client_id (user_id): %', v_client_user_id;
  RAISE NOTICE '   → plan_id: %', p_plan_id;
  RAISE NOTICE '   → montant: %', v_total_montant;
  
  INSERT INTO abonnements (
    entreprise_id,      -- ✅ Requis
    client_id,          -- ✅ user_id du client (nullable)
    plan_id,
    statut,
    date_debut,
    date_fin,
    montant_mensuel,
    mode_paiement
  )
  VALUES (
    v_entreprise_id,
    v_client_user_id,   -- ✅ user_id du client (peut être NULL)
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
      -- Vérifier que l'option existe et est active
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

  -- Retourner le résultat
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

COMMENT ON FUNCTION create_abonnement_complete IS 'Créer un abonnement complet - CORRIGÉ pour éviter MAX() sur UUID';

-- ============================================================================
-- FIX 2: sync_client_modules_from_plan - Remplacer MAX() sur UUID
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
  
  -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
  SELECT abonnement_id INTO v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id
  LIMIT 1;
  
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ [sync_client_modules_from_plan] Aucun abonnement lié à l''espace client %', p_espace_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Abonnement trouvé: %', v_abonnement_id;
  
  -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
  SELECT plan_id INTO v_plan_id
  FROM abonnements
  WHERE id = v_abonnement_id
    AND statut = 'actif'
  LIMIT 1;
  
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
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Modules synchronisés pour l''espace client % : % modules', 
    p_espace_id, 
    jsonb_object_keys(v_modules_json)::text;
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan IS 'Synchronise les modules d''un espace client depuis son plan d''abonnement - CORRIGÉ pour éviter MAX() sur UUID';

-- ============================================================================
-- FIX 3: get_client_abonnement_details - Remplacer MAX() sur UUID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_client_abonnement_details(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_abonnement_id uuid;
BEGIN
  -- ✅ FIX: Utiliser sous-requête au lieu de MAX() pour UUID
  SELECT a.id INTO v_abonnement_id
  FROM abonnements a
  JOIN clients c ON c.entreprise_id = a.entreprise_id
  WHERE c.id = p_client_id
    AND a.statut = 'actif'
  ORDER BY a.created_at DESC
  LIMIT 1;
  
  -- Si aucun abonnement trouvé, retourner un objet vide
  IF v_abonnement_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Construire le résultat avec l'abonnement trouvé
  SELECT jsonb_build_object(
    'abonnement', row_to_json(a.*),
    'plan', row_to_json(p.*),
    'options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', os.id,
          'code', os.code,
          'nom', os.nom,
          'description', os.description,
          'prix_mensuel', os.prix_mensuel,
          'type', os.type,
          'date_activation', ao.date_activation,
          'actif', ao.actif
        )
      )
      FROM abonnement_options ao
      JOIN options_supplementaires os ON os.id = ao.option_id
      WHERE ao.abonnement_id = a.id AND ao.actif = true
    ), '[]'::jsonb)
  ) INTO v_result
  FROM abonnements a
  LEFT JOIN plans_abonnement p ON p.id = a.plan_id
  WHERE a.id = v_abonnement_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_client_abonnement_details IS 'Récupère l''abonnement complet d''un client avec plan et options - CORRIGÉ pour éviter MAX() sur UUID';


