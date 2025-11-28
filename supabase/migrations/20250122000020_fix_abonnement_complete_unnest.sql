/*
  # Fix: Correction erreur "set-returning functions are not allowed in WHERE"
  
  Le problème: Utilisation de unnest() dans une clause WHERE qui cause une erreur SQL
  Solution: Remplacer la requête par une boucle FOR pour insérer les options une par une
*/

-- Recréer la fonction create_abonnement_complete avec la correction
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
  i integer;
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

  -- Récupérer l'entreprise du client
  SELECT entreprise_id INTO v_entreprise_id
  FROM clients
  WHERE id = p_client_id
  LIMIT 1;

  -- Si aucune entreprise trouvée dans le client, utiliser celle fournie
  IF v_entreprise_id IS NULL THEN
    IF p_entreprise_id IS NOT NULL THEN
      v_entreprise_id := p_entreprise_id;
    ELSE
      -- Utiliser l'entreprise de l'utilisateur connecté (super admin)
      SELECT id INTO v_entreprise_id
      FROM entreprises
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;

  -- Vérifier qu'on a une entreprise (obligatoire dans le schéma)
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune entreprise trouvée pour ce client'
    );
  END IF;

  -- Calculer le montant total avec les options
  -- Vérifier d'abord si des options sont fournies
  v_total_montant := v_plan_montant;
  
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(prix_mensuel), 0) INTO v_total_montant
    FROM options_supplementaires
    WHERE id = ANY(p_options_ids)
      AND actif = true;
    
    v_total_montant := v_plan_montant + COALESCE((SELECT SUM(prix_mensuel) FROM options_supplementaires WHERE id = ANY(p_options_ids) AND actif = true), 0);
  END IF;

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

  -- Ajouter les options si fournies (en utilisant une boucle pour éviter l'erreur unnest)
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    FOR i IN 1..array_length(p_options_ids, 1) LOOP
      -- Vérifier que l'option existe et est active
      IF EXISTS (
        SELECT 1 FROM options_supplementaires 
        WHERE id = p_options_ids[i] AND actif = true
      ) THEN
        INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_activation)
        VALUES (v_abonnement_id, p_options_ids[i], true, p_date_debut)
        ON CONFLICT (abonnement_id, option_id) DO UPDATE
        SET actif = true,
            date_activation = p_date_debut,
            date_desactivation = NULL;
      END IF;
    END LOOP;
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

COMMENT ON FUNCTION create_abonnement_complete IS 'Créer un abonnement complet avec plan, options et prix personnalisé (version corrigée)';




