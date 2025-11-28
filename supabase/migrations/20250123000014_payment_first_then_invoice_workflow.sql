/*
  # Workflow Paiement → Facture → Abonnement
  
  ## Nouveau workflow
  1. Création entreprise + client (sans abonnement ni facture)
  2. Paiement via Stripe/autre
  3. Une fois paiement validé → Créer facture automatiquement
  4. Activer abonnement automatiquement
  5. Créer espace client avec super admin
  
  ## Modifications
  - Supprimer création facture/abonnement de create_complete_entreprise_automated
  - Créer trigger sur paiements pour générer facture + activer abonnement après paiement
  - Créer la table paiements si elle n'existe pas
*/

-- ============================================================================
-- PARTIE 0 : Créer la table paiements si elle n'existe pas
-- ============================================================================

CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  type_paiement text NOT NULL CHECK (type_paiement IN ('facture', 'abonnement', 'devis', 'autre')),
  reference_id uuid,
  numero_reference text,
  montant_ht numeric(12,2) NOT NULL DEFAULT 0,
  montant_tva numeric(12,2) NOT NULL DEFAULT 0,
  montant_ttc numeric(12,2) NOT NULL DEFAULT 0,
  methode_paiement text NOT NULL CHECK (methode_paiement IN ('carte', 'virement', 'cheque', 'especes', 'stripe', 'prelevement')),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'echec', 'rembourse', 'annule')),
  date_paiement date,
  date_echeance date,
  stripe_payment_id text,
  stripe_invoice_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_paiements_user_id ON paiements(user_id);
CREATE INDEX IF NOT EXISTS idx_paiements_entreprise_id ON paiements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_date_paiement ON paiements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_type ON paiements(type_paiement);

-- RLS Policies (si pas déjà activé)
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'paiements' 
    AND policyname = 'Users can view own paiements'
  ) THEN
    CREATE POLICY "Users can view own paiements"
      ON paiements FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'paiements' 
    AND policyname = 'Users can insert own paiements'
  ) THEN
    CREATE POLICY "Users can insert own paiements"
      ON paiements FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'paiements' 
    AND policyname = 'Users can update own paiements'
  ) THEN
    CREATE POLICY "Users can update own paiements"
      ON paiements FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- PARTIE 1 : Modifier create_complete_entreprise_automated pour ne plus créer facture/abonnement
-- ============================================================================

