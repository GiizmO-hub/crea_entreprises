/*
  # Correction permissions get_client_super_admin_status et vérification modules
  
  PROBLÈME 1:
  - Erreur "Accès non autorisé - Super admin plateforme requis"
  - La fonction is_platform_super_admin() ne fonctionne pas correctement
  
  PROBLÈME 2:
  - Modules "gestion d'équipe", "gestion des collaborateurs", "gestion de projet" ne s'affichent pas
  - Vérifier que les codes de modules correspondent au mapping
*/

-- ✅ 1. Supprimer toutes les versions existantes de is_platform_super_admin
DROP FUNCTION IF EXISTS is_platform_super_admin();
DROP FUNCTION IF EXISTS is_platform_super_admin(uuid);
DROP FUNCTION IF EXISTS is_platform_super_admin(text);

-- ✅ 2. Corriger is_platform_super_admin pour qu'elle fonctionne correctement
CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Vérifier que l'utilisateur est super_admin dans auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND COALESCE((raw_user_meta_data->>'role')::text, '') = 'super_admin'
  ) THEN
    RETURN false;
  END IF;
  
  -- IMPORTANT: Vérifier que l'utilisateur N'EST PAS un client (n'a pas d'espace membre)
  -- Un super_admin plateforme ne doit pas avoir d'espace_membre
  IF EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = auth.uid()
  ) THEN
    RETURN false; -- C'est un client, pas un super_admin plateforme
  END IF;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin IS 'Vérifie si l''utilisateur est un super_admin de la plateforme (pas un client)';

-- ✅ 3. Corriger get_client_super_admin_status pour utiliser is_platform_super_admin correctement
CREATE OR REPLACE FUNCTION get_client_super_admin_status(p_entreprise_id uuid)
RETURNS TABLE (
  client_id uuid,
  is_super_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT is_platform_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Retourner le statut super_admin de tous les clients de l'entreprise
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    COALESCE(
      (SELECT u.role = 'client_super_admin' FROM utilisateurs u WHERE u.id = emc.user_id),
      false
    ) AS is_super_admin
  FROM clients c
  LEFT JOIN espaces_membres_clients emc ON emc.client_id = c.id
  WHERE c.entreprise_id = p_entreprise_id;
END;
$$;

COMMENT ON FUNCTION get_client_super_admin_status IS 'Retourne le statut super_admin de tous les clients d''une entreprise. Nécessite d''être super_admin plateforme.';

-- ✅ 4. Créer une fonction pour diagnostiquer les modules d'un client
CREATE OR REPLACE FUNCTION get_client_modules_debug(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
  v_espace_id uuid;
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb;
BEGIN
  -- Récupérer l'espace membre
  SELECT id, abonnement_id, modules_actifs
  INTO v_espace_id, v_abonnement_id, v_modules_json
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  LIMIT 1;

  IF v_espace_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Aucun espace membre trouvé pour ce client',
      'client_id', p_client_id
    );
  END IF;

  -- Récupérer le plan
  IF v_abonnement_id IS NOT NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE id = v_abonnement_id
      AND statut = 'actif';
  END IF;

  -- Récupérer les modules du plan
  v_result := jsonb_build_object(
    'client_id', p_client_id,
    'espace_id', v_espace_id,
    'abonnement_id', v_abonnement_id,
    'plan_id', v_plan_id,
    'modules_actifs', v_modules_json,
    'modules_dans_plan', (
      SELECT jsonb_agg(jsonb_build_object(
        'module_code', pm.module_code,
        'inclus', pm.inclus
      ))
      FROM plans_modules pm
      WHERE pm.plan_id = v_plan_id
        AND pm.inclus = true
    ),
    'modules_dans_modules_activation', (
      SELECT jsonb_agg(jsonb_build_object(
        'module_code', ma.module_code,
        'module_nom', ma.module_nom,
        'actif', ma.actif,
        'est_cree', ma.est_cree
      ))
      FROM modules_activation ma
      WHERE ma.module_code IN (
        SELECT pm.module_code
        FROM plans_modules pm
        WHERE pm.plan_id = v_plan_id
          AND pm.inclus = true
      )
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_client_modules_debug IS 'Fonction de debug pour diagnostiquer les modules d''un client.';

-- ✅ 5. Vérifier et synchroniser les modules pour tous les espaces clients
DO $$
DECLARE
  v_synced_count integer := 0;
BEGIN
  -- Synchroniser tous les espaces clients
  PERFORM sync_all_client_spaces_modules();
  
  RAISE NOTICE '✅ Modules synchronisés pour tous les espaces clients';
END $$;

