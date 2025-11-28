/*
  # Synchronisation automatique des modules lors des changements d'abonnement
  
  Cette migration crée un trigger qui synchronise automatiquement les modules
  de l'espace client quand :
  1. Un nouvel abonnement est créé/modifié
  2. Le plan d'un abonnement change
  3. Les modules d'un plan sont modifiés
  
  Elle synchronise aussi automatiquement tous les espaces clients existants.
*/

-- Fonction pour synchroniser les modules d'un espace client depuis son abonnement
CREATE OR REPLACE FUNCTION sync_client_space_modules_from_abonnement(p_espace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb;
  v_module_record record;
BEGIN
  -- Récupérer l'abonnement associé à l'espace
  SELECT abonnement_id INTO v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id;
  
  IF v_abonnement_id IS NULL THEN
    -- Pas d'abonnement, garder les modules existants ou modules par défaut
    RETURN;
  END IF;
  
  -- Récupérer le plan de l'abonnement
  SELECT plan_id INTO v_plan_id
  FROM abonnements
  WHERE id = v_abonnement_id
    AND statut = 'actif';
  
  IF v_plan_id IS NULL THEN
    -- Pas de plan actif, garder les modules existants
    RETURN;
  END IF;
  
  -- Construire le JSON des modules actifs depuis le plan
  v_modules_json := '{}'::jsonb;
  
  FOR v_module_record IN
    SELECT DISTINCT pm.module_code
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
      'true'::jsonb,
      true
    );
  END LOOP;
  
  -- Mettre à jour l'espace client avec les modules du plan
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = NOW()
  WHERE id = p_espace_id;
  
  RAISE NOTICE '✅ Modules synchronisés pour espace % avec plan %', p_espace_id, v_plan_id;
END;
$$;

COMMENT ON FUNCTION sync_client_space_modules_from_abonnement IS 'Synchronise automatiquement les modules d''un espace client depuis son plan d''abonnement actif.';

-- Fonction pour synchroniser tous les espaces clients
CREATE OR REPLACE FUNCTION sync_all_client_spaces_modules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_espace_record record;
  v_synced_count integer := 0;
BEGIN
  -- Parcourir tous les espaces clients
  FOR v_espace_record IN
    SELECT id, abonnement_id
    FROM espaces_membres_clients
    WHERE abonnement_id IS NOT NULL
  LOOP
    -- Synchroniser les modules pour cet espace
    PERFORM sync_client_space_modules_from_abonnement(v_espace_record.id);
    v_synced_count := v_synced_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ % espaces clients synchronisés avec leurs plans', v_synced_count;
END;
$$;

COMMENT ON FUNCTION sync_all_client_spaces_modules IS 'Synchronise tous les espaces clients avec les modules de leurs plans d''abonnement actifs.';

-- Trigger : Synchroniser les modules quand un abonnement est créé ou modifié
CREATE OR REPLACE FUNCTION trigger_sync_modules_on_abonnement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_espace_record record;
BEGIN
  -- Si le plan_id a changé ou si c'est un nouvel abonnement, synchroniser les espaces
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.statut IS DISTINCT FROM NEW.statut)) THEN
    -- Si l'abonnement est actif, synchroniser tous les espaces qui y sont associés
    IF NEW.statut = 'actif' AND NEW.plan_id IS NOT NULL THEN
      FOR v_espace_record IN
        SELECT id
        FROM espaces_membres_clients
        WHERE abonnement_id = NEW.id
      LOOP
        PERFORM sync_client_space_modules_from_abonnement(v_espace_record.id);
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table abonnements
DROP TRIGGER IF EXISTS trigger_sync_modules_on_abonnement_change ON abonnements;
CREATE TRIGGER trigger_sync_modules_on_abonnement_change
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_modules_on_abonnement_change();

-- Trigger : Synchroniser les modules quand les modules d'un plan changent
CREATE OR REPLACE FUNCTION trigger_sync_modules_on_plan_modules_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_espace_record record;
  v_plan_id uuid;
BEGIN
  -- Déterminer le plan_id affecté
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.plan_id;
  ELSE
    v_plan_id := NEW.plan_id;
  END IF;
  
  -- Synchroniser tous les espaces qui utilisent des abonnements avec ce plan
  FOR v_espace_record IN
    SELECT emc.id
    FROM espaces_membres_clients emc
    JOIN abonnements a ON a.id = emc.abonnement_id
    WHERE a.plan_id = v_plan_id
      AND a.statut = 'actif'
  LOOP
    PERFORM sync_client_space_modules_from_abonnement(v_espace_record.id);
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Créer le trigger sur la table plans_modules
DROP TRIGGER IF EXISTS trigger_sync_modules_on_plan_modules_change ON plans_modules;
CREATE TRIGGER trigger_sync_modules_on_plan_modules_change
  AFTER INSERT OR UPDATE OR DELETE ON plans_modules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_modules_on_plan_modules_change();

-- Synchroniser automatiquement tous les espaces clients existants
SELECT sync_all_client_spaces_modules();

COMMENT ON FUNCTION trigger_sync_modules_on_abonnement_change IS 'Synchronise automatiquement les modules des espaces clients quand un abonnement est créé ou modifié.';
COMMENT ON FUNCTION trigger_sync_modules_on_plan_modules_change IS 'Synchronise automatiquement les modules des espaces clients quand les modules d''un plan sont modifiés.';