CREATE OR REPLACE FUNCTION create_complete_entreprise_automated(
  -- Informations entreprise
  p_nom_entreprise text,
  p_forme_juridique text DEFAULT 'SARL',
  p_siret text DEFAULT NULL,
  p_email_entreprise text DEFAULT NULL,
  p_telephone_entreprise text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_capital numeric DEFAULT 0,
  p_rcs text DEFAULT NULL,
  p_site_web text DEFAULT NULL,
  
  -- Informations client (optionnel - si fourni, crée aussi le client)
  p_email_client text DEFAULT NULL,
  p_nom_client text DEFAULT NULL,
  p_prenom_client text DEFAULT NULL,
  p_telephone_client text DEFAULT NULL,
  p_adresse_client text DEFAULT NULL,
  p_code_postal_client text DEFAULT NULL,
  p_ville_client text DEFAULT NULL,
  
  -- Abonnement (plan_id seulement, l'abonnement sera créé après paiement)
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL,
  
  -- Options
  p_envoyer_email boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_password text;
  v_email_final text;
  v_result jsonb;
  v_auth_user_id uuid;
  v_role text := 'client_super_admin';
  v_statut_paiement text;
  v_plan_montant_mensuel numeric;
  v_paiement_id_result uuid;  -- ✅ Pour retourner le paiement_id
BEGIN
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  -- 2. Déterminer le statut de paiement
  IF p_plan_id IS NOT NULL THEN
    v_statut_paiement := 'en_attente';
    -- Récupérer le montant du plan pour le paiement
    SELECT prix_mensuel INTO v_plan_montant_mensuel
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF v_plan_montant_mensuel IS NULL THEN
      v_plan_montant_mensuel := 0;
    END IF;
  ELSE
    v_statut_paiement := 'non_requis';
    v_plan_montant_mensuel := 0;
  END IF;

  -- 3. Créer l'entreprise
  INSERT INTO entreprises (
    user_id,
    nom,
    forme_juridique,
    siret,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    capital,
    rcs,
    site_web,
    statut,
    statut_paiement
  )
  VALUES (
    v_user_id,
    p_nom_entreprise,
    p_forme_juridique,
    p_siret,
    p_email_entreprise,
    p_telephone_entreprise,
    p_adresse,
    p_code_postal,
    p_ville,
    p_capital,
    p_rcs,
    p_site_web,
    'active',
    v_statut_paiement
  )
  RETURNING id INTO v_entreprise_id;

  -- 4. Si un email client est fourni, créer le client
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    INSERT INTO clients (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      adresse,
      code_postal,
      ville,
      statut,
      entreprise_nom
    )
    VALUES (
      v_entreprise_id,
      COALESCE(p_nom_client, 'Client'),
      COALESCE(p_prenom_client, ''),
      p_email_client,
      p_telephone_client,
      p_adresse_client,
      p_code_postal_client,
      p_ville_client,
      'actif',
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;

    v_email_final := p_email_client;
  END IF;

  -- 5. ✅ NOUVEAU : Si un plan est choisi, créer UNIQUEMENT le paiement en attente
  -- L'abonnement et la facture seront créés APRÈS validation du paiement
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    -- Créer un paiement en attente
    -- Ce paiement sera lié à l'entreprise et au plan
    -- Quand il sera validé, le trigger créera automatiquement facture + abonnement
    
    -- Construire les notes JSON directement
    INSERT INTO paiements (
      user_id,
      entreprise_id,
      type_paiement,
      montant_ht,
      montant_tva,
      montant_ttc,
      methode_paiement,
      statut,
      date_echeance,
      date_creation_paiement,
      notes
    )
    VALUES (
      v_user_id,
      v_entreprise_id,
      'autre',
      v_plan_montant_mensuel,
      v_plan_montant_mensuel * 0.20,
      v_plan_montant_mensuel * 1.20,
      'stripe',  -- Par défaut, sera changé selon le choix
      'en_attente',
      CURRENT_DATE + INTERVAL '30 days',
      now(),
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'entreprise_id', v_entreprise_id::text,
        'client_id', COALESCE(v_client_id::text, 'null'),
        'options_ids', COALESCE(p_options_ids::text[], ARRAY[]::text[]),
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise)
      )::text
    )
    RETURNING id INTO v_paiement_id_result;
  END IF;

  -- 6. Récupérer l'ID du paiement créé si existe
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    SELECT id INTO v_paiement_id_result
    FROM paiements
    WHERE entreprise_id = v_entreprise_id
      AND statut = 'en_attente'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 7. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'client_id', v_client_id,
    'paiement_id', v_paiement_id_result,  -- ✅ Retourner le paiement_id
    'statut', CASE 
      WHEN v_statut_paiement = 'en_attente' THEN 'en_attente_paiement'
      ELSE 'complete'
    END,
    'message', CASE 
      WHEN v_statut_paiement = 'en_attente' THEN 'Entreprise créée. Sélectionnez votre méthode de paiement.'
      ELSE 'Entreprise créée avec succès'
    END,
    'plan_id', p_plan_id,
    'montant_ttc', CASE WHEN v_statut_paiement = 'en_attente' THEN v_plan_montant_mensuel * 1.20 ELSE NULL END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
  'Crée une entreprise et un client. Le paiement doit être effectué séparément. Après paiement, facture et abonnement seront créés automatiquement.';

-- ============================================================================
-- PARTIE 2 : Fonction pour créer facture + abonnement après paiement validé
-- ============================================================================

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_plan_id uuid;
  v_options_ids uuid[];
  v_facture_id uuid;
  v_abonnement_id uuid;
  v_numero_facture text;
  v_montant_mensuel numeric;
  v_mode_paiement text;
BEGIN
  -- Récupérer les informations du paiement
  -- ✅ Parser les notes JSON pour récupérer plan_id, client_id, etc.
  SELECT 
    p.*,
    p.entreprise_id as ent_id,
    (p.notes::jsonb->>'plan_id')::uuid as plan_id_from_notes,
    (p.notes::jsonb->>'client_id')::text as client_id_from_notes,
    COALESCE(
      (SELECT array_agg(elem::uuid) FROM jsonb_array_elements_text(p.notes::jsonb->'options_ids') elem),
      ARRAY[]::uuid[]
    ) as options_ids_from_notes
  INTO v_paiement
  FROM paiements p
  WHERE p.id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  IF v_paiement.statut != 'paye' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le paiement n''est pas validé'
    );
  END IF;

  v_entreprise_id := v_paiement.entreprise_id;
  v_plan_id := v_paiement.plan_id_from_notes;
  
  -- Récupérer le client_id depuis les notes ou depuis l'entreprise
  IF v_paiement.client_id_from_notes != 'null' AND v_paiement.client_id_from_notes IS NOT NULL THEN
    v_client_id := v_paiement.client_id_from_notes::uuid;
  ELSE
    -- Si pas dans les notes, récupérer depuis l'entreprise
    SELECT id INTO v_client_id
    FROM clients
    WHERE entreprise_id = v_entreprise_id
    LIMIT 1;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun plan associé au paiement'
    );
  END IF;

  -- Récupérer les informations du plan
  SELECT prix_mensuel, mode_paiement
  INTO v_montant_mensuel, v_mode_paiement
  FROM plans_abonnement
  WHERE id = v_plan_id;

  IF v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 0;
  END IF;
  IF v_mode_paiement IS NULL THEN
    v_mode_paiement := 'mensuel';
  END IF;

  -- ✅ 1. Créer la facture automatiquement
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;

  INSERT INTO factures (
    entreprise_id,
    client_id,
    numero,
    type,
    date_emission,
    date_echeance,
    montant_ht,
    tva,
    montant_ttc,
    statut,
    notes
  )
  VALUES (
    v_entreprise_id,
    v_client_id,
    v_numero_facture,
    'facture',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_montant_mensuel,
    v_montant_mensuel * 0.20,
    v_montant_mensuel * 1.20,
    'payee',  -- ✅ Statut payée car le paiement est déjà validé
    format('Facture générée automatiquement après validation du paiement pour: %s', (SELECT nom FROM entreprises WHERE id = v_entreprise_id))
  )
  RETURNING id INTO v_facture_id;

  -- ✅ 3. Mettre à jour l'entreprise avec la facture
  UPDATE entreprises
  SET facture_creation_id = v_facture_id,
      statut_paiement = 'paye'
  WHERE id = v_entreprise_id;

  -- ✅ 4. CRÉER L'ESPACE CLIENT AVANT L'ABONNEMENT
  -- (car l'abonnement a besoin de l'auth.user_id du client)
  DECLARE
    v_finalisation_result jsonb;
    v_client_auth_user_id uuid;
  BEGIN
    v_finalisation_result := finaliser_creation_apres_paiement(v_entreprise_id);
    
    IF NOT (v_finalisation_result->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Erreur lors de la création de l''espace client: ' || (v_finalisation_result->>'error')
      );
    END IF;

    -- Récupérer l'auth.user_id du client depuis l'espace membre créé
    SELECT user_id INTO v_client_auth_user_id
    FROM espaces_membres_clients
    WHERE id = (v_finalisation_result->>'espace_membre_id')::uuid;

    -- ✅ 5. Créer l'abonnement (actif) avec l'auth.user_id du client
    INSERT INTO abonnements (
      client_id,
      plan_id,
      montant_mensuel,
      mode_paiement,
      statut,
      date_debut,
      date_fin
    )
    VALUES (
      v_client_auth_user_id,
      v_plan_id,
      v_montant_mensuel,
      v_mode_paiement,
      'actif',  -- ✅ Directement actif car le paiement est validé
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 month'
    )
    RETURNING id INTO v_abonnement_id;

    -- Lier l'abonnement à l'espace membre
    UPDATE espaces_membres_clients
    SET abonnement_id = v_abonnement_id,
        updated_at = NOW()
    WHERE id = (v_finalisation_result->>'espace_membre_id')::uuid;

    -- Synchroniser les modules depuis le plan
    IF v_plan_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan((v_finalisation_result->>'espace_membre_id')::uuid);
    END IF;

    -- Ajouter les options si fournies
    IF v_paiement.options_ids_from_notes IS NOT NULL AND array_length(v_paiement.options_ids_from_notes, 1) > 0 THEN
      INSERT INTO abonnement_options (abonnement_id, option_id)
      SELECT v_abonnement_id, unnest(v_paiement.options_ids_from_notes)
      ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'facture_id', v_facture_id,
      'numero_facture', v_numero_facture,
      'abonnement_id', v_abonnement_id,
      'espace_membre_id', v_finalisation_result->>'espace_membre_id',
      'email', v_finalisation_result->>'email',
      'password', v_finalisation_result->>'password',
      'message', 'Facture, abonnement et espace client créés automatiquement après validation du paiement.'
    );
  END;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture et active l''abonnement après validation d''un paiement.';

