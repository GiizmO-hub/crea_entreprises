/*
  # Fix Final: Correction de la fonction toggle_module_option
  Version simplifiée qui utilise uniquement entreprise_id (structure de base)
  car c'est la seule colonne garantie d'exister
*/

-- Recréer la fonction toggle_module_option en utilisant uniquement entreprise_id
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
  v_target_user_id uuid;
BEGIN
  -- Vérifier si l'utilisateur est super_admin
  SELECT is_super_admin() INTO v_is_super_admin;
  
  -- Déterminer le user_id cible
  v_target_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Pour utilisateur normal, utiliser uniquement auth.uid()
  IF NOT v_is_super_admin THEN
    v_target_user_id := auth.uid();
  END IF;

  -- Récupérer l'abonnement actif via entreprise_id (structure garantie)
  -- C'est la seule façon qui fonctionne dans tous les cas
  SELECT a.id INTO v_abonnement_id
  FROM abonnements a
  INNER JOIN entreprises e ON e.id = a.entreprise_id
  WHERE a.statut = 'actif'
    AND e.user_id = v_target_user_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_abonnement_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun abonnement actif trouvé pour cet utilisateur'
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

COMMENT ON FUNCTION toggle_module_option IS 'Activer/desactiver une option pour un abonnement (via entreprise_id)';

