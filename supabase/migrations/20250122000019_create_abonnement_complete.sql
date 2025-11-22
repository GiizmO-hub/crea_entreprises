/*
  # Fonction RPC : Création complète d'un abonnement sur mesure
  
  Crée un abonnement avec :
  - Client
  - Plan
  - Options sélectionnées
  - Prix personnalisé
  - Dates de début/fin
*/

CREATE OR REPLACE FUNCTION create_abonnement_complete(
  p_client_id uuid,
  p_plan_id uuid,
  p_entreprise_id uuid DEFAULT NULL,
  p_mode_paiement text DEFAULT 'mensuel',
  p_date_debut date DEFAULT CURRENT_DATE,
  p_date_fin date DEFAULT NULL,
  p_montant_mensuel numeric DEFAULT NULL,
  p_options_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_statut text DEFAULT 'actif'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_montant numeric;
  v_total_montant numeric;
  v_entreprise_id uuid;
  v_result jsonb;
BEGIN
  -- Vérifier que le client existe
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = p_client_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;

  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé ou inactif'
    );
  END IF;

  -- Récupérer le montant du plan si non fourni
  IF p_montant_mensuel IS NULL THEN
    SELECT 
      CASE 
        WHEN p_mode_paiement = 'annuel' THEN prix_annuel / 12
        ELSE prix_mensuel
      END
    INTO v_plan_montant
    FROM plans_abonnement
    WHERE id = p_plan_id;
  ELSE
    v_plan_montant := p_montant_mensuel;
  END IF;

  -- Récupérer ou créer l'entreprise du client
  SELECT entreprise_id INTO v_entreprise_id
  FROM clients
  WHERE id = p_client_id
  LIMIT 1;

  -- Si aucune entreprise trouvée, utiliser celle fournie ou créer une entrée par défaut
  IF v_entreprise_id IS NULL THEN
    IF p_entreprise_id IS NOT NULL THEN
      v_entreprise_id := p_entreprise_id;
    ELSE
      -- Créer une entreprise par défaut (nécessite que l'utilisateur connecté en ait une)
      SELECT id INTO v_entreprise_id
      FROM entreprises
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;

  -- Calculer le montant total avec les options
  SELECT COALESCE(SUM(prix_mensuel), 0) INTO v_total_montant
  FROM options_supplementaires
  WHERE id = ANY(p_options_ids)
    AND actif = true;

  v_total_montant := v_plan_montant + v_total_montant;

  -- Créer l'abonnement
  INSERT INTO abonnements (
    entreprise_id,
    plan_id,
    statut,
    date_debut,
    date_fin,
    montant_mensuel,
    mode_paiement
  )
  VALUES (
    v_entreprise_id,
    p_plan_id,
    p_statut,
    p_date_debut,
    p_date_fin,
    v_total_montant,
    p_mode_paiement
  )
  RETURNING id INTO v_abonnement_id;

  -- Ajouter les options si fournies
  IF array_length(p_options_ids, 1) > 0 THEN
    INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_activation)
    SELECT 
      v_abonnement_id,
      unnest(p_options_ids),
      true,
      p_date_debut
    WHERE EXISTS (
      SELECT 1 FROM options_supplementaires 
      WHERE id = unnest(p_options_ids) AND actif = true
    )
    ON CONFLICT (abonnement_id, option_id) DO UPDATE
    SET actif = true,
        date_activation = p_date_debut,
        date_desactivation = NULL;
  END IF;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'abonnement_id', v_abonnement_id,
    'montant_mensuel', v_total_montant,
    'message', 'Abonnement créé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_abonnement_complete IS 'Créer un abonnement complet avec plan, options et prix personnalisé';

