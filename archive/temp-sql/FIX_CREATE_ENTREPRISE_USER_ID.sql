-- ============================================================================
-- CORRECTION DE LA FONCTION create_complete_entreprise_automated
-- Pour vérifier que le user_id existe avant de créer l'entreprise
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
  p_password_client text DEFAULT NULL,
  
  -- Abonnement (plan_id seulement, l'abonnement sera créé après paiement)
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL,
  
  -- Options
  p_creer_client_super_admin boolean DEFAULT true,
  p_envoyer_email boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_auth_user_id uuid;
  v_role text;
  v_client_id_for_abonnement uuid;
  v_plan_montant_mensuel numeric;
  v_plan_mode_paiement text;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_espace_membre_id uuid;
  v_paiement_id uuid;
  v_password text;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_user_exists boolean;
BEGIN
  -- 1. Vérifier que l'utilisateur est connecté
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié. Veuillez vous connecter.'
    );
  END IF;
  
  -- 2. ✅ NOUVEAU: Vérifier que le user_id existe vraiment dans auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('L''utilisateur avec l''ID %s n''existe pas dans auth.users. Veuillez vous reconnecter.', v_user_id::text)
    );
  END IF;
  
  -- 3. Récupérer les infos de l'utilisateur
  SELECT 
    id,
    raw_user_meta_data->>'role' as role
  INTO 
    v_auth_user_id,
    v_role
  FROM auth.users
  WHERE id = v_user_id;
  
  -- 4. Vérifier que le plan existe si fourni
  IF p_plan_id IS NOT NULL THEN
    SELECT 
      COALESCE(prix_mensuel, 0),
      'mensuel'
    INTO 
      v_plan_montant_mensuel,
      v_plan_mode_paiement
    FROM plans_abonnement
    WHERE id = p_plan_id AND actif = true;
    
    IF v_plan_montant_mensuel IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé ou inactif'
      );
    END IF;
  ELSE
    v_plan_montant_mensuel := 0;
    v_plan_mode_paiement := 'mensuel';
  END IF;
  
  -- 5. Calculer les montants
  v_montant_ht := v_plan_montant_mensuel;
  v_montant_tva := v_montant_ht * 0.20;
  v_montant_ttc := v_montant_ht + v_montant_tva;
  
  -- 6. Créer l'entreprise
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
    v_user_id, -- ✅ Utiliser le user_id vérifié
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
    CASE WHEN p_plan_id IS NOT NULL THEN 'en_attente' ELSE 'non_requis' END
  )
  RETURNING id INTO v_entreprise_id;
  
  -- 7. Créer le client si email fourni
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    -- Générer mot de passe si non fourni
    IF p_password_client IS NULL OR p_password_client = '' THEN
      v_password := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 
                    upper(substr(md5(random()::text), 1, 2)) || '!';
    ELSE
      v_password := p_password_client;
    END IF;
    
    -- Créer le client
    INSERT INTO clients (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      adresse,
      code_postal,
      ville,
      statut
    )
    VALUES (
      v_entreprise_id,
      p_nom_client,
      p_prenom_client,
      p_email_client,
      p_telephone_client,
      p_adresse_client,
      p_code_postal_client,
      p_ville_client,
      'actif'
    )
    RETURNING id INTO v_client_id;
    
    -- Créer l'espace membre si demandé
    IF p_creer_client_super_admin THEN
      INSERT INTO espaces_membres_clients (
        client_id,
        entreprise_id,
        user_id,
        actif,
        statut_compte,
        modules_actifs
      )
      VALUES (
        v_client_id,
        v_entreprise_id,
        v_auth_user_id,
        true,
        'actif',
        jsonb_build_object(
          'tableau_de_bord', true,
          'mon_entreprise', true,
          'factures', true,
          'documents', true
        )
      )
      RETURNING id INTO v_espace_membre_id;
    END IF;
  END IF;
  
  -- 8. Créer un paiement si plan fourni
  IF p_plan_id IS NOT NULL AND v_montant_ttc > 0 THEN
    INSERT INTO paiements (
      user_id,
      entreprise_id,
      montant_ht,
      montant_tva,
      montant_ttc,
      statut,
      methode_paiement,
      type_paiement,
      notes
    )
    VALUES (
      v_user_id, -- ✅ Utiliser le user_id vérifié
      v_entreprise_id,
      v_montant_ht,
      v_montant_tva,
      v_montant_ttc,
      'en_attente',
      'stripe',
      'abonnement',
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'client_id', COALESCE(v_client_id::text, NULL),
        'entreprise_id', v_entreprise_id::text,
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise)
      )::text
    )
    RETURNING id INTO v_paiement_id;
  END IF;
  
  -- 9. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'client_id', v_client_id,
    'paiement_id', v_paiement_id,
    'espace_membre_id', v_espace_membre_id,
    'message', 'Entreprise créée avec succès. Veuillez effectuer le paiement pour finaliser.'
  );

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erreur de référence: L''un des IDs utilisés n''existe pas dans la base de données.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
  'Crée une entreprise complète avec client et paiement. Vérifie que le user_id existe avant création.';

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

SELECT '✅ Fonction create_complete_entreprise_automated mise à jour avec vérification du user_id' as resultat;

