/*
  # ACTIVATION AUTOMATIQUE DES MODULES CRÉÉS DANS LES PLANS
  
  OBJECTIF:
  1. ✅ Identifier les modules déjà créés (est_cree = true)
  2. ✅ Les activer automatiquement dans chaque plan approprié
  3. ✅ S'assurer que les modules créés sont bien disponibles selon le plan
*/

-- ============================================================================
-- PARTIE 1 : Identifier et activer les modules créés dans chaque plan
-- ============================================================================

DO $$
DECLARE
  v_starter_plan_id uuid;
  v_business_plan_id uuid;
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
  v_module_record RECORD;
  v_modules_crees text[] := ARRAY[]::text[];
  v_modules_starter text[] := ARRAY['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements'];
  v_modules_business text[] := ARRAY['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements', 'comptabilite', 'salaries', 'automatisations', 'messagerie'];
  v_modules_professional text[] := ARRAY['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements', 'comptabilite', 'salaries', 'automatisations', 'messagerie', 'administration', 'api', 'support_prioritaire', 'collaborateurs', 'gestion-equipe', 'gestion-projets'];
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_starter_plan_id FROM plans_abonnement WHERE nom = 'Starter' LIMIT 1;
  SELECT id INTO v_business_plan_id FROM plans_abonnement WHERE nom = 'Business' LIMIT 1;
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  -- 1. Identifier les modules créés depuis modules_activation (si la table existe)
  BEGIN
    FOR v_module_record IN
      SELECT DISTINCT module_code, module_nom
      FROM modules_activation
      WHERE (est_cree = true OR actif = true)
    LOOP
      v_modules_crees := array_append(v_modules_crees, v_module_record.module_code);
      RAISE NOTICE 'Module créé identifié: % (%)', v_module_record.module_code, v_module_record.module_nom;
    END LOOP;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'Table modules_activation non trouvée, utilisation de la liste par défaut';
      -- Utiliser les modules de base toujours créés
      v_modules_crees := ARRAY['dashboard', 'clients', 'factures', 'documents', 'collaborateurs', 'gestion-equipe', 'gestion-projets', 'modules', 'gestion-plans', 'parametres'];
  END;
  
  -- Si aucun module trouvé, utiliser la liste par défaut
  IF array_length(v_modules_crees, 1) IS NULL THEN
    v_modules_crees := ARRAY['dashboard', 'clients', 'factures', 'documents', 'collaborateurs', 'gestion-equipe', 'gestion-projets', 'modules', 'gestion-plans', 'parametres'];
  END IF;
  
  RAISE NOTICE 'Total modules créés identifiés: %', array_length(v_modules_crees, 1);
  
  -- 2. Activer les modules dans le plan STARTER
  IF v_starter_plan_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Activation modules créés dans plan STARTER...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Activer seulement si le module fait partie de Starter
      IF v_module_record.module_code = ANY(v_modules_starter) THEN
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        SELECT 
          v_starter_plan_id,
          v_module_record.module_code,
          COALESCE(
            (SELECT module_nom FROM modules_activation WHERE module_code = v_module_record.module_code LIMIT 1),
            (SELECT module_nom FROM plan_modules WHERE module_code = v_module_record.module_code LIMIT 1),
            v_module_record.module_code
          ),
          true
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        RAISE NOTICE '  ✅ % activé dans Starter', v_module_record.module_code;
      END IF;
    END LOOP;
  END IF;
  
  -- 3. Activer les modules dans le plan BUSINESS
  IF v_business_plan_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Activation modules créés dans plan BUSINESS...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Activer seulement si le module fait partie de Business
      IF v_module_record.module_code = ANY(v_modules_business) THEN
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        SELECT 
          v_business_plan_id,
          v_module_record.module_code,
          COALESCE(
            (SELECT module_nom FROM modules_activation WHERE module_code = v_module_record.module_code LIMIT 1),
            (SELECT module_nom FROM plan_modules WHERE module_code = v_module_record.module_code LIMIT 1),
            v_module_record.module_code
          ),
          true
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        RAISE NOTICE '  ✅ % activé dans Business', v_module_record.module_code;
      END IF;
    END LOOP;
  END IF;
  
  -- 4. Activer les modules dans le plan PROFESSIONAL
  IF v_professional_plan_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Activation modules créés dans plan PROFESSIONAL...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Activer seulement si le module fait partie de Professional
      IF v_module_record.module_code = ANY(v_modules_professional) THEN
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        SELECT 
          v_professional_plan_id,
          v_module_record.module_code,
          COALESCE(
            (SELECT module_nom FROM modules_activation WHERE module_code = v_module_record.module_code LIMIT 1),
            (SELECT module_nom FROM plan_modules WHERE module_code = v_module_record.module_code LIMIT 1),
            v_module_record.module_code
          ),
          true
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        RAISE NOTICE '  ✅ % activé dans Professional', v_module_record.module_code;
      END IF;
    END LOOP;
  END IF;
  
  -- 5. Activer TOUS les modules créés dans le plan ENTERPRISE
  IF v_enterprise_plan_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Activation TOUS les modules créés dans plan ENTERPRISE...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      SELECT 
        v_enterprise_plan_id,
        v_module_record.module_code,
        COALESCE(
          (SELECT module_nom FROM modules_activation WHERE module_code = v_module_record.module_code LIMIT 1),
          (SELECT module_nom FROM plan_modules WHERE module_code = v_module_record.module_code LIMIT 1),
          v_module_record.module_code
        ),
        true
      ON CONFLICT (plan_id, module_code) DO UPDATE
      SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
      
      RAISE NOTICE '  ✅ % activé dans Enterprise', v_module_record.module_code;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ ACTIVATION DES MODULES CRÉÉS TERMINÉE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

-- ============================================================================
-- PARTIE 2 : Vérification finale
-- ============================================================================

SELECT '✅ Migration d''activation des modules créés appliquée avec succès !' as resultat;

-- Afficher un résumé par plan
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

