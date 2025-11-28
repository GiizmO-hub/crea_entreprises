/*
  # FIX COMPLET : Modules et Synchronisation
  
  OBJECTIF:
  1. ✅ Corriger sync_client_modules_from_plan pour accepter soit (p_espace_id) soit (p_client_id, p_plan_id)
  2. ✅ Vérifier que get_plan_modules existe et retourne les bons modules
  3. ✅ S'assurer que TOUS les modules créés sont activés dans plan_modules avec activer=true
  4. ✅ Corriger l'affichage dans l'interface GestionPlans
*/

-- ============================================================================
-- PARTIE 1 : Corriger sync_client_modules_from_plan pour accepter les deux signatures
-- ============================================================================

-- Supprimer les anciennes versions
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid, uuid) CASCADE;

-- Créer la version avec p_espace_id (pour compatibilité avec le frontend actuel)
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(
  p_espace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_id uuid;
  v_plan_id uuid;
  v_abonnement_id uuid;
  v_entreprise_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_plan] 🚀 DÉBUT - Espace ID: %', p_espace_id;
  
  -- 1. Récupérer le client_id et l'abonnement depuis l'espace membre
  SELECT client_id, entreprise_id, abonnement_id
  INTO v_client_id, v_entreprise_id, v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id
  LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Espace membre non trouvé: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  -- 2. Récupérer le plan_id depuis l'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE id = v_abonnement_id AND statut = 'actif'
    LIMIT 1;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Aucun abonnement actif trouvé pour l''espace: %', p_espace_id;
    RETURN jsonb_build_object('success', false, 'error', 'Aucun abonnement actif');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Client: %, Plan: %', v_client_id, v_plan_id;
  
  -- 3. Récupérer les modules du plan activés
  FOR v_module_record IN
    SELECT pm.module_code, pm.module_nom
    FROM plan_modules pm
    WHERE pm.plan_id = v_plan_id AND pm.activer = true
  LOOP
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- 4. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'tableau_de_bord', true,
    'mon_entreprise', true,
    'factures', true,
    'documents', true,
    'abonnements', true
  );
  
  -- 5. Mettre à jour l'espace membre
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = now()
  WHERE id = p_espace_id;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés: % modules', jsonb_object_keys(v_modules_json);
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_actifs', v_modules_json,
    'espace_membre_id', p_espace_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan(uuid) IS 
  'Synchronise les modules d''un espace client depuis son plan d''abonnement. Version avec p_espace_id.';

-- Créer aussi la version avec p_client_id et p_plan_id (pour compatibilité)
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(
  p_client_id uuid,
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_membre_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
  v_entreprise_id uuid;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_plan] 🚀 DÉBUT - Client: %, Plan: %', p_client_id, p_plan_id;
  
  -- 1. Récupérer l'espace membre du client
  SELECT id, entreprise_id INTO v_espace_membre_id, v_entreprise_id
  FROM espaces_membres_clients
  WHERE client_id = p_client_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ Espace membre non trouvé pour client: %', p_client_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Espace membre trouvé: %, Entreprise: %', v_espace_membre_id, v_entreprise_id;
  
  -- 2. Récupérer les modules associés au plan
  FOR v_module_record IN
    SELECT module_code, module_nom
    FROM plan_modules
    WHERE plan_id = p_plan_id AND activer = true
  LOOP
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- 3. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'tableau_de_bord', true,
    'mon_entreprise', true,
    'factures', true,
    'documents', true,
    'abonnements', true
  );
  
  -- 4. Mettre à jour l'espace membre avec les modules
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = now()
  WHERE id = v_espace_membre_id;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés: % modules', jsonb_object_keys(v_modules_json);
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_actifs', v_modules_json,
    'espace_membre_id', v_espace_membre_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[sync_client_modules_from_plan] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'
    );
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan(uuid, uuid) IS 
  'Synchronise les modules d''un client avec son plan d''abonnement. Version avec p_client_id et p_plan_id.';

-- ============================================================================
-- PARTIE 2 : Vérifier/Créer get_plan_modules
-- ============================================================================

DROP FUNCTION IF EXISTS get_plan_modules(uuid) CASCADE;

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
  SELECT 
    COALESCE(pm.module_code, ma.module_code, '')::text as module_code,
    COALESCE(pm.module_nom, ma.module_nom, '')::text as module_nom,
    COALESCE(ma.module_description, '')::text as module_description,
    COALESCE(ma.categorie, 'autre')::text as categorie,
    COALESCE(pm.activer, false)::boolean as inclus,
    COALESCE(ma.prix_optionnel, 0)::numeric as prix_mensuel,
    0::numeric as prix_annuel,
    COALESCE(ma.est_cree, false)::boolean as est_cree,
    COALESCE(ma.actif, false)::boolean as actif
  FROM modules_activation ma
  LEFT JOIN plan_modules pm ON pm.module_code = ma.module_code AND pm.plan_id = p_plan_id
  WHERE ma.est_cree = true OR pm.plan_id = p_plan_id
  ORDER BY ma.module_nom;
