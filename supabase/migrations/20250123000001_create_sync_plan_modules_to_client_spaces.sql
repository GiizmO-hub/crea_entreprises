/*
  # Créer fonction sync_plan_modules_to_client_spaces
  
  Cette fonction synchronise les modules d'un plan vers tous les espaces clients
  qui utilisent ce plan via leurs abonnements actifs.
  
  PROBLÈME:
  - La fonction sync_plan_modules_to_client_spaces(uuid) n'existe pas
  - Elle est appelée lors de la modification d'un plan
  
  SOLUTION:
  - Créer cette fonction pour synchroniser les modules d'un plan vers les espaces clients
  - Utiliser les abonnements actifs pour trouver les espaces concernés
*/

-- Recréer la fonction sync_plan_modules_to_client_spaces avec retour jsonb
-- La fonction existante retourne void, on la modifie pour retourner jsonb
DROP FUNCTION IF EXISTS sync_plan_modules_to_client_spaces(uuid) CASCADE;

CREATE OR REPLACE FUNCTION sync_plan_modules_to_client_spaces(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_plan_modules jsonb;
  v_abonnement_record RECORD;
  v_modules_json jsonb := '{}'::jsonb;
  v_synced_count integer := 0;
BEGIN
  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé'
    );
  END IF;

  -- Récupérer tous les modules du plan depuis plans_modules
  SELECT jsonb_object_agg(
    pm.module_code,
    jsonb_build_object(
      'module_id', pm.module_id,
      'inclus', true,
      'prix_mensuel', COALESCE(pm.prix_mensuel, 0),
      'actif', COALESCE(pm.actif, true)
    )
  ) INTO v_modules_json
  FROM plans_modules pm
  WHERE pm.plan_id = p_plan_id
    AND pm.inclus = true;

  -- Si aucun module, retourner succès sans modifier
  IF v_modules_json IS NULL OR v_modules_json = '{}'::jsonb THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Aucun module à synchroniser',
      'synced_count', 0
    );
  END IF;

  -- Parcourir tous les abonnements actifs utilisant ce plan
  FOR v_abonnement_record IN
    SELECT DISTINCT
      ab.id as abonnement_id,
      ab.entreprise_id,
      emc.id as espace_id,
      emc.client_id
    FROM abonnements ab
    INNER JOIN espaces_membres_clients emc ON emc.entreprise_id = ab.entreprise_id
    WHERE ab.plan_id = p_plan_id
      AND (ab.actif = true OR ab.statut = 'actif')
      AND emc.actif = true
  LOOP
    -- Mettre à jour les modules_actifs de l'espace membre
    UPDATE espaces_membres_clients
    SET 
      modules_actifs = v_modules_json,
      abonnement_id = v_abonnement_record.abonnement_id,
      updated_at = NOW()
    WHERE id = v_abonnement_record.espace_id;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Modules synchronisés vers %s espace(s) client(s)', v_synced_count),
    'synced_count', v_synced_count,
    'modules', v_modules_json
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

COMMENT ON FUNCTION sync_plan_modules_to_client_spaces IS 'Synchronise les modules d''un plan vers tous les espaces clients qui utilisent ce plan via leurs abonnements actifs';

GRANT EXECUTE ON FUNCTION sync_plan_modules_to_client_spaces(uuid) TO authenticated;

-- Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ Fonction sync_plan_modules_to_client_spaces créée avec succès ! ✅✅✅';
END $$;

