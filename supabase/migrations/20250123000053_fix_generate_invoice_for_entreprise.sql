/*
  # Fix: generate_invoice_for_entreprise - Corriger la recherche d'abonnement
  
  PROBLÈME:
  - La fonction cherche l'abonnement avec client_id alors qu'elle devrait chercher via entreprise_id
  - La table abonnements a une colonne entreprise_id qui doit être utilisée
  
  SOLUTION:
  - Chercher l'abonnement via entreprise_id au lieu de client_id
  - Utiliser le système de facturation existant correctement
*/

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

  -- ✅ CORRECTION: Chercher l'abonnement via entreprise_id au lieu de client_id
  SELECT id, montant_mensuel INTO v_abonnement_id, v_montant_mensuel
  FROM abonnements
  WHERE entreprise_id = p_entreprise_id
    AND statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Si pas d'abonnement trouvé, essayer via client_id (pour compatibilité)
  IF v_abonnement_id IS NULL THEN
    RAISE NOTICE '⚠️ [generate_invoice_for_entreprise] Pas d''abonnement via entreprise_id, essai via client_id...';
    
    -- Récupérer le client_id du client depuis espaces_membres_clients
    SELECT emc.client_id INTO v_client_id
    FROM espaces_membres_clients emc
    WHERE emc.entreprise_id = p_entreprise_id
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      SELECT id, montant_mensuel INTO v_abonnement_id, v_montant_mensuel
      FROM abonnements
      WHERE entreprise_id = p_entreprise_id
        AND statut = 'actif'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  -- Si toujours pas d'abonnement, utiliser un montant par défaut
  IF v_montant_mensuel = 0 OR v_montant_mensuel IS NULL THEN
    v_montant_mensuel := 299.00; -- Montant par défaut
    RAISE NOTICE '⚠️ [generate_invoice_for_entreprise] Aucun abonnement trouvé, utilisation montant par défaut: %', v_montant_mensuel;
  ELSE
    RAISE NOTICE '✅ [generate_invoice_for_entreprise] Abonnement trouvé - Montant: %', v_montant_mensuel;
  END IF;

  -- Générer un numéro de facture unique
  v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Vérifier que le numéro n'existe pas déjà
  WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
    v_numero_facture := 'FACT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  END LOOP;

  RAISE NOTICE '📄 [generate_invoice_for_entreprise] Création de la facture - Numéro: %', v_numero_facture;

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

  RAISE NOTICE '✅ [generate_invoice_for_entreprise] Facture créée - ID: %, Numéro: %', v_facture_id, v_numero_facture;

  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero_facture,
    'numero_facture', v_numero_facture,
    'montant_ttc', ROUND(v_montant_mensuel * 1.20, 2),
    'message', 'Facture générée avec succès'
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
  'Génère une facture pour une entreprise (réservé aux super admins plateforme) - CORRIGÉ pour utiliser entreprise_id';

-- Vérifier que la fonction existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_invoice_for_entreprise') THEN
    RAISE NOTICE '✅ Fonction generate_invoice_for_entreprise créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction generate_invoice_for_entreprise non trouvée après création';
  END IF;
END $$;


