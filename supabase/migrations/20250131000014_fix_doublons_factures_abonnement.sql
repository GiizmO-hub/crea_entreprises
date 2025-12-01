/*
  # CORRECTION : Empêcher les factures en double lors de la création d'entreprise
  
  PROBLÈME:
  - À chaque création d'entreprise, deux factures sont créées au lieu d'une seule
  - Le trigger `trigger_creer_facture_abonnement_apres_paiement` crée une facture via `creer_facture_et_abonnement_apres_paiement`
  - La fonction `generate_invoice_for_entreprise` crée aussi une facture
  - Résultat : 2 factures au lieu d'1
  
  SOLUTION:
  - Modifier `generate_invoice_for_entreprise` pour vérifier si une facture existe déjà pour cet abonnement
  - Si une facture existe déjà (via facture_id dans abonnements), retourner cette facture au lieu d'en créer une nouvelle
*/

-- ============================================================================
-- PARTIE 1 : Corriger generate_invoice_for_entreprise pour éviter les doublons
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_for_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise RECORD;
  v_client_id uuid;
  v_abonnement_id uuid;
  v_montant_mensuel numeric := 0;
  v_numero_facture text;
  v_facture_id uuid;
  v_facture_existante RECORD;
BEGIN
  RAISE NOTICE '🚀 [generate_invoice_for_entreprise] DÉBUT - Entreprise ID: %', p_entreprise_id;
  
  -- Vérifier que l'utilisateur est un super admin plateforme
  IF NOT check_is_super_admin() THEN
    RAISE WARNING '❌ [generate_invoice_for_entreprise] Accès non autorisé - Super admin requis';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
  END IF;

  -- Récupérer l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE WARNING '❌ [generate_invoice_for_entreprise] Entreprise non trouvée - ID: %', p_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;

  RAISE NOTICE '✅ [generate_invoice_for_entreprise] Entreprise trouvée: %', v_entreprise.nom;

  -- Récupérer le premier client de l'entreprise
  SELECT id INTO v_client_id
  FROM clients
  WHERE entreprise_id = p_entreprise_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE WARNING '❌ [generate_invoice_for_entreprise] Aucun client trouvé pour cette entreprise';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun client trouvé pour cette entreprise'
    );
  END IF;

  RAISE NOTICE '✅ [generate_invoice_for_entreprise] Client trouvé - ID: %', v_client_id;

  -- ✅ CORRECTION CRITIQUE : Chercher l'abonnement et vérifier si une facture existe déjà
  SELECT id, montant_mensuel, facture_id INTO v_abonnement_id, v_montant_mensuel, v_facture_id
  FROM abonnements
  WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Si un abonnement existe et a déjà une facture, retourner cette facture
  IF v_abonnement_id IS NOT NULL AND v_facture_id IS NOT NULL THEN
    RAISE NOTICE '✅ [generate_invoice_for_entreprise] Facture existante trouvée pour cet abonnement - ID: %', v_facture_id;
    
    -- Récupérer les détails de la facture existante
    SELECT * INTO v_facture_existante
    FROM factures
    WHERE id = v_facture_id;
    
    IF FOUND THEN
      RAISE NOTICE '✅ [generate_invoice_for_entreprise] Retour de la facture existante - Numéro: %', v_facture_existante.numero;
      RETURN jsonb_build_object(
        'success', true,
        'facture_id', v_facture_existante.id,
        'numero', v_facture_existante.numero,
        'numero_facture', v_facture_existante.numero,
        'montant_ttc', v_facture_existante.montant_ttc,
        'message', 'Facture existante retournée (pas de doublon créé)',
        'existant', true
      );
    END IF;
  END IF;

  -- Si pas d'abonnement trouvé, essayer via client_id (pour compatibilité)
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ [generate_invoice_for_entreprise] Pas d''abonnement via entreprise_id, essai via client_id...';
    
    -- Récupérer le client_id du client depuis espaces_membres_clients
    SELECT emc.client_id INTO v_client_id
    FROM espaces_membres_clients emc
    WHERE emc.entreprise_id = p_entreprise_id
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      SELECT id, montant_mensuel, facture_id INTO v_abonnement_id, v_montant_mensuel, v_facture_id
      FROM abonnements
      WHERE entreprise_id = p_entreprise_id
        AND statut = 'actif'
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Si une facture existe déjà, la retourner
      IF v_facture_id IS NOT NULL THEN
        SELECT * INTO v_facture_existante
        FROM factures
        WHERE id = v_facture_id;
        
        IF FOUND THEN
          RAISE NOTICE '✅ [generate_invoice_for_entreprise] Facture existante trouvée - Numéro: %', v_facture_existante.numero;
          RETURN jsonb_build_object(
            'success', true,
            'facture_id', v_facture_existante.id,
            'numero', v_facture_existante.numero,
            'numero_facture', v_facture_existante.numero,
            'montant_ttc', v_facture_existante.montant_ttc,
            'message', 'Facture existante retournée (pas de doublon créé)',
            'existant', true
          );
        END IF;
      END IF;
    END IF;
  END IF;

  -- Si toujours pas d'abonnement, utiliser un montant par défaut
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 299.00; -- Montant par défaut
    RAISE NOTICE '⚠️ [generate_invoice_for_entreprise] Aucun abonnement trouvé, utilisation montant par défaut: %', v_montant_mensuel;
  ELSE
    RAISE NOTICE '✅ [generate_invoice_for_entreprise] Abonnement trouvé - Montant: %', v_montant_mensuel;
  END IF;

  -- ✅ VÉRIFICATION FINALE : Vérifier s'il existe déjà une facture récente pour cette entreprise et cet abonnement
  IF v_abonnement_id IS NOT NULL THEN
    SELECT f.id, f.numero, f.montant_ttc INTO v_facture_existante
    FROM factures f
    WHERE f.entreprise_id = p_entreprise_id
      AND f.client_id = v_client_id
      AND (
        -- Facture liée à cet abonnement (via facture_id dans abonnements)
        f.id IN (SELECT facture_id FROM abonnements WHERE id = v_abonnement_id AND facture_id IS NOT NULL)
        OR
        -- Facture avec plan_id dans les notes (créée par le workflow de paiement)
        (f.notes::jsonb->>'plan_id')::text IS NOT NULL
        OR
        -- Facture créée récemment (moins de 24h) pour cette entreprise
        (f.created_at > now() - INTERVAL '24 hours' AND f.source = 'plateforme')
      )
    ORDER BY f.created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      RAISE NOTICE '✅ [generate_invoice_for_entreprise] Facture récente trouvée - Numéro: %, ID: %', v_facture_existante.numero, v_facture_existante.id;
      RETURN jsonb_build_object(
        'success', true,
        'facture_id', v_facture_existante.id,
        'numero', v_facture_existante.numero,
        'numero_facture', v_facture_existante.numero,
        'montant_ttc', v_facture_existante.montant_ttc,
        'message', 'Facture existante retournée (évite le doublon)',
        'existant', true
      );
    END IF;
  END IF;

  -- Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;

  RAISE NOTICE '📄 [generate_invoice_for_entreprise] Création d''une NOUVELLE facture - Numéro: %', v_numero_facture;

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
    notes,
    source
  )
  VALUES (
    p_entreprise_id,
    v_client_id,
    v_numero_facture,
    'facture',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_montant_mensuel,
    ROUND(v_montant_mensuel * 0.20, 2),
    ROUND(v_montant_mensuel * 1.20, 2),
    'envoyee',
    jsonb_build_object(
      'source', 'generate_invoice_for_entreprise',
      'abonnement_id', v_abonnement_id,
      'message', 'Facture générée automatiquement depuis la plateforme'
    ),
    'plateforme'
  )
  RETURNING id INTO v_facture_id;

  -- Si un abonnement existe, mettre à jour facture_id dans abonnements
  IF v_abonnement_id IS NOT NULL AND v_facture_id IS NOT NULL THEN
    UPDATE abonnements
    SET facture_id = v_facture_id,
        updated_at = now()
    WHERE id = v_abonnement_id
      AND (facture_id IS NULL OR facture_id != v_facture_id);
    
    RAISE NOTICE '✅ [generate_invoice_for_entreprise] Abonnement mis à jour avec facture_id: %', v_facture_id;
  END IF;

  RAISE NOTICE '✅ [generate_invoice_for_entreprise] Facture créée - ID: %, Numéro: %', v_facture_id, v_numero_facture;

  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero_facture,
    'numero_facture', v_numero_facture,
    'montant_ttc', ROUND(v_montant_mensuel * 1.20, 2),
    'message', 'Facture générée avec succès',
    'existant', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [generate_invoice_for_entreprise] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_for_entreprise(uuid) IS 
  'Génère une facture pour une entreprise (réservé aux super admins plateforme) - CORRIGÉ pour éviter les doublons';

SELECT '✅ Migration de correction des factures en double appliquée avec succès !' as resultat;

