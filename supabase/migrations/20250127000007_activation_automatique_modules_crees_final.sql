/*
  # ACTIVATION AUTOMATIQUE DES MODULES CRÉÉS DANS TOUS LES PLANS
  
  OBJECTIF:
  Activer automatiquement TOUS les modules déjà créés (est_cree = true) 
  dans chaque plan approprié selon le niveau du plan.
  
  RÈGLES:
  - Starter : modules de base uniquement
  - Business : Starter + comptabilité/salariés
  - Professional : Business + modules avancés
  - Enterprise : TOUS les modules créés
*/

-- ============================================================================
-- PARTIE 1 : Identifier les modules créés et les activer dans chaque plan
-- ============================================================================

DO $$
DECLARE
  v_starter_plan_id uuid;
  v_business_plan_id uuid;
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
  v_module_record RECORD;
  v_modules_crees text[] := ARRAY[]::text[];
  v_module_nom text;
  v_count integer := 0;
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_starter_plan_id FROM plans_abonnement WHERE nom = 'Starter' LIMIT 1;
  SELECT id INTO v_business_plan_id FROM plans_abonnement WHERE nom = 'Business' LIMIT 1;
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  🔧 ACTIVATION AUTOMATIQUE DES MODULES CRÉÉS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- 1. Identifier les modules créés depuis modules_activation
  BEGIN
    FOR v_module_record IN
      SELECT DISTINCT module_code, module_nom
      FROM modules_activation
      WHERE (est_cree = true OR actif = true)
      ORDER BY module_code
    LOOP
      v_modules_crees := array_append(v_modules_crees, v_module_record.module_code);
      RAISE NOTICE '✅ Module créé identifié: % (%)', v_module_record.module_code, COALESCE(v_module_record.module_nom, 'N/A');
    END LOOP;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '⚠️  Table modules_activation non trouvée';
  END;
  
  -- Si aucun module trouvé, utiliser la liste par défaut des modules créés
  IF array_length(v_modules_crees, 1) IS NULL OR array_length(v_modules_crees, 1) = 0 THEN
    RAISE NOTICE '⚠️  Aucun module dans modules_activation, utilisation de la liste par défaut';
    v_modules_crees := ARRAY[
      'dashboard', 
      'clients', 
      'facturation',
      'factures',
      'documents', 
      'collaborateurs', 
      'gestion-equipe', 
      'gestion-projets'
    ];
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Total modules créés identifiés: %', array_length(v_modules_crees, 1);
  RAISE NOTICE '';
  
  -- 2. Activer les modules dans le plan STARTER (modules de base uniquement)
  IF v_starter_plan_id IS NOT NULL THEN
    RAISE NOTICE '🔧 Plan STARTER...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Modules de base pour Starter
      IF v_module_record.module_code IN ('dashboard', 'clients', 'facturation', 'factures', 'documents') THEN
        -- Récupérer le nom du module
        BEGIN
          SELECT module_nom INTO v_module_nom
          FROM modules_activation
          WHERE module_code = v_module_record.module_code
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            v_module_nom := NULL;
        END;
        
        IF v_module_nom IS NULL THEN
          v_module_nom := CASE v_module_record.module_code
            WHEN 'dashboard' THEN 'Tableau de bord'
            WHEN 'clients' THEN 'Gestion des clients'
            WHEN 'facturation' THEN 'Facturation'
            WHEN 'factures' THEN 'Facturation'
            WHEN 'documents' THEN 'Gestion de documents'
            ELSE v_module_record.module_code
          END;
        END IF;
        
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        VALUES (v_starter_plan_id, v_module_record.module_code, v_module_nom, true)
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        v_count := v_count + 1;
        RAISE NOTICE '  ✅ % activé', v_module_record.module_code;
      END IF;
    END LOOP;
    
    RAISE NOTICE '  📊 Total Starter: % module(s)', v_count;
    v_count := 0;
    RAISE NOTICE '';
  END IF;
  
  -- 3. Activer les modules dans le plan BUSINESS (Starter + comptabilité/salariés)
  IF v_business_plan_id IS NOT NULL THEN
    RAISE NOTICE '🔧 Plan BUSINESS...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Modules Starter + Business
      IF v_module_record.module_code IN (
        'dashboard', 'clients', 'facturation', 'factures', 'documents',
        'comptabilite', 'salaries', 'automatisations', 'messagerie'
      ) THEN
        BEGIN
          SELECT module_nom INTO v_module_nom
          FROM modules_activation
          WHERE module_code = v_module_record.module_code
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            v_module_nom := NULL;
        END;
        
        IF v_module_nom IS NULL THEN
          v_module_nom := CASE v_module_record.module_code
            WHEN 'dashboard' THEN 'Tableau de bord'
            WHEN 'clients' THEN 'Gestion des clients'
            WHEN 'facturation' THEN 'Facturation'
            WHEN 'factures' THEN 'Facturation'
            WHEN 'documents' THEN 'Gestion de documents'
            WHEN 'comptabilite' THEN 'Comptabilité'
            WHEN 'salaries' THEN 'Gestion des salariés'
            WHEN 'automatisations' THEN 'Automatisations'
            WHEN 'messagerie' THEN 'Messagerie interne'
            ELSE v_module_record.module_code
          END;
        END IF;
        
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        VALUES (v_business_plan_id, v_module_record.module_code, v_module_nom, true)
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        v_count := v_count + 1;
        RAISE NOTICE '  ✅ % activé', v_module_record.module_code;
      END IF;
    END LOOP;
    
    RAISE NOTICE '  📊 Total Business: % module(s)', v_count;
    v_count := 0;
    RAISE NOTICE '';
  END IF;
  
  -- 4. Activer les modules dans le plan PROFESSIONAL (Business + modules avancés)
  IF v_professional_plan_id IS NOT NULL THEN
    RAISE NOTICE '🔧 Plan PROFESSIONAL...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      -- Modules Business + Professional (incluant collaborateurs, gestion-equipe, gestion-projets)
      IF v_module_record.module_code IN (
        'dashboard', 'clients', 'facturation', 'factures', 'documents',
        'comptabilite', 'salaries', 'automatisations', 'messagerie',
        'administration', 'api', 'support_prioritaire',
        'collaborateurs', 'gestion-equipe', 'gestion-projets'
      ) THEN
        BEGIN
          SELECT module_nom INTO v_module_nom
          FROM modules_activation
          WHERE module_code = v_module_record.module_code
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            v_module_nom := NULL;
        END;
        
        IF v_module_nom IS NULL THEN
          v_module_nom := CASE v_module_record.module_code
            WHEN 'dashboard' THEN 'Tableau de bord'
            WHEN 'clients' THEN 'Gestion des clients'
            WHEN 'facturation' THEN 'Facturation'
            WHEN 'factures' THEN 'Facturation'
            WHEN 'documents' THEN 'Gestion de documents'
            WHEN 'comptabilite' THEN 'Comptabilité'
            WHEN 'salaries' THEN 'Gestion des salariés'
            WHEN 'automatisations' THEN 'Automatisations'
            WHEN 'messagerie' THEN 'Messagerie interne'
            WHEN 'administration' THEN 'Administration'
            WHEN 'api' THEN 'API avancée'
            WHEN 'support_prioritaire' THEN 'Support prioritaire'
            WHEN 'collaborateurs' THEN 'Gestion des collaborateurs'
            WHEN 'gestion-equipe' THEN 'Gestion d''équipe'
            WHEN 'gestion-projets' THEN 'Gestion de projets'
            ELSE v_module_record.module_code
          END;
        END IF;
        
        INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
        VALUES (v_professional_plan_id, v_module_record.module_code, v_module_nom, true)
        ON CONFLICT (plan_id, module_code) DO UPDATE
        SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
        
        v_count := v_count + 1;
        RAISE NOTICE '  ✅ % activé', v_module_record.module_code;
      END IF;
    END LOOP;
    
    RAISE NOTICE '  📊 Total Professional: % module(s)', v_count;
    v_count := 0;
    RAISE NOTICE '';
  END IF;
  
  -- 5. Activer TOUS les modules créés dans le plan ENTERPRISE
  IF v_enterprise_plan_id IS NOT NULL THEN
    RAISE NOTICE '🔧 Plan ENTERPRISE...';
    
    FOREACH v_module_record.module_code IN ARRAY v_modules_crees
    LOOP
      BEGIN
        SELECT module_nom INTO v_module_nom
        FROM modules_activation
        WHERE module_code = v_module_record.module_code
        LIMIT 1;
      EXCEPTION
        WHEN OTHERS THEN
          v_module_nom := NULL;
      END;
      
      IF v_module_nom IS NULL THEN
        -- Utiliser le nom depuis plan_modules si disponible
        BEGIN
          SELECT module_nom INTO v_module_nom
          FROM plan_modules
          WHERE module_code = v_module_record.module_code
          LIMIT 1;
        EXCEPTION
          WHEN OTHERS THEN
            v_module_nom := NULL;
        END;
      END IF;
      
      IF v_module_nom IS NULL THEN
        v_module_nom := v_module_record.module_code;
      END IF;
      
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      VALUES (v_enterprise_plan_id, v_module_record.module_code, v_module_nom, true)
      ON CONFLICT (plan_id, module_code) DO UPDATE
      SET activer = true, module_nom = COALESCE(EXCLUDED.module_nom, plan_modules.module_nom);
      
      v_count := v_count + 1;
      RAISE NOTICE '  ✅ % activé', v_module_record.module_code;
    END LOOP;
    
    RAISE NOTICE '  📊 Total Enterprise: % module(s)', v_count;
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ ACTIVATION AUTOMATIQUE TERMINÉE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

