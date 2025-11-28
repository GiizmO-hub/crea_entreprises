/*
  # Fonctions pour modifier et suspendre/activer les collaborateurs
  
  1. Fonction update_collaborateur : Modifier un collaborateur
  2. Fonction suspendre_collaborateur : Suspendre un collaborateur (statut = suspendue)
  3. Fonction activer_collaborateur : Activer un collaborateur (statut = active)
*/

-- 1. Fonction pour modifier un collaborateur
CREATE OR REPLACE FUNCTION update_collaborateur(
  p_collaborateur_id uuid,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_entreprise_id uuid DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_poste text DEFAULT NULL,
  p_date_embauche date DEFAULT NULL,
  p_salaire numeric(10, 2) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_old_role text;
  v_user_id uuid;
BEGIN
  -- Vérifier que seul super_admin peut modifier
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seuls les super_admin peuvent modifier des collaborateurs'
    );
  END IF;

  -- Récupérer les données actuelles
  SELECT user_id, role INTO v_user_id, v_old_role
  FROM collaborateurs
  WHERE id = p_collaborateur_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Collaborateur non trouvé'
    );
  END IF;

  -- Valider le rôle si fourni
  IF p_role IS NOT NULL AND p_role NOT IN ('collaborateur', 'admin', 'manager', 'comptable', 'commercial', 'super_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle invalide'
    );
  END IF;

  -- Mettre à jour dans collaborateurs
  UPDATE collaborateurs
  SET
    nom = COALESCE(p_nom, nom),
    prenom = COALESCE(p_prenom, prenom),
    telephone = COALESCE(p_telephone, telephone),
    role = COALESCE(p_role, role),
    entreprise_id = COALESCE(p_entreprise_id, entreprise_id),
    departement = COALESCE(p_departement, departement),
    poste = COALESCE(p_poste, poste),
    date_embauche = COALESCE(p_date_embauche, date_embauche),
    salaire = COALESCE(p_salaire, salaire),
    updated_at = NOW()
  WHERE id = p_collaborateur_id;

  -- Si le rôle a changé, mettre à jour dans utilisateurs et auth.users
  IF p_role IS NOT NULL AND p_role != v_old_role THEN
    UPDATE utilisateurs
    SET
      role = p_role,
      updated_at = NOW()
    WHERE id = v_user_id;

    UPDATE auth.users
    SET
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur modifié avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 2. Fonction pour suspendre un collaborateur
CREATE OR REPLACE FUNCTION suspendre_collaborateur(
  p_collaborateur_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Vérifier que seul super_admin peut suspendre
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seuls les super_admin peuvent suspendre des collaborateurs'
    );
  END IF;

  -- Récupérer le user_id
  SELECT user_id INTO v_user_id
  FROM collaborateurs
  WHERE id = p_collaborateur_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Collaborateur non trouvé'
    );
  END IF;

  -- Suspendre dans collaborateurs
  UPDATE collaborateurs
  SET
    statut = 'suspendue',
    updated_at = NOW()
  WHERE id = p_collaborateur_id;

  -- Suspendre dans utilisateurs
  UPDATE utilisateurs
  SET
    statut = 'suspendue',
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Bannir dans auth.users
  UPDATE auth.users
  SET
    banned_until = 'infinity',
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur suspendu avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 3. Fonction pour activer un collaborateur
CREATE OR REPLACE FUNCTION activer_collaborateur(
  p_collaborateur_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Vérifier que seul super_admin peut activer
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seuls les super_admin peuvent activer des collaborateurs'
    );
  END IF;

  -- Récupérer le user_id
  SELECT user_id INTO v_user_id
  FROM collaborateurs
  WHERE id = p_collaborateur_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Collaborateur non trouvé'
    );
  END IF;

  -- Activer dans collaborateurs
  UPDATE collaborateurs
  SET
    statut = 'active',
    updated_at = NOW()
  WHERE id = p_collaborateur_id;

  -- Activer dans utilisateurs
  UPDATE utilisateurs
  SET
    statut = 'active',
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Débannir dans auth.users
  UPDATE auth.users
  SET
    banned_until = NULL,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur activé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. Commentaires pour documentation
COMMENT ON FUNCTION update_collaborateur IS 'Modifier un collaborateur (super_admin uniquement)';
COMMENT ON FUNCTION suspendre_collaborateur IS 'Suspendre un collaborateur (statut = suspendue, bannit dans auth.users)';
COMMENT ON FUNCTION activer_collaborateur IS 'Activer un collaborateur (statut = active, débannit dans auth.users)';




