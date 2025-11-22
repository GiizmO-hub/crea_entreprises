/*
  # Fonctions pour activer/désactiver les options/modules
  
  1. Fonction toggle_module_option : Activer/désactiver une option pour un abonnement
  2. Fonction get_user_active_modules : Récupérer les modules actifs d'un utilisateur
*/

-- 1. Fonction pour activer/désactiver une option/module
CREATE OR REPLACE FUNCTION toggle_module_option(
  p_option_code text,
  p_user_id uuid DEFAULT auth.uid(),
  p_activer boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_id uuid;
  v_option_id uuid;
  v_abonnement_option_id uuid;
  v_is_super_admin boolean;
BEGIN
  -- Vérifier si l'utilisateur est super_admin
  SELECT is_super_admin() INTO v_is_super_admin;
  
  -- Récupérer l'abonnement actif de l'utilisateur
  IF v_is_super_admin THEN
    -- Super admin peut activer/désactiver pour tous les utilisateurs
    -- Utiliser le user_id fourni ou auth.uid()
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE user_id = COALESCE(p_user_id, auth.uid())
      AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    -- Utilisateur normal ne peut modifier que son propre abonnement
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE user_id = auth.uid()
      AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_abonnement_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun abonnement actif trouvé'
    );
  END IF;

  -- Récupérer l'ID de l'option par son code ou nom
  SELECT id INTO v_option_id
  FROM options_supplementaires
  WHERE (
    LOWER(nom) = LOWER(p_option_code) 
    OR LOWER(REPLACE(nom, ' ', '_')) = LOWER(p_option_code)
    OR code = p_option_code
  )
  AND actif = true
  LIMIT 1;

  IF v_option_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Option non trouvée: ' || p_option_code
    );
  END IF;

  -- Vérifier si l'option existe déjà pour cet abonnement
  SELECT id INTO v_abonnement_option_id
  FROM abonnement_options
  WHERE abonnement_id = v_abonnement_id
    AND option_id = v_option_id;

  IF p_activer THEN
    -- Activer l'option
    IF v_abonnement_option_id IS NULL THEN
      -- Créer l'entrée si elle n'existe pas
      INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_activation)
      VALUES (v_abonnement_id, v_option_id, true, CURRENT_DATE)
      RETURNING id INTO v_abonnement_option_id;
    ELSE
      -- Réactiver l'option existante
      UPDATE abonnement_options
      SET actif = true,
          date_activation = CURRENT_DATE,
          date_desactivation = NULL
      WHERE id = v_abonnement_option_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Option activée avec succès',
      'option_id', v_option_id,
      'abonnement_option_id', v_abonnement_option_id
    );
  ELSE
    -- Désactiver l'option
    IF v_abonnement_option_id IS NOT NULL THEN
      UPDATE abonnement_options
      SET actif = false,
          date_desactivation = CURRENT_DATE
      WHERE id = v_abonnement_option_id;

      RETURN jsonb_build_object(
        'success', true,
        'message', 'Option désactivée avec succès',
        'option_id', v_option_id,
        'abonnement_option_id', v_abonnement_option_id
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Option non activée pour cet abonnement'
      );
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 2. Fonction pour obtenir les modules actifs d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_active_modules(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_fonctionnalites jsonb;
  v_plan_nom text;
  v_options_actives jsonb;
  v_is_super_admin boolean;
BEGIN
  -- Vérifier si l'utilisateur est super_admin
  SELECT is_super_admin() INTO v_is_super_admin;
  
  IF v_is_super_admin THEN
    -- Super admin a accès à tous les modules
    RETURN jsonb_build_object(
      'success', true,
      'modules_actifs', jsonb_build_array('*'), -- Tous les modules
      'plan_nom', 'Super Admin',
      'options_actives', jsonb_build_array()
    );
  END IF;

  -- Récupérer l'abonnement actif
  SELECT 
    ab.id,
    pa.fonctionnalites,
    pa.nom
  INTO v_abonnement_id, v_plan_fonctionnalites, v_plan_nom
  FROM abonnements ab
  JOIN plans_abonnement pa ON pa.id = ab.plan_id
  WHERE ab.user_id = COALESCE(p_user_id, auth.uid())
    AND ab.statut = 'actif'
  ORDER BY ab.created_at DESC
  LIMIT 1;

  IF v_abonnement_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun abonnement actif trouvé'
    );
  END IF;

  -- Récupérer les options actives
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', opt.id,
      'nom', opt.nom,
      'code', LOWER(REPLACE(opt.nom, ' ', '_'))
    )
  )
  INTO v_options_actives
  FROM abonnement_options ao
  JOIN options_supplementaires opt ON opt.id = ao.option_id
  WHERE ao.abonnement_id = v_abonnement_id
    AND ao.actif = true;

  RETURN jsonb_build_object(
    'success', true,
    'modules_actifs', v_plan_fonctionnalites,
    'plan_nom', v_plan_nom,
    'options_actives', COALESCE(v_options_actives, jsonb_build_array())
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 3. Commentaires pour documentation
COMMENT ON FUNCTION toggle_module_option IS 'Activer/désactiver une option pour un abonnement (super_admin peut modifier tous, utilisateurs peuvent modifier les leurs)';
COMMENT ON FUNCTION get_user_active_modules IS 'Obtenir les modules actifs d\'un utilisateur selon son abonnement et options';