-- ============================================================================
-- PARTIE 2 : Vérification finale
-- ============================================================================

SELECT '✅ Migration d''activation automatique des modules créés appliquée avec succès !' as resultat;

-- Afficher un résumé par plan avec les modules créés activés
DO $$
DECLARE
  v_plan_record RECORD;
  v_module_count integer;
  v_module_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ DES MODULES CRÉÉS ACTIVÉS PAR PLAN';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  FOR v_plan_record IN
    SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre
  LOOP
    SELECT COUNT(*) INTO v_module_count
    FROM plan_modules pm
    WHERE pm.plan_id = v_plan_record.id 
      AND pm.activer = true
      AND EXISTS (
        SELECT 1 FROM modules_activation ma
        WHERE ma.module_code = pm.module_code
        AND (ma.est_cree = true OR ma.actif = true)
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '  Plan % :', v_plan_record.nom;
    RAISE NOTICE '    → % module(s) créé(s) activé(s)', v_module_count;
    
    -- Lister les modules créés activés
    FOR v_module_record IN
      SELECT pm.module_code, pm.module_nom
      FROM plan_modules pm
      WHERE pm.plan_id = v_plan_record.id 
        AND pm.activer = true
        AND EXISTS (
          SELECT 1 FROM modules_activation ma
          WHERE ma.module_code = pm.module_code
          AND (ma.est_cree = true OR ma.actif = true)
        )
      ORDER BY pm.module_code
    LOOP
      RAISE NOTICE '      • % (%)', v_module_record.module_code, COALESCE(v_module_record.module_nom, 'N/A');
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

