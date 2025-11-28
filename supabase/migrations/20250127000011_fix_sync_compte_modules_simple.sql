/*
  # FIX : Simplifier le comptage des modules dans sync_client_modules_from_plan
  
  PROBLÈME:
  - Erreur "invalid input syntax for type integer" lors du comptage
  - La syntaxe jsonb_object_keys est incorrecte
  
  SOLUTION:
  - Utiliser jsonb_array_length ou simplement compter en boucle
  - Simplifier le code
*/

-- Supprimer les anciennes versions
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid, uuid) CASCADE;

-- Créer la version simplifiée avec p_espace_id
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(
  p_espace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id uuid;
  v_plan_id uuid;
  v_abonnement_id uuid;
  v_entreprise_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
  v_modules_count integer := 0;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_plan] 🚀 DÉBUT - Espace ID: %', p_espace_id;
  
  -- 1. Récupérer le client_id et l'abonnement depuis l'espace membre
  SELECT client_id, entreprise_id, abonnement_id
  INTO STRICT v_client_id, v_entreprise_id, v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Espace membre non trouvé: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  -- 2. Récupérer le plan_id depuis l'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE id = v_abonnement_id AND statut = 'actif'
    LIMIT 1;
  END IF;
  
  -- Si pas d'abonnement lié, chercher l'abonnement actif le plus récent pour ce client
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE client_id = (SELECT user_id FROM espaces_membres_clients WHERE id = p_espace_id LIMIT 1)
      AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Aucun abonnement actif trouvé pour l''espace: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Aucun abonnement actif');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Client: %, Plan: %', v_client_id, v_plan_id;
  
  -- 3. Récupérer TOUS les modules du plan activés
  FOR v_module_record IN
    SELECT DISTINCT pm.module_code, pm.module_nom
    FROM plan_modules pm
    WHERE pm.plan_id = v_plan_id AND pm.activer = true
    ORDER BY pm.module_code
  LOOP
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    v_modules_count := v_modules_count + 1;
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- 4. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'tableau_de_bord', true,
    'mon_entreprise', true,
    'factures', true,
    'documents', true,
    'abonnements', true
  );
  
  -- 5. Mettre à jour l'espace membre
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = now()
  WHERE id = p_espace_id;
  
  -- Compter le nombre total de clés dans le JSON
  SELECT count(*) INTO v_modules_count
  FROM jsonb_each(v_modules_json);
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés: % modules au total', v_modules_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_actifs', v_modules_json,
    'espace_membre_id', p_espace_id,
    'modules_count', v_modules_count
  );

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Espace membre non trouvé: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  WHEN TOO_MANY_ROWS THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Plusieurs espaces membres trouvés pour: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Plusieurs espaces membres trouvés');
  WHEN OTHERS THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

-- Créer aussi la version avec p_client_id et p_plan_id
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(
  p_client_id uuid,
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_membre_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
  v_entreprise_id uuid;
  v_modules_count integer := 0;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_plan] 🚀 DÉBUT - Client: %, Plan: %', p_client_id, p_plan_id;
  
  -- 1. Récupérer l'espace membre du client (utiliser le plus récent si plusieurs)
  SELECT id, entreprise_id INTO v_espace_membre_id, v_entreprise_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Espace membre non trouvé pour client: %', p_client_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Espace membre trouvé: %, Entreprise: %', v_espace_membre_id, v_entreprise_id;
  
  -- 2. Récupérer TOUS les modules associés au plan
  FOR v_module_record IN
    SELECT DISTINCT module_code, module_nom
    FROM plan_modules
    WHERE plan_id = p_plan_id AND activer = true
    ORDER BY module_code
  LOOP
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    v_modules_count := v_modules_count + 1;
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- 3. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'tableau_de_bord', true,
    'mon_entreprise', true,
    'factures', true,
    'documents', true,
    'abonnements', true
  );
  
  -- 4. Mettre à jour l'espace membre avec les modules
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = now()
  WHERE id = v_espace_membre_id;
  
  -- Compter le nombre total
  SELECT count(*) INTO v_modules_count
  FROM jsonb_each(v_modules_json);
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés: % modules', v_modules_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_actifs', v_modules_json,
    'espace_membre_id', v_espace_membre_id,
    'modules_count', v_modules_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

SELECT '✅ Fonctions sync_client_modules_from_plan corrigées avec succès !' as resultat;