END;
$$;

COMMENT ON FUNCTION get_plan_modules IS 
  'Récupère tous les modules créés avec leur statut dans un plan (inclus ou non).';

-- ============================================================================
-- PARTIE 3 : S'assurer que TOUS les modules créés sont activés dans chaque plan
-- ============================================================================

DO $$
DECLARE
  v_plan_record RECORD;
  v_module_record RECORD;
  v_modules_crees text[] := ARRAY[]::text[];
  v_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  🔧 ACTIVATION DES MODULES CRÉÉS DANS LES PLANS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- 1. Récupérer tous les modules créés
  BEGIN
    FOR v_module_record IN
      SELECT DISTINCT module_code, module_nom
      FROM modules_activation
      WHERE (est_cree = true OR actif = true)
      ORDER BY module_code
    LOOP
      v_modules_crees := array_append(v_modules_crees, v_module_record.module_code);
      RAISE NOTICE '✅ Module créé: % (%)', v_module_record.module_code, v_module_record.module_nom;
    END LOOP;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '⚠️  Table modules_activation non trouvée';
  END;
  
  IF array_length(v_modules_crees, 1) IS NULL OR array_length(v_modules_crees, 1) = 0 THEN
    RAISE NOTICE '⚠️  Aucun module créé trouvé, utilisation liste par défaut';
    v_modules_crees := ARRAY[
      'dashboard', 'clients', 'facturation', 'factures', 'documents',
      'collaborateurs', 'gestion-equipe', 'gestion-projets'
    ];
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Total modules créés: %', array_length(v_modules_crees, 1);
  RAISE NOTICE '';
  
  -- 2. Pour chaque plan, activer les modules appropriés
  FOR v_plan_record IN
    SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre
  LOOP
    RAISE NOTICE '🔧 Plan: %', v_plan_record.nom;
    v_count := 0;
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Déterminer si le module doit être activé pour ce plan
      DECLARE
        v_doit_activer boolean := false;
        v_module_nom text;
      BEGIN
        -- Récupérer le nom du module
        BEGIN
          SELECT module_nom INTO v_module_nom
          FROM modules_activation
          WHERE module_code = v_module_record.module_code
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            v_module_nom := v_module_record.module_code;
        END;
        
        IF v_module_nom IS NULL THEN
          v_module_nom := v_module_record.module_code;
        END IF;
        
        -- Déterminer selon le plan
        CASE v_plan_record.nom
          WHEN 'Starter' THEN
            v_doit_activer := v_module_record.module_code IN ('dashboard', 'clients', 'facturation', 'factures', 'documents');
          WHEN 'Business' THEN
            v_doit_activer := v_module_record.module_code IN (
              'dashboard', 'clients', 'facturation', 'factures', 'documents',
              'comptabilite', 'salaries', 'automatisations', 'messagerie'
            );
          WHEN 'Professional' THEN
            v_doit_activer := v_module_record.module_code IN (
              'dashboard', 'clients', 'facturation', 'factures', 'documents',
              'comptabilite', 'salaries', 'automatisations', 'messagerie',
              'administration', 'api', 'support_prioritaire',
              'collaborateurs', 'gestion-equipe', 'gestion-projets'
            );
          WHEN 'Enterprise' THEN
            v_doit_activer := true; -- Tous les modules pour Enterprise
          ELSE
            v_doit_activer := false;
        END CASE;
        
        -- Activer le module si nécessaire
        IF v_doit_activer THEN
          INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
          VALUES (v_plan_record.id, v_module_record.module_code, v_module_nom, true)
          ON CONFLICT (plan_id, module_code) DO UPDATE
          SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
          
          v_count := v_count + 1;
        END IF;
      END;
    END LOOP;
    
    RAISE NOTICE '  ✅ % module(s) activé(s)', v_count;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ ACTIVATION TERMINÉE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- PARTIE 4 : Vérification finale
-- ============================================================================

DO $$
DECLARE
  v_plan_record RECORD;
  v_module_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ PAR PLAN';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  FOR v_plan_record IN
    SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre
  LOOP
    SELECT COUNT(*) INTO v_module_count
    FROM plan_modules
    WHERE plan_id = v_plan_record.id AND activer = true;
    
    RAISE NOTICE '  Plan % : % module(s) activé(s)', v_plan_record.nom, v_module_count;
  END LOOP;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT '✅ Migration complète appliquée avec succès !' as resultat;

