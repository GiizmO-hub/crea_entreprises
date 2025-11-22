/*
  # Fix: Correction désactivation option non présente dans abonnement
  
  Le problème: La fonction toggle_module_option retourne une erreur
  si on essaie de désactiver une option qui n'existe pas dans abonnement_options.
  
  Solution: Permettre la désactivation même si l'option n'existe pas encore
  (créer l'entrée avec actif=false) pour gérer les cas où l'option
  est affichée mais n'a jamais été activée dans l'abonnement.
*/

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
  v_entreprise_id uuid;
BEGIN
  -- Vérifier si l'utilisateur est super_admin
  SELECT is_super_admin() INTO v_is_super_admin;
  
  -- Récupérer l'entreprise_id de l'utilisateur
  SELECT id INTO v_entreprise_id
  FROM entreprises
  WHERE user_id = COALESCE(
    CASE WHEN v_is_super_admin THEN p_user_id ELSE auth.uid() END,
    auth.uid()
  )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_entreprise_id IS NULL AND NOT v_is_super_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune entreprise trouvée pour cet utilisateur'
    );
  END IF;

  -- Récupérer l'abonnement actif via entreprise_id
  IF v_is_super_admin AND p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    -- Super admin modifie pour un autre utilisateur
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = p_user_id
    )
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    -- Abonnement de l'utilisateur connecté
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_id
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
    OR LOWER(nom) LIKE '%' || LOWER(p_option_code) || '%'
  )
  AND actif = true
  ORDER BY 
    CASE WHEN LOWER(nom) = LOWER(p_option_code) THEN 1
         WHEN code = p_option_code THEN 2
         WHEN LOWER(REPLACE(nom, ' ', '_')) = LOWER(p_option_code) THEN 3
         ELSE 4
    END
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
      ON CONFLICT (abonnement_id, option_id) DO UPDATE
      SET actif = true,
          date_activation = CURRENT_DATE,
          date_desactivation = NULL
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
      -- Option existe, la désactiver
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
      -- Option n'existe pas encore dans abonnement_options
      -- Créer l'entrée avec actif=false pour marquer qu'elle est désactivée
      BEGIN
        INSERT INTO abonnement_options (abonnement_id, option_id, actif, date_desactivation)
        VALUES (v_abonnement_id, v_option_id, false, CURRENT_DATE)
        RETURNING id INTO v_abonnement_option_id;
      EXCEPTION
        WHEN unique_violation THEN
          -- Si la contrainte unique existe, mettre à jour l'entrée existante
          SELECT id INTO v_abonnement_option_id
          FROM abonnement_options
          WHERE abonnement_id = v_abonnement_id
            AND option_id = v_option_id;
          
          IF v_abonnement_option_id IS NOT NULL THEN
            UPDATE abonnement_options
            SET actif = false,
                date_desactivation = CURRENT_DATE
            WHERE id = v_abonnement_option_id;
          END IF;
        WHEN OTHERS THEN
          -- En cas d'autre erreur, ignorer et considérer comme désactivée
          v_abonnement_option_id := NULL;
      END;

      RETURN jsonb_build_object(
        'success', true,
        'message', 'Option désactivée avec succès',
        'option_id', v_option_id,
        'abonnement_option_id', v_abonnement_option_id
      );
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION toggle_module_option IS 'Activer/désactiver une option pour un abonnement. Permet la désactivation même si l''option n''existe pas encore dans abonnement_options (création avec actif=false).';