-- ============================================================================
-- PARTIE 3 : Trigger automatique sur paiements pour créer facture + abonnement
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_creer_facture_abonnement_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Si le paiement passe à "paye" (et n'était pas déjà payé)
  IF NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') THEN
    -- Vérifier que c'est un paiement pour une entreprise (a un entreprise_id)
    IF NEW.entreprise_id IS NOT NULL THEN
      -- Créer automatiquement facture + abonnement
      v_result := creer_facture_et_abonnement_apres_paiement(NEW.id);
      
      -- Log le résultat
      IF NOT (v_result->>'success')::boolean THEN
        RAISE WARNING 'Erreur lors de la création automatique facture/abonnement: %', v_result->>'error';
      ELSE
        RAISE NOTICE '✅ Facture et abonnement créés automatiquement pour entreprise %', NEW.entreprise_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_creer_facture_abonnement_apres_paiement IS 
  'Trigger automatique qui crée facture et abonnement quand un paiement est validé.';

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;
CREATE TRIGGER trigger_paiement_creer_facture_abonnement
  AFTER UPDATE OF statut ON paiements
  FOR EACH ROW
  WHEN (NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') AND NEW.entreprise_id IS NOT NULL)
  EXECUTE FUNCTION trigger_creer_facture_abonnement_apres_paiement();

-- ============================================================================
-- PARTIE 4 : Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION creer_facture_et_abonnement_apres_paiement(uuid) TO authenticated;

