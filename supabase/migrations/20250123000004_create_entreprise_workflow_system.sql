/*
  # Système de workflow et paiement pour création d'entreprise
  
  PROBLÈME:
  - Besoin de gérer 50+ entreprises
  - Système de validation par paiement
  - Workflow automatisé de création
  - Génération de factures automatiques
  - Envoi d'email uniquement après paiement validé
  
  SOLUTION:
  - Ajouter statut_paiement aux entreprises
  - Créer table demandes_creation_entreprises
  - Créer workflow automatisé
  - Lier aux paiements existants
*/

-- ============================================================================
-- PARTIE 1 : Ajouter statut de paiement aux entreprises
-- ============================================================================

-- Ajouter colonne statut_paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises'
    AND column_name = 'statut_paiement'
  ) THEN
    ALTER TABLE entreprises
    ADD COLUMN statut_paiement text DEFAULT 'non_requis'
    CHECK (statut_paiement IN ('non_requis', 'en_attente', 'paye', 'refuse', 'rembourse'));
    
    COMMENT ON COLUMN entreprises.statut_paiement IS 'Statut du paiement pour la création de l''entreprise';
  END IF;
END $$;

-- Ajouter colonne date_validation_paiement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises'
    AND column_name = 'date_validation_paiement'
  ) THEN
    ALTER TABLE entreprises
    ADD COLUMN date_validation_paiement timestamptz;
    
    COMMENT ON COLUMN entreprises.date_validation_paiement IS 'Date de validation du paiement pour la création de l''entreprise';
  END IF;
END $$;

