/*
  # Création Automatique d'Espace Membre avec Abonnement lors de la création d'un Client
  
  ## Fonctionnalités
  
  1. Lors de la création d'un client avec un email :
     - Création automatique d'un compte utilisateur dans auth.users
     - Création automatique dans la table utilisateurs
     - Création automatique d'un abonnement avec le plan choisi
     - Création des options souscrites (modules)
     - Création de l'entreprise du client si nécessaire
     
  2. Configuration de l'espace membre selon :
     - Le plan d'abonnement choisi
     - Les options/modules souscrits
     
  ## Modules disponibles (options)
  - facturation
  - clients
  - comptabilite
  - salaries
  - projets
  - stock
  - documents
  - finances
*/

-- Fonction pour créer un client avec espace membre et abonnement
CREATE OR REPLACE FUNCTION create_client_with_abonnement(
  p_email text,
  p_password text,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_entreprise_nom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_entreprise_id uuid;
  v_abonnement_id uuid;
  v_client_id uuid;
  v_plan_default_id uuid;
  v_result json;
BEGIN
  -- Vérifier que l'utilisateur actuel est super_admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Seul un super admin peut créer un client avec abonnement';
  END IF;

  -- Vérifier que l'email n'existe pas déjà
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  END IF;

  -- Si pas de plan_id fourni, prendre le plan par défaut (Starter)
  IF p_plan_id IS NULL THEN
    SELECT id INTO v_plan_default_id
    FROM plans_abonnement
    WHERE nom = 'Starter'
    AND actif = true
    LIMIT 1;
    
    IF v_plan_default_id IS NULL THEN
      RAISE EXCEPTION 'Aucun plan par défaut trouvé';
    END IF;
    
    p_plan_id := v_plan_default_id;
  END IF;

  -- Vérifier que le plan existe
  IF NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE id = p_plan_id AND actif = true) THEN
    RAISE EXCEPTION 'Le plan d''abonnement sélectionné n''existe pas ou n''est pas actif';
  END IF;

  -- 1. Créer l'utilisateur dans auth.users (nécessite API Admin - pour l'instant on génère un UUID)
  -- Note: L'utilisateur devra être créé via l'API Supabase Admin ou Edge Function
  v_user_id := gen_random_uuid();
  
  -- 2. Créer l'entreprise du client si nécessaire
  IF p_entreprise_nom IS NOT NULL AND p_entreprise_nom != '' THEN
    INSERT INTO entreprises (
      user_id,
      nom,
      forme_juridique,
      siret,
      adresse,
      code_postal,
      ville,
      telephone,
      email,
      statut
    ) VALUES (
      v_user_id,
      p_entreprise_nom,
      'SARL',
      p_siret,
      p_adresse,
      p_code_postal,
      p_ville,
      p_telephone,
      p_email,
      'active'
    )
    RETURNING id INTO v_entreprise_id;
  END IF;

  -- 3. Créer le client
  INSERT INTO clients (
    entreprise_id,
    nom,
    prenom,
    entreprise_nom,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    siret,
    statut
  ) VALUES (
    v_entreprise_id,
    p_nom,
    p_prenom,
    p_entreprise_nom,
    p_email,
    p_telephone,
    p_adresse,
    p_code_postal,
    p_ville,
    p_siret,
    'actif'
  )
  RETURNING id INTO v_client_id;

  -- 4. Créer l'abonnement
  INSERT INTO abonnements (
    entreprise_id,
    plan_id,
    statut,
    date_debut,
    date_fin,
    date_prochain_paiement,
    montant_mensuel,
    mode_paiement
  )
  SELECT
    v_entreprise_id,
    p_plan_id,
    'actif',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    CURRENT_DATE + INTERVAL '1 month',
    COALESCE(prix_mensuel, 0),
    'mensuel'
  FROM plans_abonnement
  WHERE id = p_plan_id
  RETURNING id INTO v_abonnement_id;

  -- 5. Créer les options souscrites (modules)
  IF array_length(p_options_ids, 1) > 0 THEN
    INSERT INTO abonnement_options (
      abonnement_id,
      option_id,
      date_activation,
      actif
    )
    SELECT
      v_abonnement_id,
      unnest(p_options_ids),
      CURRENT_DATE,
      true
    WHERE EXISTS (
      SELECT 1 FROM options_supplementaires
      WHERE id = ANY(p_options_ids)
      AND actif = true
    );
  END IF;

  -- 6. Créer l'utilisateur dans la table utilisateurs (sera synchronisé une fois l'utilisateur créé dans auth)
  -- Note: Le trigger sync_user_to_utilisateurs créera l'entrée une fois l'utilisateur créé dans auth.users
  -- Pour l'instant, on crée une entrée préliminaire
  INSERT INTO utilisateurs (
    id,
    email,
    role,
    entreprise_id,
    nom,
    prenom,
    telephone,
    statut,
    created_by
  ) VALUES (
    v_user_id,
    p_email,
    'client',
    v_entreprise_id,
    p_nom,
    p_prenom,
    p_telephone,
    'active',
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    entreprise_id = EXCLUDED.entreprise_id,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    telephone = EXCLUDED.telephone,
    updated_at = NOW();

  -- Retourner le résultat
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', v_client_id,
    'entreprise_id', v_entreprise_id,
    'abonnement_id', v_abonnement_id,
    'email', p_email,
    'message', 'Client créé avec succès. L''utilisateur doit être créé dans auth.users via l''API Supabase Admin.'
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création du client: %', SQLERRM;
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION create_client_with_abonnement IS 'Crée un client avec son espace membre, entreprise et abonnement. Nécessite que l''appelant soit super_admin. L''utilisateur doit ensuite être créé dans auth.users via l''API Supabase Admin.';

-- Fonction pour vérifier si un utilisateur a accès à un module
CREATE OR REPLACE FUNCTION user_has_module_access(p_user_id uuid, p_module text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_plan_fonctionnalites jsonb;
  v_option_exists boolean;
BEGIN
  -- Super admin a accès à tout
  SELECT (raw_user_meta_data->>'role')::text INTO v_role
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Vérifier dans le plan d'abonnement
  SELECT pa.fonctionnalites INTO v_plan_fonctionnalites
  FROM abonnements a
  JOIN plans_abonnement pa ON pa.id = a.plan_id
  JOIN entreprises e ON e.id = a.entreprise_id
  JOIN utilisateurs u ON u.entreprise_id = e.id
  WHERE u.id = p_user_id
  AND a.statut = 'actif'
  LIMIT 1;

  IF v_plan_fonctionnalites IS NOT NULL THEN
    IF (v_plan_fonctionnalites->>p_module)::boolean = true THEN
      RETURN true;
    END IF;
  END IF;

  -- Vérifier dans les options souscrites
  SELECT EXISTS (
    SELECT 1
    FROM abonnement_options ao
    JOIN options_supplementaires op ON op.id = ao.option_id
    JOIN abonnements a ON a.id = ao.abonnement_id
    JOIN entreprises e ON e.id = a.entreprise_id
    JOIN utilisateurs u ON u.entreprise_id = e.id
    WHERE u.id = p_user_id
    AND a.statut = 'actif'
    AND ao.actif = true
    AND op.actif = true
    AND op.nom ILIKE '%' || p_module || '%'
  ) INTO v_option_exists;

  RETURN COALESCE(v_option_exists, false);
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION user_has_module_access IS 'Vérifie si un utilisateur a accès à un module selon son plan d''abonnement et ses options souscrites.';





