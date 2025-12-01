-- CRM Auto Tags
-- Ajoute automatiquement des tags aux clients en fonction :
-- - des activités CRM (factures créées, paiements reçus, etc.)
-- - des changements de statut du client
--
-- Utilise la colonne tags déjà existante sur public.clients

-- 1. Fonction utilitaire pour ajouter un tag à un client (sans doublon)
CREATE OR REPLACE FUNCTION add_client_tag(
  p_client_id uuid,
  p_tag text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tags text[];
BEGIN
  IF p_client_id IS NULL OR p_tag IS NULL OR length(trim(p_tag)) = 0 THEN
    RETURN;
  END IF;

  SELECT tags INTO v_tags
  FROM clients
  WHERE id = p_client_id;

  -- Si aucun tableau de tags, en créer un
  IF v_tags IS NULL THEN
    UPDATE clients
    SET tags = ARRAY[trim(p_tag)]
    WHERE id = p_client_id;
    RETURN;
  END IF;

  -- Si le tag n'existe pas encore, l'ajouter
  IF NOT (trim(p_tag) = ANY(v_tags)) THEN
    UPDATE clients
    SET tags = array_append(tags, trim(p_tag))
    WHERE id = p_client_id;
  END IF;
END;
$$;


-- 2. Trigger : tags basés sur les activités CRM auto (factures, paiements, etc.)
CREATE OR REPLACE FUNCTION trigger_add_tags_from_crm_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id uuid;
  v_sujet text;
  v_type text;
BEGIN
  v_client_id := NEW.client_id;
  v_sujet := COALESCE(NEW.sujet, '');
  v_type := COALESCE(NEW.type_activite, '');

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tag générique selon le type d'activité
  IF v_type = 'appel' THEN
    PERFORM add_client_tag(v_client_id, 'appel');
  ELSIF v_type = 'email' THEN
    PERFORM add_client_tag(v_client_id, 'email');
  ELSIF v_type = 'reunion' THEN
    PERFORM add_client_tag(v_client_id, 'reunion');
  ELSIF v_type = 'tache' THEN
    PERFORM add_client_tag(v_client_id, 'tache');
  ELSIF v_type = 'note' THEN
    PERFORM add_client_tag(v_client_id, 'note');
  END IF;

  -- Tags plus métier selon le sujet (ceux créés automatiquement dans 20250131000022)
  IF v_sujet ILIKE 'Facture créée %' THEN
    PERFORM add_client_tag(v_client_id, 'facturation');
    PERFORM add_client_tag(v_client_id, 'client_facture');
  ELSIF v_sujet ILIKE 'Paiement reçu %' THEN
    PERFORM add_client_tag(v_client_id, 'paiement');
    PERFORM add_client_tag(v_client_id, 'client_payeur');
  ELSIF v_sujet ILIKE 'Statut client mis à jour %' THEN
    PERFORM add_client_tag(v_client_id, 'changement_statut');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_crm_activity_add_tags ON crm_activites;
CREATE TRIGGER trigger_crm_activity_add_tags
  AFTER INSERT ON crm_activites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_add_tags_from_crm_activity();


-- 3. Trigger : tags basés sur le statut du client
CREATE OR REPLACE FUNCTION trigger_add_tags_from_client_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_statut text;
BEGIN
  v_statut := COALESCE(NEW.statut, '');

  -- Si le statut a changé, ajouter un tag correspondant
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF v_statut = 'actif' THEN
      PERFORM add_client_tag(NEW.id, 'client_actif');
    ELSIF v_statut = 'en_attente' THEN
      PERFORM add_client_tag(NEW.id, 'client_en_attente');
    ELSIF v_statut = 'archive' OR v_statut = 'inactif' THEN
      PERFORM add_client_tag(NEW.id, 'client_inactif');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_client_add_status_tags ON clients;
CREATE TRIGGER trigger_client_add_status_tags
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION trigger_add_tags_from_client_status();


COMMENT ON FUNCTION add_client_tag IS 'Ajoute un tag dans clients.tags sans doublon';
COMMENT ON FUNCTION trigger_add_tags_from_crm_activity IS 'Alimente automatiquement les tags client à partir des activités CRM (factures, paiements, etc.)';
COMMENT ON FUNCTION trigger_add_tags_from_client_status IS 'Alimente automatiquement les tags client à partir des changements de statut';

SELECT '✅ Migration CRM Auto Tags appliquée avec succès !' as status;