-- Ajouter colonne facture_id (lien vers facture de création)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises'
    AND column_name = 'facture_creation_id'
  ) THEN
    ALTER TABLE entreprises
    ADD COLUMN facture_creation_id uuid REFERENCES factures(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN entreprises.facture_creation_id IS 'ID de la facture générée lors de la création de l''entreprise';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Table des demandes de création d'entreprises
-- ============================================================================

CREATE TABLE IF NOT EXISTS demandes_creation_entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  
  -- Informations de la demande
  nom_entreprise text NOT NULL,
  forme_juridique text DEFAULT 'SARL',
  email_contact text NOT NULL,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  capital numeric DEFAULT 0,
  
  -- Workflow
  statut text DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_attente_paiement', 'paiement_valide', 'en_creation', 'validee', 'refusee', 'annulee')),
  
  -- Paiement
  montant_ht numeric(12,2) DEFAULT 0,
  montant_ttc numeric(12,2) DEFAULT 0,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  paiement_id uuid REFERENCES paiements(id) ON DELETE SET NULL,
  statut_paiement text DEFAULT 'en_attente'
    CHECK (statut_paiement IN ('en_attente', 'paye', 'refuse', 'rembourse')),
  
  -- Dates
  date_demande timestamptz DEFAULT now(),
  date_validation_paiement timestamptz,
  date_creation timestamptz,
  date_validation timestamptz,
  
  -- Métadonnées
  notes_admin text,
  donnees_json jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_demandes_creation_user_id ON demandes_creation_entreprises(user_id);
CREATE INDEX IF NOT EXISTS idx_demandes_creation_statut ON demandes_creation_entreprises(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_creation_statut_paiement ON demandes_creation_entreprises(statut_paiement);
CREATE INDEX IF NOT EXISTS idx_demandes_creation_date_demande ON demandes_creation_entreprises(date_demande);

-- RLS Policies
ALTER TABLE demandes_creation_entreprises ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs voient leurs propres demandes
CREATE POLICY "Users can view own creation requests"
  ON demandes_creation_entreprises FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_admin_user_simple());

-- Les utilisateurs peuvent créer leurs demandes
CREATE POLICY "Users can create own creation requests"
  ON demandes_creation_entreprises FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Les admins peuvent modifier toutes les demandes
CREATE POLICY "Admins can update all creation requests"
  ON demandes_creation_entreprises FOR UPDATE
  TO authenticated
  USING (is_admin_user_simple() OR auth.uid() = user_id)
  WITH CHECK (is_admin_user_simple() OR auth.uid() = user_id);

-- ============================================================================
-- PARTIE 3 : Fonction pour créer automatiquement une demande
-- ============================================================================

CREATE OR REPLACE FUNCTION create_demande_creation_entreprise(
  p_nom_entreprise text,
  p_forme_juridique text DEFAULT 'SARL',
  p_email_contact text,
  p_telephone text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_capital numeric DEFAULT 0,
  p_montant_ht numeric DEFAULT 0,
  p_montant_ttc numeric DEFAULT 0,
  p_notes_admin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_demande_id uuid;
  v_facture_id uuid;
  v_paiement_id uuid;
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Récupérer l'utilisateur connecté
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;
  
  -- Créer la demande
  INSERT INTO demandes_creation_entreprises (
    user_id,
    nom_entreprise,
    forme_juridique,
    email_contact,
    telephone,
    adresse,
    code_postal,
    ville,
    capital,
    montant_ht,
    montant_ttc,
    notes_admin,
    statut,
    statut_paiement
  ) VALUES (
    v_user_id,
    p_nom_entreprise,
    p_forme_juridique,
    p_email_contact,
    p_telephone,
    p_adresse,
    p_code_postal,
    p_ville,
    p_capital,
    p_montant_ht,
    p_montant_ttc,
    p_notes_admin,
    CASE 
      WHEN p_montant_ttc > 0 THEN 'en_attente_paiement'
      ELSE 'nouvelle'
    END,
    CASE 
      WHEN p_montant_ttc > 0 THEN 'en_attente'
      ELSE NULL
    END
  )
  RETURNING id INTO v_demande_id;
  
  -- Si un montant est requis, créer la facture
  IF p_montant_ttc > 0 THEN
    -- Générer un numéro de facture unique
    DECLARE
      v_numero_facture text;
      v_annee text;
    BEGIN
      v_annee := EXTRACT(YEAR FROM CURRENT_DATE)::text;
      SELECT 'FACT-' || v_annee || '-' || LPAD(COALESCE(
        (SELECT MAX(CAST(SUBSTRING(numero FROM '\d+$') AS integer)) 
         FROM factures 
         WHERE numero LIKE 'FACT-' || v_annee || '-%'), 0) + 1, 6, '0')
      INTO v_numero_facture;
      
      -- Créer la facture
      INSERT INTO factures (
        user_id,
        numero,
        type,
        date_emission,
        montant_ht,
        tva,
        montant_ttc,
        statut,
        notes
      ) VALUES (
        v_user_id,
        v_numero_facture,
        'facture',
        CURRENT_DATE,
        p_montant_ht,
        p_montant_ttc - p_montant_ht,
        p_montant_ttc,
        'brouillon',
        format('Facture de création pour l''entreprise: %s', p_nom_entreprise)
      )
      RETURNING id INTO v_facture_id;
      
      -- Mettre à jour la demande avec l'ID de la facture
      UPDATE demandes_creation_entreprises
      SET facture_id = v_facture_id
      WHERE id = v_demande_id;
      
      -- Créer un paiement en attente
      INSERT INTO paiements (
        user_id,
        type_paiement,
        reference_id,
        numero_reference,
        montant_ht,
        montant_tva,
        montant_ttc,
        methode_paiement,
        statut,
        date_echeance
      ) VALUES (
        v_user_id,
        'autre',
        v_facture_id,
        v_numero_facture,
        p_montant_ht,
        p_montant_ttc - p_montant_ht,
        p_montant_ttc,
        'stripe',
        'en_attente',
        CURRENT_DATE + INTERVAL '30 days'
      )
      RETURNING id INTO v_paiement_id;
      
      -- Mettre à jour la demande avec l'ID du paiement
      UPDATE demandes_creation_entreprises
      SET paiement_id = v_paiement_id
      WHERE id = v_demande_id;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'demande_id', v_demande_id,
    'facture_id', v_facture_id,
    'paiement_id', v_paiement_id,
    'message', CASE 
      WHEN p_montant_ttc > 0 THEN 'Demande créée. En attente de paiement.'
      ELSE 'Demande créée. En attente de validation.'
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_demande_creation_entreprise IS 'Crée une demande de création d''entreprise avec facture et paiement automatiques si montant requis';

GRANT EXECUTE ON FUNCTION create_demande_creation_entreprise TO authenticated;

-- ============================================================================
-- PARTIE 4 : Workflow automatisé - Validation du paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION valider_paiement_demande_creation(
  p_demande_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_demande RECORD;
  v_entreprise_id uuid;
  v_result jsonb;
BEGIN
  -- Vérifier les permissions (admin uniquement)
  IF NOT is_admin_user_simple() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Admin requis'
    );
  END IF;
  
  -- Récupérer la demande
  SELECT * INTO v_demande
  FROM demandes_creation_entreprises
  WHERE id = p_demande_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Demande non trouvée'
    );
  END IF;
  
  -- Vérifier que le paiement est bien payé
  IF v_demande.statut_paiement != 'paye' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Le paiement n''est pas validé (statut actuel: %s)', v_demande.statut_paiement)
    );
  END IF;
  
  -- Créer l'entreprise
  INSERT INTO entreprises (
    nom,
    forme_juridique,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    capital,
    statut,
    statut_paiement,
    date_validation_paiement,
    facture_creation_id,
    user_id
  ) VALUES (
    v_demande.nom_entreprise,
    v_demande.forme_juridique,
    v_demande.email_contact,
    v_demande.telephone,
    v_demande.adresse,
    v_demande.code_postal,
    v_demande.ville,
    v_demande.capital,
    'active',
    'paye',
    now(),
    v_demande.facture_id,
    v_demande.user_id
  )
  RETURNING id INTO v_entreprise_id;
  
  -- Mettre à jour la demande
  UPDATE demandes_creation_entreprises
  SET 
    entreprise_id = v_entreprise_id,
    statut = 'validee',
    date_creation = now(),
    date_validation = now(),
    updated_at = now()
  WHERE id = p_demande_id;
  
  -- Mettre à jour le statut de la facture
  IF v_demande.facture_id IS NOT NULL THEN
    UPDATE factures
    SET statut = 'payee'
    WHERE id = v_demande.facture_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'message', 'Entreprise créée avec succès après validation du paiement'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_demande_creation IS 'Valide le paiement et crée automatiquement l''entreprise';

