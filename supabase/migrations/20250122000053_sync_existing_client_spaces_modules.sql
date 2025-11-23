/*
  # Synchronisation des modules pour les espaces clients existants
  
  Cette migration synchronise les modules_actifs de tous les espaces clients
  existants avec les modules inclus dans leurs plans d'abonnement.
*/

-- Fonction pour synchroniser tous les espaces clients avec leurs plans
CREATE OR REPLACE FUNCTION sync_all_client_spaces_modules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_espace_record record;
  v_modules_json jsonb;
  v_module_record record;
  v_synced_count integer := 0;
BEGIN
  -- Parcourir tous les espaces clients avec un abonnement actif
  FOR v_espace_record IN
    SELECT 
      emc.id as espace_id,
      emc.client_id,
      emc.entreprise_id,
      emc.abonnement_id,
      a.plan_id
    FROM espaces_membres_clients emc
    JOIN abonnements a ON a.id = emc.abonnement_id
    WHERE a.statut = 'actif'
      AND a.plan_id IS NOT NULL
  LOOP
    -- Construire le JSON des modules actifs pour ce plan
    v_modules_json := '{}'::jsonb;
    
    FOR v_module_record IN
      SELECT pm.module_code
      FROM plans_modules pm
      JOIN modules_activation ma ON ma.module_code = pm.module_code
      WHERE pm.plan_id = v_espace_record.plan_id
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

    -- Mettre à jour l'espace client avec les modules du plan
    UPDATE espaces_membres_clients
    SET modules_actifs = v_modules_json,
        updated_at = NOW()
    WHERE id = v_espace_record.espace_id;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RAISE NOTICE '✅ % espaces clients synchronisés avec leurs plans', v_synced_count;
END;
$$;

-- Exécuter la synchronisation
SELECT sync_all_client_spaces_modules();

-- Nettoyer la fonction si on ne veut pas la garder (optionnel)
-- DROP FUNCTION IF EXISTS sync_all_client_spaces_modules();

COMMENT ON FUNCTION sync_all_client_spaces_modules IS 'Synchronise tous les espaces clients existants avec les modules inclus dans leurs plans d''abonnement actifs.';

