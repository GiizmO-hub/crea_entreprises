/*
  # Créer fonction sync_plan_modules_to_client_spaces
  
  Cette fonction est appelée lors de la modification d'un plan
  pour synchroniser les modules vers tous les espaces clients concernés.
*/

-- Supprimer l'ancienne version si elle existe
DROP FUNCTION IF EXISTS sync_plan_modules_to_client_spaces(uuid) CASCADE;

-- Créer la fonction qui synchronise les modules d'un plan vers les espaces clients
CREATE OR REPLACE FUNCTION sync_plan_modules_to_client_spaces(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_modules_json jsonb := '{}'::jsonb;
  v_abonnement_record RECORD;
  v_synced_count integer := 0;
  v_espace_record RECORD;
BEGIN
  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé'
    );
  END IF;

  -- Récupérer tous les modules du plan depuis plans_modules
  SELECT COALESCE(
    jsonb_object_agg(
      pm.module_code,
      jsonb_build_object(
        'module_id', pm.module_id,
        'inclus', true,
        'prix_mensuel', COALESCE(pm.prix_mensuel, 0),
        'actif', COALESCE(pm.actif, true)
      )
    ),
    '{}'::jsonb
  ) INTO v_modules_json
  FROM plans_modules pm
  WHERE pm.plan_id = p_plan_id
    AND COALESCE(pm.inclus, true) = true;

  -- Si aucun module, synchroniser les modules de base
  IF v_modules_json IS NULL OR v_modules_json = '{}'::jsonb THEN
    v_modules_json := jsonb_build_object(
      'tableau_de_bord', jsonb_build_object('actif', true, 'inclus', true),
      'mon_entreprise', jsonb_build_object('actif', true, 'inclus', true)
    );
  END IF;

  -- Trouver tous les espaces clients liés à ce plan via leurs abonnements
  FOR v_espace_record IN
    SELECT DISTINCT
      emc.id as espace_id,
      emc.entreprise_id,
      ab.id as abonnement_id
    FROM espaces_membres_clients emc
    INNER JOIN abonnements ab ON (
      ab.entreprise_id = emc.entreprise_id 
      OR ab.client_id = emc.user_id
    )
    WHERE ab.plan_id = p_plan_id
      AND (ab.statut = 'actif' OR ab.statut IS NULL)
      AND emc.actif = true
  LOOP
    -- Mettre à jour les modules_actifs de l'espace membre
    UPDATE espaces_membres_clients
    SET 
      modules_actifs = v_modules_json,
      abonnement_id = COALESCE(abonnement_id, v_espace_record.abonnement_id),
      updated_at = NOW()
    WHERE id = v_espace_record.espace_id;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Modules synchronisés vers %s espace(s) client(s)', v_synced_count),
    'synced_count', v_synced_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION sync_plan_modules_to_client_spaces IS 
  'Synchronise les modules d''un plan vers tous les espaces clients qui utilisent ce plan via leurs abonnements actifs.';

GRANT EXECUTE ON FUNCTION sync_plan_modules_to_client_spaces(uuid) TO authenticated;

-- Vérifier que la fonction est bien créée
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'sync_plan_modules_to_client_spaces'
    AND pronargs = 1
  ) THEN
    RAISE NOTICE '✅ Fonction sync_plan_modules_to_client_spaces créée avec succès';
  ELSE
    RAISE WARNING '❌ La fonction n''a pas été créée correctement';
  END IF;
END $$;

