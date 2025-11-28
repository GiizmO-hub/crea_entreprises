/*
  # Étendre update_client_complete pour gérer toutes les informations modifiables
  
  Cette migration étend la fonction update_client_complete pour gérer :
  - Abonnements (plan, statut, dates, montant, mode paiement)
  - Modules actifs (activation/désactivation)
  - Options d'abonnement
  - Préférences (theme, langue, notifications)
*/

-- ========================================
-- Fonction update_client_complete étendue
-- ========================================

-- Supprimer toutes les versions existantes de la fonction
-- (utiliser un bloc DO pour supprimer toutes les signatures)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc 
    WHERE proname = 'update_client_complete'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Créer la nouvelle fonction avec la signature étendue
CREATE OR REPLACE FUNCTION update_client_complete(
  p_client_id uuid,
  -- Informations client de base
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_entreprise_nom text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_portable text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_pays text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_tva_intracommunautaire text DEFAULT NULL,
  p_statut text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  -- Abonnement
  p_plan_id uuid DEFAULT NULL,
  p_abonnement_statut text DEFAULT NULL,
  p_date_debut date DEFAULT NULL,
  p_date_fin date DEFAULT NULL,
  p_date_prochain_paiement date DEFAULT NULL,
  p_montant_mensuel numeric DEFAULT NULL,
  p_mode_paiement text DEFAULT NULL,
  -- Espace membre
  p_espace_actif boolean DEFAULT NULL,
  p_modules_actifs jsonb DEFAULT NULL,
  p_preferences jsonb DEFAULT NULL,
  -- Options d'abonnement
  p_options_actives uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_client RECORD;
  v_has_permission boolean := false;
  v_espace_id uuid;
  v_abonnement_id uuid;
  v_auth_user_id uuid;
  v_plan RECORD;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié');
  END IF;
  
  -- Vérifier que le client existe
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client non trouvé');
  END IF;
  
  -- Vérifier les permissions
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs 
    WHERE id = v_user_id AND role = 'super_admin'
  ) INTO v_has_permission;
  
  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM entreprises e
      WHERE e.id = v_client.entreprise_id
        AND (
          e.user_id = v_user_id
          OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            WHERE emc.entreprise_id = e.id
              AND emc.user_id = v_user_id
              AND emc.statut_compte = 'actif'
          )
        )
    ) INTO v_has_permission;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée : accès aux paramètres clients requis');
  END IF;
  
  -- Mettre à jour le client de base
  UPDATE clients
  SET
    nom = COALESCE(p_nom, nom),
    prenom = COALESCE(p_prenom, prenom),
    entreprise_nom = COALESCE(p_entreprise_nom, entreprise_nom),
    email = COALESCE(p_email, email),
    telephone = COALESCE(p_telephone, telephone),
    portable = COALESCE(p_portable, portable),
    adresse = COALESCE(p_adresse, adresse),
    code_postal = COALESCE(p_code_postal, code_postal),
    ville = COALESCE(p_ville, ville),
    pays = COALESCE(p_pays, pays),
    siret = COALESCE(p_siret, siret),
    tva_intracommunautaire = COALESCE(p_tva_intracommunautaire, tva_intracommunautaire),
    statut = COALESCE(p_statut, statut),
    notes = COALESCE(p_notes, notes),
    tags = COALESCE(p_tags, tags),
    updated_at = now()
  WHERE id = p_client_id;
  
  -- Si l'email a changé, mettre à jour aussi dans auth.users et utilisateurs
  IF p_email IS NOT NULL AND p_email != v_client.email THEN
    -- Récupérer l'ID auth.users via l'email
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = v_client.email;
    
    IF v_auth_user_id IS NOT NULL THEN
      -- Mettre à jour auth.users
      UPDATE auth.users
      SET email = p_email, updated_at = now()
      WHERE id = v_auth_user_id;
      
      -- Mettre à jour utilisateurs
      UPDATE utilisateurs
      SET email = p_email, updated_at = now()
      WHERE email = v_client.email OR id = v_auth_user_id;
    END IF;
  END IF;
  
  -- Récupérer ou créer l'espace membre
  SELECT id INTO v_espace_id 
  FROM espaces_membres_clients 
  WHERE client_id = p_client_id;
  
  IF v_espace_id IS NULL THEN
    -- Récupérer l'auth_user_id pour l'espace membre
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = COALESCE(p_email, v_client.email);
    
    INSERT INTO espaces_membres_clients (
      client_id,
      entreprise_id,
      user_id,
      actif,
      modules_actifs,
      preferences
    ) VALUES (
      p_client_id,
      v_client.entreprise_id,
      v_auth_user_id,
      COALESCE(p_espace_actif, true),
      COALESCE(p_modules_actifs, '{}'::jsonb),
      COALESCE(p_preferences, '{"theme": "dark", "langue": "fr", "notifications": true}'::jsonb)
    )
    RETURNING id INTO v_espace_id;
  ELSE
    -- Mettre à jour l'espace membre
    UPDATE espaces_membres_clients
    SET
      actif = COALESCE(p_espace_actif, actif),
      modules_actifs = COALESCE(p_modules_actifs, modules_actifs),
      preferences = COALESCE(p_preferences, preferences),
      updated_at = now()
    WHERE id = v_espace_id;
  END IF;
  
  -- Gérer l'abonnement si un plan_id est fourni
  IF p_plan_id IS NOT NULL THEN
    -- Vérifier que le plan existe
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = p_plan_id AND actif = true;
    
    IF FOUND THEN
      -- Récupérer l'auth_user_id pour l'abonnement
      SELECT id INTO v_auth_user_id FROM auth.users WHERE email = COALESCE(p_email, v_client.email);
      
      IF v_auth_user_id IS NULL THEN
        SELECT user_id INTO v_auth_user_id FROM espaces_membres_clients WHERE id = v_espace_id;
      END IF;
      
      -- Vérifier si un abonnement existe déjà
      SELECT id INTO v_abonnement_id 
      FROM abonnements 
      WHERE client_id = v_auth_user_id 
        AND entreprise_id = v_client.entreprise_id;
      
      IF v_abonnement_id IS NULL THEN
        -- Créer un nouvel abonnement
        INSERT INTO abonnements (
          client_id,
          entreprise_id,
          plan_id,
          statut,
          date_debut,
          date_fin,
          date_prochain_paiement,
          montant_mensuel,
          mode_paiement
        ) VALUES (
          v_auth_user_id,
          v_client.entreprise_id,
          p_plan_id,
          COALESCE(p_abonnement_statut, 'actif'),
          COALESCE(p_date_debut, CURRENT_DATE),
          p_date_fin,
          p_date_prochain_paiement,
          COALESCE(p_montant_mensuel, v_plan.prix_mensuel),
          COALESCE(p_mode_paiement, 'mensuel')
        )
        RETURNING id INTO v_abonnement_id;
      ELSE
        -- Mettre à jour l'abonnement existant
        UPDATE abonnements
        SET
          plan_id = p_plan_id,
          statut = COALESCE(p_abonnement_statut, statut),
          date_debut = COALESCE(p_date_debut, date_debut),
          date_fin = p_date_fin,
          date_prochain_paiement = p_date_prochain_paiement,
          montant_mensuel = COALESCE(p_montant_mensuel, montant_mensuel),
          mode_paiement = COALESCE(p_mode_paiement, mode_paiement),
          updated_at = now()
        WHERE id = v_abonnement_id;
      END IF;
      
      -- Lier l'abonnement à l'espace membre
      UPDATE espaces_membres_clients
      SET abonnement_id = v_abonnement_id
      WHERE id = v_espace_id;
    END IF;
  END IF;
  
  -- Gérer les options d'abonnement si fournies
  IF p_options_actives IS NOT NULL AND v_abonnement_id IS NOT NULL THEN
    -- Supprimer les options non présentes
    DELETE FROM abonnement_options
    WHERE abonnement_id = v_abonnement_id
      AND option_id != ALL(p_options_actives);
    
    -- Ajouter les nouvelles options
    INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_activation)
    SELECT v_abonnement_id, unnest(p_options_actives), true, CURRENT_DATE
    ON CONFLICT (abonnement_id, option_id) DO UPDATE
    SET actif = true, date_activation = CURRENT_DATE;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Client mis à jour avec succès',
    'client_id', p_client_id,
    'espace_id', v_espace_id,
    'abonnement_id', v_abonnement_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION update_client_complete IS 
  'Met à jour toutes les informations modifiables d''un client (données personnelles, abonnement, modules, options, préférences) avec vérification des permissions.';

GRANT EXECUTE ON FUNCTION update_client_complete TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250130000001 appliquée';
  RAISE NOTICE '📋 Fonction update_client_complete étendue avec toutes les informations modifiables';
END $$;

