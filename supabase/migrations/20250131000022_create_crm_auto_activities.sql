-- Migration pour créer automatiquement des activités CRM basées sur les actions des clients
-- Les activités sont créées uniquement pour les clients avec crm_actif = true

-- 1. Fonction pour créer une activité CRM automatique
CREATE OR REPLACE FUNCTION create_crm_activity_auto(
  p_entreprise_id uuid,
  p_client_id uuid,
  p_type_activite text,
  p_sujet text,
  p_description text DEFAULT NULL,
  p_date_activite timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id uuid;
  v_crm_actif boolean;
BEGIN
  -- Vérifier si le client a le CRM activé
  SELECT crm_actif INTO v_crm_actif
  FROM clients
  WHERE id = p_client_id AND entreprise_id = p_entreprise_id;
  
  -- Si le client n'a pas le CRM activé, ne rien faire
  IF v_crm_actif IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  
  -- Créer l'activité
  INSERT INTO crm_activites (
    entreprise_id,
    client_id,
    type_activite,
    sujet,
    description,
    date_activite,
    statut,
    priorite
  )
  VALUES (
    p_entreprise_id,
    p_client_id,
    p_type_activite,
    p_sujet,
    p_description,
    p_date_activite,
    'terminee',
    'normale'
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- 2. Trigger pour créer une activité CRM lors de la création d'une facture
CREATE OR REPLACE FUNCTION trigger_create_crm_activity_on_facture()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id uuid;
  v_entreprise_id uuid;
  v_numero_facture text;
  v_montant_ttc numeric;
BEGIN
  -- Récupérer les informations de la facture
  v_client_id := NEW.client_id;
  v_entreprise_id := NEW.entreprise_id;
  v_numero_facture := NEW.numero;
  v_montant_ttc := NEW.montant_ttc;
  
  -- Si la facture a un client et que le client a le CRM activé, créer une activité
  IF v_client_id IS NOT NULL AND v_entreprise_id IS NOT NULL THEN
    PERFORM create_crm_activity_auto(
      v_entreprise_id,
      v_client_id,
      'note',
      'Facture créée : ' || COALESCE(v_numero_facture, 'N/A'),
      'Facture créée pour un montant de ' || COALESCE(v_montant_ttc::text, '0') || ' €',
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_crm_activity_facture ON factures;
CREATE TRIGGER trigger_crm_activity_facture
  AFTER INSERT ON factures
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_crm_activity_on_facture();

-- 3. Trigger pour créer une activité CRM lors d'un paiement
CREATE OR REPLACE FUNCTION trigger_create_crm_activity_on_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id uuid;
  v_entreprise_id uuid;
  v_montant_ttc numeric;
  v_statut text;
BEGIN
  -- Récupérer les informations du paiement
  v_entreprise_id := NEW.entreprise_id;
  v_montant_ttc := NEW.montant_ttc;
  v_statut := NEW.statut;
  
  -- Si le paiement est validé (payé), récupérer le client associé
  IF v_statut = 'paye' AND v_entreprise_id IS NOT NULL THEN
    -- Récupérer le client depuis l'entreprise
    SELECT id INTO v_client_id
    FROM clients
    WHERE entreprise_id = v_entreprise_id
      AND crm_actif = true
    LIMIT 1;
    
    -- Si un client avec CRM activé est trouvé, créer une activité
    IF v_client_id IS NOT NULL THEN
      PERFORM create_crm_activity_auto(
        v_entreprise_id,
        v_client_id,
        'note',
        'Paiement reçu : ' || COALESCE(v_montant_ttc::text, '0') || ' €',
        'Paiement validé pour l''entreprise',
        NEW.updated_at
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_crm_activity_paiement ON paiements;
CREATE TRIGGER trigger_crm_activity_paiement
  AFTER UPDATE ON paiements
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut AND NEW.statut = 'paye')
  EXECUTE FUNCTION trigger_create_crm_activity_on_paiement();

-- 4. Trigger pour créer une activité CRM lors de la mise à jour du statut d'un client
CREATE OR REPLACE FUNCTION trigger_create_crm_activity_on_client_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si le statut du client change et que le CRM est activé, créer une activité
  IF NEW.crm_actif = true AND OLD.statut IS DISTINCT FROM NEW.statut THEN
    PERFORM create_crm_activity_auto(
      NEW.entreprise_id,
      NEW.id,
      'note',
      'Statut client mis à jour : ' || NEW.statut,
      'Le statut du client a été modifié de "' || COALESCE(OLD.statut, 'inconnu') || '" à "' || NEW.statut || '"',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_crm_activity_client_status ON clients;
CREATE TRIGGER trigger_crm_activity_client_status
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION trigger_create_crm_activity_on_client_status();

-- 5. Commentaires pour documentation
COMMENT ON FUNCTION create_crm_activity_auto IS 'Crée automatiquement une activité CRM pour un client avec crm_actif = true';
COMMENT ON FUNCTION trigger_create_crm_activity_on_facture IS 'Crée automatiquement une activité CRM lors de la création d''une facture';
COMMENT ON FUNCTION trigger_create_crm_activity_on_paiement IS 'Crée automatiquement une activité CRM lors d''un paiement validé';
COMMENT ON FUNCTION trigger_create_crm_activity_on_client_status IS 'Crée automatiquement une activité CRM lors de la mise à jour du statut d''un client';

SELECT '✅ Migration CRM Auto Activities appliquée avec succès !' as status;

