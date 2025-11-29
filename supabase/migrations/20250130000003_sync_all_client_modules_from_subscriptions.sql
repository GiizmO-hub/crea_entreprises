/*
  # Synchronisation automatique des modules pour tous les clients actifs
  
  **Problème:**
  - Les clients ont des modules activés dans leur abonnement (plan_modules)
  - Mais ces modules ne sont pas tous synchronisés dans modules_actifs de espaces_membres_clients
  - Certains modules comme "gestion-projets" ne s'affichent pas dans l'interface client
  
  **Solution:**
  - Créer une fonction qui synchronise automatiquement tous les modules
  - depuis plan_modules (via l'abonnement) vers modules_actifs
  - Appeler cette fonction pour tous les clients actifs avec abonnement
*/

-- ✅ FONCTION : Synchroniser les modules d'un client depuis son abonnement
CREATE OR REPLACE FUNCTION sync_client_modules_from_subscription(
  p_client_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_membre_id uuid;
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
  v_modules_count integer := 0;
  v_client_id uuid;
  v_entreprise_id uuid;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_subscription] 🚀 DÉBUT - User ID: %', p_client_user_id;
  
  -- 1. Récupérer l'espace membre du client
  SELECT id, client_id, abonnement_id
  INTO v_espace_membre_id, v_client_id, v_abonnement_id
  FROM espaces_membres_clients
  WHERE user_id = p_client_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_subscription] ❌ Espace membre non trouvé pour user: %', p_client_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Espace membre trouvé: %', v_espace_membre_id;
  
  -- 2. Récupérer l'abonnement actif
  -- D'abord récupérer l'entreprise_id depuis l'espace membre
  SELECT entreprise_id INTO v_entreprise_id
  FROM espaces_membres_clients
  WHERE id = v_espace_membre_id;
  
  -- Chercher l'abonnement via entreprise_id (méthode principale)
  IF v_entreprise_id IS NOT NULL THEN
    SELECT id, plan_id INTO v_abonnement_id, v_plan_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si pas trouvé via entreprise, chercher via user_id
  IF v_plan_id IS NULL THEN
    SELECT id, plan_id INTO v_abonnement_id, v_plan_id
    FROM abonnements
    WHERE user_id = p_client_user_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si toujours pas trouvé, chercher via client_id (si la colonne existe)
  IF v_plan_id IS NULL AND v_client_id IS NOT NULL THEN
    -- Essayer avec client_id directement
    BEGIN
      SELECT id, plan_id INTO v_abonnement_id, v_plan_id
      FROM abonnements
      WHERE client_id = v_client_id
      AND statut = 'actif'
      ORDER BY created_at DESC
      LIMIT 1;
    EXCEPTION WHEN undefined_column THEN
      -- La colonne client_id n'existe pas, ignorer
      NULL;
    END;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_subscription] ❌ Aucun abonnement actif trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Aucun abonnement actif');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Plan trouvé: %', v_plan_id;
  
  -- 3. Récupérer TOUS les modules activés du plan
  FOR v_module_record IN
    SELECT DISTINCT 
      COALESCE(pm.module_code, pm.module_id, m.code) as module_code,
      COALESCE(pm.module_nom, m.nom) as module_nom
    FROM plan_modules pm
    LEFT JOIN modules m ON m.id = pm.module_id OR m.code = pm.module_code
    WHERE pm.plan_id = v_plan_id 
    AND (
      pm.actif = true 
      OR pm.activer = true
      OR (pm.actif IS NULL AND pm.activer IS NULL AND pm.inclus = true)
    )
    ORDER BY module_code
  LOOP
    IF v_module_record.module_code IS NOT NULL THEN
      -- Normaliser le code (tirets vs underscores)
      v_modules_json := v_modules_json || jsonb_build_object(
        lower(replace(v_module_record.module_code, '_', '-')), 
        true
      );
      v_modules_json := v_modules_json || jsonb_build_object(
        lower(replace(v_module_record.module_code, '-', '_')), 
        true
      );
      v_modules_count := v_modules_count + 1;
      RAISE NOTICE '[sync_client_modules_from_subscription] 📦 Module ajouté: %', v_module_record.module_code;
    END IF;
  END LOOP;
  
  -- 4. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'dashboard', true,
    'tableau_de_bord', true,
    'tableau-de-bord', true,
    'entreprises', true,
    'mon_entreprise', true,
    'mon-entreprise', true,
    'settings', true,
    'parametres', true,
    'paramètres', true
  );
  
  -- 5. Mettre à jour l'espace membre
  UPDATE espaces_membres_clients
  SET 
    modules_actifs = v_modules_json,
    abonnement_id = v_abonnement_id,
    updated_at = now()
  WHERE id = v_espace_membre_id;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Modules synchronisés: % modules', v_modules_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_count', v_modules_count,
    'modules', v_modules_json
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[sync_client_modules_from_subscription] ❌ Erreur: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ✅ SYNCHRONISER TOUS LES CLIENTS ACTIFS
DO $$
DECLARE
  v_client_record RECORD;
  v_result jsonb;
  v_synced_count integer := 0;
  v_error_count integer := 0;
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔄 DÉBUT DE LA SYNCHRONISATION DES MODULES POUR TOUS LES CLIENTS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- Parcourir tous les espaces membres clients actifs
  FOR v_client_record IN
    SELECT DISTINCT ON (emc.user_id) 
      emc.user_id, 
      emc.client_id, 
      emc.id as espace_id,
      emc.created_at
    FROM espaces_membres_clients emc
    WHERE emc.actif = true
    AND emc.user_id IS NOT NULL
    ORDER BY emc.user_id, emc.created_at DESC
  LOOP
    BEGIN
      v_result := sync_client_modules_from_subscription(v_client_record.user_id);
      
      IF (v_result->>'success')::boolean = true THEN
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE '✅ Client %: % modules synchronisés', 
          v_client_record.user_id, 
          v_result->>'modules_count';
      ELSE
        v_error_count := v_error_count + 1;
        RAISE WARNING '❌ Client %: %', 
          v_client_record.user_id, 
          v_result->>'error';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING '❌ Erreur pour client %: %', 
        v_client_record.user_id, 
        SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ SYNCHRONISATION TERMINÉE';
  RAISE NOTICE '   → % clients synchronisés avec succès', v_synced_count;
  RAISE NOTICE '   → % erreurs', v_error_count;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END;
$$;

-- ✅ COMMENTAIRES
COMMENT ON FUNCTION sync_client_modules_from_subscription(uuid) IS 
'Synchronise automatiquement les modules actifs depuis l''abonnement du client vers modules_actifs de espaces_membres_clients';

