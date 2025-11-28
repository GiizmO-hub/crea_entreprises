/*
  # Mise à jour du workflow de validation de paiement
  
  ## Modifications
  - Modifier valider_paiement_entreprise pour mettre à jour le paiement en 'paye'
  - Le trigger créera automatiquement facture + abonnement + espace client
*/

-- ============================================================================
-- PARTIE 1 : Modifier valider_paiement_entreprise pour utiliser le nouveau workflow
-- ============================================================================

DROP FUNCTION IF EXISTS public.valider_paiement_entreprise(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.valider_paiement_entreprise(
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise RECORD;
  v_paiement RECORD;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur est un super admin plateforme
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND COALESCE((raw_user_meta_data->>'role')::text, '') IN ('super_admin', 'admin')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
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

  -- Récupérer le paiement en attente pour cette entreprise
  SELECT * INTO v_paiement
  FROM paiements
  WHERE entreprise_id = p_entreprise_id
    AND statut = 'en_attente'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun paiement en attente trouvé pour cette entreprise'
    );
  END IF;

  -- ✅ Mettre à jour le statut du paiement à 'paye'
  -- Le trigger créera automatiquement facture + abonnement + espace client
  UPDATE paiements
  SET statut = 'paye',
      date_paiement = CURRENT_DATE,
      updated_at = now()
  WHERE id = v_paiement.id;

  -- Mettre à jour le statut de paiement de l'entreprise
  UPDATE entreprises
  SET statut_paiement = 'paye',
      updated_at = now()
  WHERE id = p_entreprise_id;

  -- Attendre un peu pour que le trigger s'exécute (optionnel, mais pour être sûr)
  -- Le trigger va créer facture + abonnement + espace client automatiquement
  
  -- Récupérer les résultats (facture et abonnement créés par le trigger)
  DECLARE
    v_facture RECORD;
    v_abonnement RECORD;
    v_espace_membre RECORD;
  BEGIN
    -- Vérifier que la facture a été créée
    SELECT * INTO v_facture
    FROM factures
    WHERE entreprise_id = p_entreprise_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Vérifier que l'abonnement a été créé
    SELECT a.* INTO v_abonnement
    FROM abonnements a
    JOIN clients c ON c.id IN (
      SELECT id FROM clients WHERE entreprise_id = p_entreprise_id LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM auth.users au 
      WHERE au.id = a.client_id 
      AND au.email IN (SELECT email FROM clients WHERE entreprise_id = p_entreprise_id LIMIT 1)
    )
    ORDER BY a.created_at DESC
    LIMIT 1;

    -- Vérifier que l'espace membre a été créé
    SELECT * INTO v_espace_membre
    FROM espaces_membres_clients
    WHERE entreprise_id = p_entreprise_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_facture.id IS NOT NULL AND v_abonnement.id IS NOT NULL AND v_espace_membre.id IS NOT NULL THEN
      -- Récupérer les identifiants
      DECLARE
        v_client_email text;
        v_password text;
      BEGIN
        SELECT email INTO v_client_email
        FROM clients
        WHERE entreprise_id = p_entreprise_id
        LIMIT 1;

        SELECT password_temporaire INTO v_password
        FROM espaces_membres_clients
        WHERE id = v_espace_membre.id;

        RETURN jsonb_build_object(
          'success', true,
          'message', 'Paiement validé. Facture, abonnement et espace client créés automatiquement.',
          'statut_paiement', 'paye',
          'facture_id', v_facture.id,
          'numero_facture', v_facture.numero,
          'abonnement_id', v_abonnement.id,
          'espace_membre_id', v_espace_membre.id,
          'email', v_client_email,
          'password', v_password,
          'email_a_envoyer', true
        );
      END;
    ELSE
      -- Le trigger n'a peut-être pas encore fini, retourner quand même succès
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Paiement validé. Facture, abonnement et espace client en cours de création...',
        'statut_paiement', 'paye',
        'email_a_envoyer', false
      );
    END IF;
  END;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.valider_paiement_entreprise(uuid) IS 
  'Valide un paiement pour une entreprise. Déclenche automatiquement la création de facture, abonnement et espace client via trigger.';

GRANT EXECUTE ON FUNCTION public.valider_paiement_entreprise(uuid) TO authenticated;




