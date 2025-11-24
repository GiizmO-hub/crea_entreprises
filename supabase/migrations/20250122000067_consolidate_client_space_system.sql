/*
  # CONSOLIDATION COMPLÈTE DU SYSTÈME
  # Espaces Clients + Abonnements + Modules
  
  OBJECTIF: Unifier toutes les fonctions fragmentées en une seule logique cohérente
  
  PROBLÈMES RÉSOLUS:
  - Suppression de 30+ fonctions dupliquées
  - Unification de la logique de synchronisation
  - Simplification des triggers
  - Clarification du flux de données
*/

-- ============================================================================
-- PARTIE 1 : SUPPRESSION DES ANCIENNES FONCTIONS DUPLIQUÉES
-- ============================================================================

-- Supprimer toutes les versions anciennes pour repartir de zéro
DROP FUNCTION IF EXISTS create_espace_membre_from_client(uuid, uuid, text, uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS create_client_member_space() CASCADE;
DROP FUNCTION IF EXISTS create_espace_membre_admin(uuid, uuid, uuid, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS sync_client_space_modules_from_abonnement(uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_all_client_spaces_modules() CASCADE;
DROP FUNCTION IF EXISTS sync_plan_modules_to_client_spaces(uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_abonnement_to_client_space() CASCADE;
DROP FUNCTION IF EXISTS link_abonnement_to_client_spaces() CASCADE;
DROP FUNCTION IF EXISTS link_all_abonnements_to_client_spaces() CASCADE;
DROP FUNCTION IF EXISTS trigger_sync_modules_on_abonnement_change() CASCADE;
DROP FUNCTION IF EXISTS trigger_sync_modules_on_plan_modules_change() CASCADE;
DROP TRIGGER IF EXISTS trigger_link_abonnement_to_client_spaces ON abonnements CASCADE;
DROP TRIGGER IF EXISTS on_abonnement_update_sync_modules ON abonnements CASCADE;
DROP TRIGGER IF EXISTS trigger_sync_modules_on_abonnement_change ON abonnements CASCADE;
DROP TRIGGER IF EXISTS trigger_sync_modules_on_plan_modules_change ON plans_modules CASCADE;

-- ============================================================================
-- PARTIE 2 : FONCTIONS CONSOLIDÉES (UNE SEULE VERSION DE CHAQUE)
-- ============================================================================

-- ✅ FONCTION 1 : Synchronisation des modules d'un espace client depuis son plan
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(p_espace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
BEGIN
  -- Récupérer l'abonnement de l'espace client
  SELECT abonnement_id INTO v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id;
  
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ Aucun abonnement lié à l''espace client %', p_espace_id;
    RETURN;
  END IF;
  
  -- Récupérer le plan de l'abonnement
  SELECT plan_id INTO v_plan_id
  FROM abonnements
  WHERE id = v_abonnement_id
    AND statut = 'actif';
  
  IF v_plan_id IS NULL THEN
    RAISE NOTICE '⚠️ Aucun plan actif pour l''abonnement %', v_abonnement_id;
    RETURN;
  END IF;
  
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
  
  RAISE NOTICE '✅ Modules synchronisés pour l''espace client % : % modules', 
    p_espace_id, 
    jsonb_object_keys(v_modules_json)::text;
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan IS 'Synchronise les modules d''un espace client depuis son plan d''abonnement. Version consolidée unique.';

-- ✅ FONCTION 2 : Synchronisation de tous les espaces clients
CREATE OR REPLACE FUNCTION sync_all_client_spaces_modules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_record record;
  v_count integer := 0;
BEGIN
  FOR v_espace_record IN
    SELECT id FROM espaces_membres_clients WHERE abonnement_id IS NOT NULL
  LOOP
    PERFORM sync_client_modules_from_plan(v_espace_record.id);
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ % espace(s) client(s) synchronisé(s)', v_count;
END;
$$;

COMMENT ON FUNCTION sync_all_client_spaces_modules IS 'Synchronise les modules pour tous les espaces clients ayant un abonnement.';

-- ✅ FONCTION 3 : Liaison abonnement → espace client (trigger)
CREATE OR REPLACE FUNCTION link_abonnement_to_client_space()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_record record;
BEGIN
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
      
      RAISE NOTICE '✅ Abonnement % lié à l''espace client % et modules synchronisés', 
        NEW.id, v_espace_record.id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION link_abonnement_to_client_space IS 'Lie automatiquement un abonnement aux espaces clients de l''entreprise et synchronise les modules. Trigger version consolidée.';

-- ✅ FONCTION 4 : Synchronisation automatique lors du changement d'abonnement
CREATE OR REPLACE FUNCTION sync_modules_on_abonnement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Si l'abonnement est actif, synchroniser tous les espaces liés
  IF NEW.statut = 'actif' THEN
    PERFORM sync_client_modules_from_plan(emc.id)
    FROM espaces_membres_clients emc
    WHERE emc.abonnement_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_modules_on_abonnement_change IS 'Synchronise automatiquement les modules lorsque l''abonnement change. Version consolidée.';

-- ✅ FONCTION 5 : Synchronisation automatique lors du changement de plans_modules
CREATE OR REPLACE FUNCTION sync_modules_on_plan_modules_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  -- Déterminer le plan_id (INSERT ou UPDATE)
  v_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);
  
  IF v_plan_id IS NOT NULL THEN
    -- Synchroniser tous les espaces clients liés à ce plan
    PERFORM sync_client_modules_from_plan(emc.id)
    FROM espaces_membres_clients emc
    JOIN abonnements a ON a.id = emc.abonnement_id
    WHERE a.plan_id = v_plan_id
      AND a.statut = 'actif';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION sync_modules_on_plan_modules_change IS 'Synchronise automatiquement les modules lorsque les modules d''un plan changent. Version consolidée.';

-- ============================================================================
-- PARTIE 3 : TRIGGERS UNIFIÉS
-- ============================================================================

-- Trigger 1 : Lier abonnement aux espaces clients
DROP TRIGGER IF EXISTS trigger_link_abonnement_to_client_space ON abonnements;
CREATE TRIGGER trigger_link_abonnement_to_client_space
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  WHEN (NEW.statut = 'actif' AND NEW.plan_id IS NOT NULL)
  EXECUTE FUNCTION link_abonnement_to_client_space();

-- Trigger 2 : Synchroniser modules lors du changement d'abonnement
DROP TRIGGER IF EXISTS trigger_sync_modules_on_abonnement_change ON abonnements;
CREATE TRIGGER trigger_sync_modules_on_abonnement_change
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  WHEN (NEW.statut = 'actif' AND NEW.plan_id IS NOT NULL)
  EXECUTE FUNCTION sync_modules_on_abonnement_change();

-- Trigger 3 : Synchroniser modules lors du changement de plans_modules
DROP TRIGGER IF EXISTS trigger_sync_modules_on_plan_modules_change ON plans_modules;
CREATE TRIGGER trigger_sync_modules_on_plan_modules_change
  AFTER INSERT OR UPDATE OR DELETE ON plans_modules
  FOR EACH ROW
  EXECUTE FUNCTION sync_modules_on_plan_modules_change();

-- ============================================================================
-- PARTIE 4 : FONCTION DE LIAISON INITIALE (pour abonnements existants)
-- ============================================================================

-- ✅ FONCTION 6 : Lier tous les abonnements existants aux espaces clients
CREATE OR REPLACE FUNCTION link_all_existing_abonnements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_record record;
  v_linked_count integer := 0;
BEGIN
  -- Parcourir tous les abonnements actifs
  FOR v_abonnement_record IN
    SELECT id, entreprise_id, plan_id
    FROM abonnements
    WHERE statut = 'actif'
      AND plan_id IS NOT NULL
      AND entreprise_id IS NOT NULL
  LOOP
    -- Lier cet abonnement aux espaces clients de l'entreprise
    UPDATE espaces_membres_clients
    SET abonnement_id = v_abonnement_record.id,
        updated_at = NOW()
    WHERE entreprise_id = v_abonnement_record.entreprise_id
      AND (abonnement_id IS NULL OR abonnement_id != v_abonnement_record.id);
    
    -- Synchroniser les modules pour tous les espaces de cette entreprise
    PERFORM sync_client_modules_from_plan(emc.id)
    FROM espaces_membres_clients emc
    WHERE emc.entreprise_id = v_abonnement_record.entreprise_id
      AND emc.abonnement_id = v_abonnement_record.id;
    
    v_linked_count := v_linked_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ % abonnement(s) lié(s) aux espaces clients et modules synchronisés', v_linked_count;
END;
$$;

COMMENT ON FUNCTION link_all_existing_abonnements IS 'Lie tous les abonnements actifs existants aux espaces clients et synchronise les modules. À exécuter une seule fois.';

-- ============================================================================
-- PARTIE 5 : EXÉCUTION INITIALE
-- ============================================================================

-- Lier tous les abonnements existants et synchroniser les modules
SELECT link_all_existing_abonnements();
SELECT sync_all_client_spaces_modules();

-- ============================================================================
-- PARTIE 6 : VÉRIFICATION
-- ============================================================================

-- Log des fonctions créées
DO $$
BEGIN
  RAISE NOTICE '✅ CONSOLIDATION TERMINÉE';
  RAISE NOTICE '   Fonctions créées:';
  RAISE NOTICE '   - sync_client_modules_from_plan()';
  RAISE NOTICE '   - sync_all_client_spaces_modules()';
  RAISE NOTICE '   - link_abonnement_to_client_space() (trigger)';
  RAISE NOTICE '   - sync_modules_on_abonnement_change() (trigger)';
  RAISE NOTICE '   - sync_modules_on_plan_modules_change() (trigger)';
  RAISE NOTICE '   - link_all_existing_abonnements()';
  RAISE NOTICE '   Triggers créés: 3';
END $$;

