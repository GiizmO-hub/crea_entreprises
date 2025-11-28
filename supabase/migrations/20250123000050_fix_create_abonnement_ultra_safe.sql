/*
  # Fix ULTRA SAFE: Erreur "query returned more than one row" dans create_abonnement_complete
  
  PROBLÈME:
  - L'erreur persiste malgré toutes les corrections
  - La requête SELECT ... INTO avec plusieurs colonnes peut causer des problèmes
  
  SOLUTION:
  - Récupérer les colonnes séparément avec MAX() pour chaque
  - Éviter complètement SELECT ... INTO avec plusieurs colonnes
  - Utiliser uniquement des agrégations
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_montant numeric;
  v_total_montant numeric;
  v_entreprise_id uuid;
  v_user_id uuid;
  v_client_user_id uuid;
  v_client_email text;
  v_client_exists boolean;
  i integer;
BEGIN
  RAISE NOTICE '🚀 [create_abonnement_complete] DÉBUT - Client ID: %, Plan ID: %', p_client_id, p_plan_id;
  
  -- Récupérer le user_id actuel
  v_user_id := auth.uid();
  RAISE NOTICE '👤 [create_abonnement_complete] User ID: %', v_user_id;
  
  -- Vérifier que le client existe (sans SELECT ... INTO)
  RAISE NOTICE '🔍 [create_abonnement_complete] Vérification du client...';
  
  SELECT EXISTS(SELECT 1 FROM clients WHERE id = p_client_id) INTO v_client_exists;
  
  IF NOT v_client_exists THEN
    RAISE WARNING '❌ [create_abonnement_complete] Client non trouvé - ID: %', p_client_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Client non trouvé'
    );
  END IF;

  -- Récupérer entreprise_id du client (SÉPARÉMENT avec MAX)
  SELECT MAX(entreprise_id) INTO v_entreprise_id
  FROM clients
  WHERE id = p_client_id;

  -- Récupérer email du client (SÉPARÉMENT avec MAX)
  SELECT MAX(email) INTO v_client_email
  FROM clients
  WHERE id = p_client_id;

  RAISE NOTICE '✅ [create_abonnement_complete] Client trouvé - Entreprise ID: %, Email: %', v_entreprise_id, v_client_email;

  -- Si aucune entreprise trouvée dans le client, utiliser celle fournie en paramètre
  IF v_entreprise_id IS NULL THEN
    RAISE NOTICE '⚠️ [create_abonnement_complete] Pas d''entreprise dans le client, utilisation du paramètre...';
    IF p_entreprise_id IS NOT NULL THEN
      v_entreprise_id := p_entreprise_id;
      RAISE NOTICE '✅ [create_abonnement_complete] Entreprise ID depuis paramètre: %', v_entreprise_id;
    ELSE
      -- Utiliser MAX(id) pour garantir une seule valeur
      SELECT MAX(id) INTO v_entreprise_id
      FROM entreprises
      WHERE user_id = v_user_id;
      
      RAISE NOTICE '✅ [create_abonnement_complete] Entreprise ID depuis user (première trouvée): %', v_entreprise_id;
    END IF;
  END IF;

  -- Vérifier qu'on a une entreprise
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '❌ [create_abonnement_complete] Aucune entreprise trouvée';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune entreprise trouvée pour ce client. Veuillez créer une entreprise d''abord.'
    );
  END IF;

  -- Récupérer le user_id du client depuis l'espace membre (utiliser MAX)
  SELECT MAX(user_id) INTO v_client_user_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id;

  -- Si pas trouvé dans espace membre, essayer de trouver via email du client
  IF v_client_user_id IS NULL AND v_client_email IS NOT NULL THEN
    -- Utiliser MAX(id) pour garantir une seule valeur
    SELECT MAX(id) INTO v_client_user_id
    FROM auth.users
    WHERE email = v_client_email;
    
    IF v_client_user_id IS NOT NULL THEN
      RAISE NOTICE '👤 [create_abonnement_complete] User ID trouvé via email: %', v_client_user_id;
    END IF;
  ELSE
    IF v_client_user_id IS NOT NULL THEN
      RAISE NOTICE '👤 [create_abonnement_complete] User ID trouvé via espace membre: %', v_client_user_id;
    END IF;
  END IF;
  
  -- Si toujours NULL, on peut laisser NULL (client_id est nullable)
  IF v_client_user_id IS NULL THEN
    RAISE NOTICE '⚠️ [create_abonnement_complete] Pas de user_id trouvé pour le client, client_id sera NULL';
  END IF;

  -- Vérifier que le plan existe
  RAISE NOTICE '🔍 [create_abonnement_complete] Vérification du plan...';
  
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE WARNING '❌ [create_abonnement_complete] Plan non trouvé ou inactif - ID: %', p_plan_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan non trouvé ou inactif'
    );
  END IF;

  -- Récupérer le montant du plan si non fourni (utiliser MAX pour garantir une seule valeur)
  IF p_montant_mensuel IS NULL THEN
    SELECT MAX(
      CASE 
        WHEN p_mode_paiement = 'annuel' THEN prix_annuel / 12
        ELSE prix_mensuel
      END
    ) INTO v_plan_montant
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    -- Si NULL, mettre à 0
    v_plan_montant := COALESCE(v_plan_montant, 0);
    
    RAISE NOTICE '💰 [create_abonnement_complete] Montant plan calculé: %', v_plan_montant;
  ELSE
    v_plan_montant := p_montant_mensuel;
    RAISE NOTICE '💰 [create_abonnement_complete] Montant plan personnalisé: %', v_plan_montant;
  END IF;

  -- Calculer le montant total avec les options
  v_total_montant := v_plan_montant;
  
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    RAISE NOTICE '⚙️ [create_abonnement_complete] Calcul des options...';
    
    -- Utiliser COALESCE pour garantir une valeur même si aucune option trouvée
    v_total_montant := v_plan_montant + COALESCE(
      (SELECT SUM(prix_mensuel) 
       FROM options_supplementaires 
       WHERE id = ANY(p_options_ids) 
       AND actif = true), 
      0
    );
    
    RAISE NOTICE '💰 [create_abonnement_complete] Montant total (plan + options): %', v_total_montant;
  END IF;

  -- Créer l'abonnement avec TOUS les champs requis
  RAISE NOTICE '📝 [create_abonnement_complete] Création de l''abonnement...';
  RAISE NOTICE '   → entreprise_id: %', v_entreprise_id;
  RAISE NOTICE '   → client_id (user_id): %', v_client_user_id;
  RAISE NOTICE '   → plan_id: %', p_plan_id;
  RAISE NOTICE '   → montant: %', v_total_montant;
  
  INSERT INTO abonnements (
    entreprise_id,      -- ✅ Requis
    client_id,          -- ✅ user_id du client (nullable)
    plan_id,
    statut,
    date_debut,
    date_fin,
    montant_mensuel,
    mode_paiement
  )
  VALUES (
    v_entreprise_id,
    v_client_user_id,   -- ✅ user_id du client (peut être NULL)
    p_plan_id,
    p_statut,
    p_date_debut,
    p_date_fin,
    v_total_montant,
    p_mode_paiement
  )
  RETURNING id INTO v_abonnement_id;

  RAISE NOTICE '✅ [create_abonnement_complete] Abonnement créé - ID: %', v_abonnement_id;

  -- Ajouter les options si fournies
  IF p_options_ids IS NOT NULL AND array_length(p_options_ids, 1) > 0 THEN
    RAISE NOTICE '⚙️ [create_abonnement_complete] Ajout des options (% options)...', array_length(p_options_ids, 1);
    
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
        
        RAISE NOTICE '✅ [create_abonnement_complete] Option ajoutée: %', p_options_ids[i];
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE '✅ [create_abonnement_complete] TERMINÉ AVEC SUCCÈS';

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'abonnement_id', v_abonnement_id,
    'montant_mensuel', v_total_montant,
    'message', 'Abonnement créé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [create_abonnement_complete] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION create_abonnement_complete IS 'Créer un abonnement complet - VERSION ULTRA SAFE avec MAX() séparé pour chaque colonne';


