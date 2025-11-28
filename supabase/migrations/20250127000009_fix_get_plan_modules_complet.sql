/*
  # FIX : get_plan_modules pour retourner TOUS les modules du plan
  
  PROBLÈME:
  - get_plan_modules ne retourne que les modules créés (est_cree = true)
  - Mais les plans ont aussi des modules qui ne sont pas dans modules_activation
  - Résultat : l'interface ne voit pas tous les modules activés dans le plan
  
  SOLUTION:
  - Modifier get_plan_modules pour retourner TOUS les modules de plan_modules
  - Inclure les informations de modules_activation si disponibles
  - Retourner les modules même s'ils ne sont pas dans modules_activation
*/

-- Supprimer l'ancienne version
DROP FUNCTION IF EXISTS get_plan_modules(uuid) CASCADE;

-- Créer la nouvelle version qui retourne TOUS les modules du plan
CREATE OR REPLACE FUNCTION get_plan_modules(
  p_plan_id uuid
)
RETURNS TABLE (
  module_code text,
  module_nom text,
  module_description text,
  categorie text,
  inclus boolean,
  prix_mensuel numeric,
  prix_annuel numeric,
  est_cree boolean,
  actif boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Retourner TOUS les modules de plan_modules pour ce plan
  -- + les modules créés dans modules_activation qui ne sont pas encore dans plan_modules
  
  SELECT DISTINCT ON (module_code_final)
    module_code_final::text as module_code,
    module_nom_final::text as module_nom,
    module_description_final::text as module_description,
    categorie_final::text as categorie,
    inclus_final::boolean as inclus,
    prix_mensuel_final::numeric as prix_mensuel,
    prix_annuel_final::numeric as prix_annuel,
    est_cree_final::boolean as est_cree,
    actif_final::boolean as actif
  FROM (
    SELECT 
      COALESCE(pm.module_code, ma.module_code) as module_code_final,
      COALESCE(pm.module_nom, ma.module_nom, COALESCE(pm.module_code, ma.module_code)) as module_nom_final,
      COALESCE(ma.module_description, '') as module_description_final,
      COALESCE(ma.categorie, 'autre') as categorie_final,
      COALESCE(pm.activer, false) as inclus_final,
      COALESCE(ma.prix_optionnel, 0) as prix_mensuel_final,
      0 as prix_annuel_final,
      COALESCE(ma.est_cree, false) as est_cree_final,
      COALESCE(ma.actif, false) as actif_final
    FROM plan_modules pm
    FULL OUTER JOIN modules_activation ma ON ma.module_code = pm.module_code
    WHERE (pm.plan_id = p_plan_id) 
       OR (ma.est_cree = true AND NOT EXISTS (
         SELECT 1 FROM plan_modules pm2 
         WHERE pm2.plan_id = p_plan_id AND pm2.module_code = ma.module_code
       ))
  ) subquery
  ORDER BY 
    module_code_final,
    CASE WHEN inclus_final = true THEN 0 ELSE 1 END, -- Modules activés en premier
    categorie_final,
    module_nom_final;
END;
$$;

COMMENT ON FUNCTION get_plan_modules IS 
  'Récupère TOUS les modules d''un plan (ceux dans plan_modules + ceux créés dans modules_activation). Retourne tous les modules avec leur statut (inclus ou non).';

-- Test de la fonction
DO $$
DECLARE
  v_plan_record RECORD;
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  🧪 TEST DE get_plan_modules';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  FOR v_plan_record IN
    SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre LIMIT 1
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM get_plan_modules(v_plan_record.id);
    
    RAISE NOTICE '  Plan "%" : % module(s) retourné(s)', v_plan_record.nom, v_count;
  END LOOP;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT '✅ Fonction get_plan_modules corrigée avec succès !' as resultat;

