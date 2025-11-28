/*
  # Suppression complète des plans d'abonnement

  Problème :
  - La fonction delete_plan_abonnement_safe existante ne supprimait
    pas complètement les données (plans, modules, abonnements, options).
  - Des plans "fantômes" restaient en base, empêchant la création d'un
    nouveau plan avec le même nom (duplicate key).

  Solution :
  - Recréer delete_plan_abonnement_safe pour effectuer une suppression
    cascade contrôlée de toutes les données associées au plan.
*/

DROP FUNCTION IF EXISTS delete_plan_abonnement_safe(uuid);

CREATE OR REPLACE FUNCTION delete_plan_abonnement_safe(
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_plan RECORD;
  v_abonnement_ids uuid[];
  v_deleted_abonnements integer := 0;
  v_deleted_options integer := 0;
BEGIN
  -- Vérifier les permissions (super admin plateforme uniquement)
  IF NOT is_platform_super_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super administrateur plateforme requis'
    );
  END IF;

  -- Vérifier que le plan existe
  SELECT * INTO v_plan
  FROM plans_abonnement
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan introuvable'
    );
  END IF;

  -- Récupérer les abonnements liés
  SELECT array_agg(id) INTO v_abonnement_ids
  FROM abonnements
  WHERE plan_id = p_plan_id;

  -- Supprimer les options liées aux abonnements
  IF v_abonnement_ids IS NOT NULL THEN
    DELETE FROM abonnement_options
    WHERE abonnement_id = ANY(v_abonnement_ids);
    GET DIAGNOSTICS v_deleted_options = ROW_COUNT;

    DELETE FROM abonnements
    WHERE id = ANY(v_abonnement_ids);
    GET DIAGNOSTICS v_deleted_abonnements = ROW_COUNT;
  END IF;

  -- Supprimer les permissions et modules liés au plan
  DELETE FROM plan_permissions WHERE plan_id = p_plan_id;
  DELETE FROM plans_modules WHERE plan_id = p_plan_id;

  -- Supprimer le plan lui-même
  DELETE FROM plans_abonnement WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'deleted_abonnements', v_deleted_abonnements,
    'deleted_options', v_deleted_options,
    'message', format(
      'Plan "%s" supprimé définitivement (%s abonnements supprimés)',
      v_plan.nom,
      COALESCE(v_deleted_abonnements, 0)
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_plan_abonnement_safe(uuid) TO authenticated;




