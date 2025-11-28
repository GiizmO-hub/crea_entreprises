/*
  # Corriger l'erreur "column mode_paiement does not exist"
  
  La fonction creer_facture_et_abonnement_apres_paiement essaie d'accéder à
  plans_abonnement.mode_paiement qui n'existe pas. Il faut utiliser une valeur par défaut.
*/

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
  v_mode_paiement text := 'mensuel'; -- ✅ Valeur par défaut
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

  -- Récupérer les informations du plan (✅ mode_paiement supprimé)
  SELECT prix_mensuel
  INTO v_montant_mensuel
  FROM plans_abonnement
  WHERE id = v_plan_id;

  IF v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 0;
  END IF;
  -- ✅ mode_paiement reste 'mensuel' par défaut

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

  -- ✅ 3. Mettre à jour l'entreprise avec le statut de paiement
  -- (facture_creation_id n'existe pas dans la table entreprises)
  UPDATE entreprises
  SET statut_paiement = 'paye'
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
      statut,
      date_debut,
      date_fin
    )
    VALUES (
      v_client_auth_user_id,
      v_plan_id,
      v_montant_mensuel,
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
  'Crée automatiquement la facture et active l''abonnement après validation d''un paiement. Corrigé pour ne plus utiliser mode_paiement.';

