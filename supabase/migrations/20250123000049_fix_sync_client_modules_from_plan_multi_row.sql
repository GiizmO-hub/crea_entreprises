/*
  # Fix: Erreur "query returned more than one row" dans sync_client_modules_from_plan
  
  PROBLÈME:
  - Les requêtes SELECT ... INTO peuvent retourner plusieurs lignes
  - Même avec LIMIT 1, PostgreSQL peut lever une erreur
  
  SOLUTION:
  - Utiliser MAX() ou une agrégation pour garantir une seule valeur
  - Ajouter des vérifications supplémentaires
*/

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
  
  -- Récupérer l'abonnement de l'espace client (utiliser MAX pour garantir une seule valeur)
  SELECT MAX(abonnement_id) INTO v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id;
  
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ [sync_client_modules_from_plan] Aucun abonnement lié à l''espace client %', p_espace_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ [sync_client_modules_from_plan] Abonnement trouvé: %', v_abonnement_id;
  
  -- Récupérer le plan de l'abonnement (utiliser MAX pour garantir une seule valeur)
  SELECT MAX(plan_id) INTO v_plan_id
  FROM abonnements
  WHERE id = v_abonnement_id
    AND statut = 'actif';
  
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

COMMENT ON FUNCTION sync_client_modules_from_plan IS 'Synchronise les modules d''un espace client depuis son plan d''abonnement - CORRIGÉ pour éviter "more than one row"';


