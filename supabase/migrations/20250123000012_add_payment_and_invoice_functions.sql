/*
  # Fonctions RPC pour gestion paiement et facturation (réservées plateforme)
  
  ## Description
  Fonctions pour valider les paiements d'entreprise et générer des factures.
  Ces fonctions sont uniquement accessibles aux utilisateurs plateforme (super_admin).
  
  ## Fonctions créées
  1. `valider_paiement_demande_creation(p_entreprise_id uuid)` : Valide un paiement pour une entreprise
  2. `generate_invoice_for_entreprise(p_entreprise_id uuid)` : Génère une facture pour une entreprise
*/

-- ========================================
-- 1. VALIDER PAIEMENT ENTREPRISE
-- ========================================

CREATE OR REPLACE FUNCTION public.valider_paiement_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise entreprises%ROWTYPE;
  v_abonnement_id uuid;
  v_facture_id uuid;
  v_numero_facture text;
BEGIN
  -- Vérifier que l'utilisateur est un super admin plateforme
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND COALESCE((raw_user_meta_data->>'role')::text, '') IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  -- Mettre à jour le statut de paiement
  UPDATE entreprises
  SET statut_paiement = 'paye',
      updated_at = now()
  WHERE id = p_entreprise_id;

  -- Si l'entreprise était en attente, l'activer
  IF v_entreprise.statut = 'en_attente' OR v_entreprise.statut IS NULL THEN
    UPDATE entreprises
    SET statut = 'active'
    WHERE id = p_entreprise_id;
  END IF;

  -- Générer une facture de paiement
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Récupérer le montant depuis l'abonnement actif ou utiliser un montant par défaut
  SELECT id INTO v_abonnement_id
  FROM abonnements
  WHERE client_id IN (
    SELECT id FROM clients WHERE entreprise_id = p_entreprise_id LIMIT 1
  )
  AND statut = 'actif'
  LIMIT 1;

  DECLARE
    v_montant_mensuel numeric := 0;
  BEGIN
    IF v_abonnement_id IS NOT NULL THEN
      SELECT montant_mensuel INTO v_montant_mensuel
      FROM abonnements
      WHERE id = v_abonnement_id;
    END IF;

    -- Si pas d'abonnement, utiliser un montant par défaut (peut être configuré)
    IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
      v_montant_mensuel := 49.90; -- Montant par défaut
    END IF;

    -- Créer la facture
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
      statut
    )
    SELECT
      p_entreprise_id,
      c.id,
      v_numero_facture,
      'facture',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      v_montant_mensuel,
      v_montant_mensuel * 0.20,
      v_montant_mensuel * 1.20,
      'payee'
    FROM clients c
    WHERE c.entreprise_id = p_entreprise_id
    LIMIT 1
    RETURNING id INTO v_facture_id;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement validé avec succès',
    'facture_id', v_facture_id,
    'numero_facture', v_numero_facture,
    'statut_paiement', 'paye'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.valider_paiement_entreprise(uuid) IS 
  'Valide un paiement pour une entreprise (réservé aux super admins plateforme)';

-- ========================================
-- 2. GÉNÉRER FACTURE POUR ENTREPRISE
-- ========================================

CREATE OR REPLACE FUNCTION public.generate_invoice_for_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise entreprises%ROWTYPE;
  v_client_id uuid;
  v_abonnement_id uuid;
  v_montant_mensuel numeric := 0;
  v_numero_facture text;
  v_facture_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est un super admin plateforme
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND COALESCE((raw_user_meta_data->>'role')::text, '') IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  -- Récupérer le premier client de l'entreprise
  SELECT id INTO v_client_id
  FROM clients
  WHERE entreprise_id = p_entreprise_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;

  -- Récupérer l'abonnement actif
  SELECT id, montant_mensuel INTO v_abonnement_id, v_montant_mensuel
  FROM abonnements
  WHERE client_id = v_client_id
  AND statut = 'actif'
  LIMIT 1;

  -- Si pas d'abonnement, utiliser un montant par défaut
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 49.90;
  END IF;

  -- Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;

  -- Créer la facture
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
    p_entreprise_id,
    v_client_id,
    v_numero_facture,
    'facture',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_montant_mensuel,
    v_montant_mensuel * 0.20,
    v_montant_mensuel * 1.20,
    'envoyee',
    'Facture générée automatiquement depuis la plateforme'
  )
  RETURNING id INTO v_facture_id;

  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero_facture,
    'montant_ttc', v_montant_mensuel * 1.20,
    'message', 'Facture générée avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_for_entreprise(uuid) IS 
  'Génère une facture pour une entreprise (réservé aux super admins plateforme)';

-- ========================================
-- 3. PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION public.valider_paiement_entreprise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_for_entreprise(uuid) TO authenticated;