GRANT EXECUTE ON FUNCTION valider_paiement_demande_creation TO authenticated;

-- ============================================================================
-- PARTIE 5 : Trigger pour automatiser le workflow
-- ============================================================================

-- Fonction trigger pour mettre à jour le statut de la demande quand le paiement change
CREATE OR REPLACE FUNCTION trigger_update_demande_on_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Si le paiement passe à "paye", mettre à jour la demande
  IF NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') THEN
    UPDATE demandes_creation_entreprises
    SET 
      statut_paiement = 'paye',
      date_validation_paiement = now(),
      statut = 'paiement_valide',
      updated_at = now()
    WHERE paiement_id = NEW.id;
    
    -- Appeler automatiquement la validation (création de l'entreprise)
    PERFORM valider_paiement_demande_creation(
      (SELECT id FROM demandes_creation_entreprises WHERE paiement_id = NEW.id LIMIT 1)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_paiement_demande_creation ON paiements;
CREATE TRIGGER trigger_paiement_demande_creation
  AFTER UPDATE OF statut ON paiements
  FOR EACH ROW
  WHEN (NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye'))
  EXECUTE FUNCTION trigger_update_demande_on_paiement();

COMMENT ON TRIGGER trigger_paiement_demande_creation ON paiements IS 'Met à jour automatiquement la demande de création d''entreprise et crée l''entreprise quand le paiement est validé';

-- ============================================================================
-- PARTIE 6 : Fonction pour envoyer l'email après validation
-- ============================================================================

CREATE OR REPLACE FUNCTION envoyer_email_apres_validation_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise RECORD;
  v_result jsonb;
BEGIN
  -- Récupérer les informations de l'entreprise
  SELECT e.*, d.email_contact
  INTO v_entreprise
  FROM entreprises e
  LEFT JOIN demandes_creation_entreprises d ON d.entreprise_id = e.id
  WHERE e.id = p_entreprise_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;
  
  -- Vérifier que le paiement est validé
  IF v_entreprise.statut_paiement != 'paye' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement n''est pas validé'
    );
  END IF;
  
  -- Retourner les informations pour l'envoi d'email (sera géré par Edge Function)
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', p_entreprise_id,
    'email', COALESCE(v_entreprise.email_contact, v_entreprise.email),
    'nom_entreprise', v_entreprise.nom,
    'message', 'Email prêt à être envoyé via Edge Function'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION envoyer_email_apres_validation_entreprise IS 'Prépare l''envoi d''email après validation de l''entreprise (appelé par Edge Function)';

GRANT EXECUTE ON FUNCTION envoyer_email_apres_validation_entreprise TO authenticated;

