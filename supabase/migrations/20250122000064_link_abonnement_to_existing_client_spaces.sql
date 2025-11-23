/*
  # Lier les abonnements aux espaces clients existants et synchroniser les modules
  
  PROBLÈME:
  - Quand un abonnement est créé APRÈS l'espace client, l'abonnement_id n'est pas lié
  - Le trigger link_abonnement_to_client_space() ne s'exécute que BEFORE INSERT
  - Résultat: Les modules ne sont jamais synchronisés
  
  SOLUTION:
  - Créer un trigger AFTER INSERT/UPDATE sur abonnements pour lier automatiquement
  - Lier l'abonnement aux espaces clients de l'entreprise
  - Synchroniser automatiquement les modules
*/

-- ✅ 1. Fonction pour lier un abonnement aux espaces clients de l'entreprise
CREATE OR REPLACE FUNCTION link_abonnement_to_client_spaces()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_espace_record record;
BEGIN
  -- Si l'abonnement est actif et a un plan_id
  IF NEW.statut = 'actif' AND NEW.plan_id IS NOT NULL AND NEW.entreprise_id IS NOT NULL THEN
    -- Trouver tous les espaces clients de cette entreprise qui n'ont pas encore d'abonnement
    -- ou qui ont un abonnement inactif
    FOR v_espace_record IN
      SELECT emc.id
      FROM espaces_membres_clients emc
      WHERE emc.entreprise_id = NEW.entreprise_id
        AND (
          emc.abonnement_id IS NULL
          OR EXISTS (
            SELECT 1 FROM abonnements a
            WHERE a.id = emc.abonnement_id
            AND (a.statut != 'actif' OR a.plan_id IS NULL)
          )
        )
    LOOP
      -- Lier l'abonnement actif à cet espace
      UPDATE espaces_membres_clients
      SET abonnement_id = NEW.id,
          updated_at = NOW()
      WHERE id = v_espace_record.id;
      
      -- ✅ Synchroniser immédiatement les modules depuis le plan
      PERFORM sync_client_space_modules_from_abonnement(v_espace_record.id);
      
      RAISE NOTICE '✅ Abonnement % lié à l''espace client % et modules synchronisés', NEW.id, v_espace_record.id;
    END LOOP;
    
    -- Aussi mettre à jour les espaces qui ont déjà cet abonnement (au cas où)
    FOR v_espace_record IN
      SELECT id
      FROM espaces_membres_clients
      WHERE abonnement_id = NEW.id
    LOOP
      -- Synchroniser les modules pour ces espaces aussi
      PERFORM sync_client_space_modules_from_abonnement(v_espace_record.id);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION link_abonnement_to_client_spaces IS 'Lie automatiquement un abonnement aux espaces clients de l''entreprise et synchronise les modules.';

-- Créer le trigger sur abonnements
DROP TRIGGER IF EXISTS trigger_link_abonnement_to_client_spaces ON abonnements;
CREATE TRIGGER trigger_link_abonnement_to_client_spaces
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  EXECUTE FUNCTION link_abonnement_to_client_spaces();

-- ✅ 2. Fonction pour lier tous les abonnements existants aux espaces clients
CREATE OR REPLACE FUNCTION link_all_abonnements_to_client_spaces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnement_record record;
  v_linked_count integer := 0;
BEGIN
  -- Parcourir tous les abonnements actifs
  FOR v_abonnement_record IN
    SELECT id, entreprise_id, plan_id, statut
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
      AND (
        abonnement_id IS NULL
        OR abonnement_id != v_abonnement_record.id
      );
    
    -- Synchroniser les modules pour tous les espaces de cette entreprise
    PERFORM sync_client_space_modules_from_abonnement(emc.id)
    FROM espaces_membres_clients emc
    WHERE emc.entreprise_id = v_abonnement_record.entreprise_id
      AND emc.abonnement_id = v_abonnement_record.id;
    
    v_linked_count := v_linked_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ % abonnement(s) lié(s) aux espaces clients et modules synchronisés', v_linked_count;
END;
$$;

COMMENT ON FUNCTION link_all_abonnements_to_client_spaces IS 'Lie tous les abonnements actifs existants aux espaces clients et synchronise les modules.';

-- ✅ 3. Exécuter la liaison pour les abonnements existants
SELECT link_all_abonnements_to_client_spaces();

-- ✅ 4. Synchroniser aussi tous les modules après la liaison
SELECT sync_all_client_spaces_modules();

