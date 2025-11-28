/*
  # CRÉATION COMPLÈTE DES PLANS D'ABONNEMENT AVEC MODULES
  
  OBJECTIF:
  1. ✅ Créer les 4 plans d'abonnement (Starter, Business, Professional, Enterprise)
  2. ✅ Lier tous les modules existants et futurs aux plans appropriés
  3. ✅ S'assurer que chaque plan a les modules corrects selon son niveau
  4. ✅ Enterprise = TOUS les modules
*/

-- ============================================================================
-- PARTIE 1 : Créer les plans d'abonnement s'ils n'existent pas
-- ============================================================================

-- Plan STARTER
INSERT INTO plans_abonnement (
  nom, 
  description, 
  prix_mensuel, 
  prix_annuel, 
  max_entreprises, 
  max_utilisateurs, 
  ordre, 
  actif,
  fonctionnalites
) VALUES (
  'Starter',
  'Pour les entrepreneurs qui démarrent leur activité. Modules essentiels pour gérer vos clients et factures.',
  9.90,
  99.00,
  1,
  1,
  1,
  true,
  '{"facturation": true, "clients": true, "dashboard": true}'::jsonb
)
ON CONFLICT (nom) DO UPDATE
SET 
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  prix_annuel = EXCLUDED.prix_annuel,
  max_entreprises = EXCLUDED.max_entreprises,
  max_utilisateurs = EXCLUDED.max_utilisateurs,
  ordre = EXCLUDED.ordre,
  actif = EXCLUDED.actif,
  fonctionnalites = EXCLUDED.fonctionnalites;

-- Plan BUSINESS
INSERT INTO plans_abonnement (
  nom, 
  description, 
  prix_mensuel, 
  prix_annuel, 
  max_entreprises, 
  max_utilisateurs, 
  ordre, 
  actif,
  fonctionnalites
) VALUES (
  'Business',
  'Pour les petites entreprises en croissance. Comptabilité, salariés et automatisations inclus.',
  29.90,
  299.00,
  3,
  5,
  2,
  true,
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true}'::jsonb
)
ON CONFLICT (nom) DO UPDATE
SET 
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  prix_annuel = EXCLUDED.prix_annuel,
  max_entreprises = EXCLUDED.max_entreprises,
  max_utilisateurs = EXCLUDED.max_utilisateurs,
  ordre = EXCLUDED.ordre,
  actif = EXCLUDED.actif,
  fonctionnalites = EXCLUDED.fonctionnalites;

-- Plan PROFESSIONAL
INSERT INTO plans_abonnement (
  nom, 
  description, 
  prix_mensuel, 
  prix_annuel, 
  max_entreprises, 
  max_utilisateurs, 
  ordre, 
  actif,
  fonctionnalites
) VALUES (
  'Professional',
  'Pour les entreprises établies. Administration complète, API avancée et support prioritaire.',
  79.90,
  799.00,
  10,
  20,
  3,
  true,
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true}'::jsonb
)
ON CONFLICT (nom) DO UPDATE
SET 
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  prix_annuel = EXCLUDED.prix_annuel,
  max_entreprises = EXCLUDED.max_entreprises,
  max_utilisateurs = EXCLUDED.max_utilisateurs,
  ordre = EXCLUDED.ordre,
  actif = EXCLUDED.actif,
  fonctionnalites = EXCLUDED.fonctionnalites;

-- Plan ENTERPRISE
INSERT INTO plans_abonnement (
  nom, 
  description, 
  prix_mensuel, 
  prix_annuel, 
  max_entreprises, 
  max_utilisateurs, 
  ordre, 
  actif,
  fonctionnalites
) VALUES (
  'Enterprise',
  'Solution complète pour grandes structures. Tous les modules inclus avec support dédié et personnalisation.',
  199.90,
  1999.00,
  999,
  999,
  4,
  true,
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true, "support_dedie": true, "personnalisation": true}'::jsonb
)
ON CONFLICT (nom) DO UPDATE
SET 
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  prix_annuel = EXCLUDED.prix_annuel,
  max_entreprises = EXCLUDED.max_entreprises,
  max_utilisateurs = EXCLUDED.max_utilisateurs,
  ordre = EXCLUDED.ordre,
  actif = EXCLUDED.actif,
  fonctionnalites = EXCLUDED.fonctionnalites;

-- ============================================================================
-- PARTIE 2 : Définir tous les modules (existants + futurs)
-- ============================================================================

-- Liste complète de tous les modules (core + premium + futurs)
DO $$
DECLARE
  v_starter_plan_id uuid;
  v_business_plan_id uuid;
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_starter_plan_id FROM plans_abonnement WHERE nom = 'Starter' LIMIT 1;
  SELECT id INTO v_business_plan_id FROM plans_abonnement WHERE nom = 'Business' LIMIT 1;
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  -- ============================================================================
  -- PLAN STARTER : Modules de base essentiels
  -- ============================================================================
  IF v_starter_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    -- Modules Core
    (v_starter_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_starter_plan_id, 'clients', 'Gestion des clients', true),
    (v_starter_plan_id, 'factures', 'Facturation', true),
    (v_starter_plan_id, 'documents', 'Gestion de documents', true),
    -- Modules de base
    (v_starter_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_starter_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_starter_plan_id, 'abonnements', 'Mes abonnements', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Starter';
  END IF;
  
  -- ============================================================================
  -- PLAN BUSINESS : Starter + comptabilité, salariés, automatisations
  -- ============================================================================
  IF v_business_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    -- Tous les modules Starter
    (v_business_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_business_plan_id, 'clients', 'Gestion des clients', true),
    (v_business_plan_id, 'factures', 'Facturation', true),
    (v_business_plan_id, 'documents', 'Gestion de documents', true),
    (v_business_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_business_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_business_plan_id, 'abonnements', 'Mes abonnements', true),
    -- Modules Business
    (v_business_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_business_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_business_plan_id, 'automatisations', 'Automatisations', true),
    (v_business_plan_id, 'messagerie', 'Messagerie interne', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Business';
  END IF;
  
  -- ============================================================================
  -- PLAN PROFESSIONAL : Business + administration, API, support, collaborateurs
  -- ============================================================================
  IF v_professional_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    -- Tous les modules Business
    (v_professional_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_professional_plan_id, 'clients', 'Gestion des clients', true),
    (v_professional_plan_id, 'factures', 'Facturation', true),
    (v_professional_plan_id, 'documents', 'Gestion de documents', true),
    (v_professional_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_professional_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_professional_plan_id, 'abonnements', 'Mes abonnements', true),
    (v_professional_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_professional_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_professional_plan_id, 'automatisations', 'Automatisations', true),
    (v_professional_plan_id, 'messagerie', 'Messagerie interne', true),
    -- Modules Professional
    (v_professional_plan_id, 'administration', 'Administration', true),
    (v_professional_plan_id, 'api', 'API avancée', true),
    (v_professional_plan_id, 'support_prioritaire', 'Support prioritaire', true),
    (v_professional_plan_id, 'collaborateurs', 'Gestion des collaborateurs', true),
    (v_professional_plan_id, 'gestion-equipe', 'Gestion d''équipe', true),
    (v_professional_plan_id, 'gestion-projets', 'Gestion de projets', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Professional';
  END IF;
  
  -- ============================================================================
  -- PLAN ENTERPRISE : TOUS les modules (existants + futurs)
  -- ============================================================================
  IF v_enterprise_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    -- Modules Core
    (v_enterprise_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_enterprise_plan_id, 'clients', 'Gestion des clients', true),
    (v_enterprise_plan_id, 'factures', 'Facturation', true),
    (v_enterprise_plan_id, 'documents', 'Gestion de documents', true),
    (v_enterprise_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_enterprise_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_enterprise_plan_id, 'abonnements', 'Mes abonnements', true),
    -- Modules Business
    (v_enterprise_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_enterprise_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_enterprise_plan_id, 'automatisations', 'Automatisations', true),
    (v_enterprise_plan_id, 'messagerie', 'Messagerie interne', true),
    -- Modules Professional
    (v_enterprise_plan_id, 'administration', 'Administration', true),
    (v_enterprise_plan_id, 'api', 'API avancée', true),
    (v_enterprise_plan_id, 'support_prioritaire', 'Support prioritaire', true),
    (v_enterprise_plan_id, 'collaborateurs', 'Gestion des collaborateurs', true),
    (v_enterprise_plan_id, 'gestion-equipe', 'Gestion d''équipe', true),
    (v_enterprise_plan_id, 'gestion-projets', 'Gestion de projets', true),
    -- Modules Enterprise uniquement
    (v_enterprise_plan_id, 'support_dedie', 'Support dédié', true),
    (v_enterprise_plan_id, 'personnalisation', 'Personnalisation', true),
    -- Modules avancés (existants)
    (v_enterprise_plan_id, 'gestion-stock', 'Gestion de stock', true),
    (v_enterprise_plan_id, 'crm-avance', 'CRM avancé', true),
    (v_enterprise_plan_id, 'time-tracking', 'Suivi du temps', true),
    (v_enterprise_plan_id, 'gestion-budget', 'Gestion de budget', true),
    (v_enterprise_plan_id, 'finance', 'Module Finance', true),
    (v_enterprise_plan_id, 'comptabilite-avancee', 'Comptabilité avancée', true),
    (v_enterprise_plan_id, 'bilans-comptables', 'Bilans comptables', true),
    (v_enterprise_plan_id, 'fiches-paie', 'Fiches de paie', true),
    (v_enterprise_plan_id, 'connexions-admin', 'Connexions administratives', true),
    (v_enterprise_plan_id, 'declarations-admin', 'Déclarations administratives', true),
    (v_enterprise_plan_id, 'api-keys', 'Gestion des clés API', true),
    (v_enterprise_plan_id, 'documents-entreprise', 'Documents entreprise', true),
    (v_enterprise_plan_id, 'conges', 'Gestion des congés', true),
    -- Modules futurs en cours de création
    (v_enterprise_plan_id, 'previsionnel', 'Prévisionnel financier', true),
    (v_enterprise_plan_id, 'ai-previsionnel', 'Prévisionnel AI', true),
    (v_enterprise_plan_id, 'n8n-automation', 'Automatisation N8N', true),
    (v_enterprise_plan_id, 'modules', 'Gestion des modules', true),
    (v_enterprise_plan_id, 'gestion-plans', 'Gestion des plans', true),
    (v_enterprise_plan_id, 'parametres', 'Paramètres', true),
    -- Modules admin plateforme (uniquement pour super_admin, mais dans Enterprise pour référence)
    (v_enterprise_plan_id, 'gestion-secteurs', 'Gestion des secteurs', true),
    (v_enterprise_plan_id, 'modeles-previsionnels', 'Modèles prévisionnels', true),
    (v_enterprise_plan_id, 'historiques-ai', 'Historiques AI', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Enterprise (TOUS les modules)';
  END IF;
  
  RAISE NOTICE '✅ Tous les plans configurés avec leurs modules';
END $$;

-- ============================================================================
-- PARTIE 3 : Créer un index unique sur nom pour éviter les doublons
-- ============================================================================

DO $$
BEGIN
  -- Vérifier si l'index existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'plans_abonnement' 
    AND indexname = 'plans_abonnement_nom_unique'
  ) THEN
    -- Créer un index unique sur nom pour éviter les doublons
    CREATE UNIQUE INDEX IF NOT EXISTS plans_abonnement_nom_unique 
    ON plans_abonnement(nom) 
    WHERE actif = true;
    
    RAISE NOTICE '✅ Index unique créé sur plans_abonnement.nom';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 4 : Vérifications finales
-- ============================================================================

SELECT '✅ Migration de création des plans d''abonnement avec modules appliquée avec succès !' as resultat;

-- Afficher un résumé
DO $$
DECLARE
  v_starter_count integer;
  v_business_count integer;
  v_professional_count integer;
  v_enterprise_count integer;
  v_starter_plan_id uuid;
  v_business_plan_id uuid;
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
BEGIN
  -- Récupérer les IDs
  SELECT id INTO v_starter_plan_id FROM plans_abonnement WHERE nom = 'Starter' LIMIT 1;
  SELECT id INTO v_business_plan_id FROM plans_abonnement WHERE nom = 'Business' LIMIT 1;
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  -- Compter les modules par plan
  SELECT COUNT(*) INTO v_starter_count FROM plan_modules WHERE plan_id = v_starter_plan_id AND activer = true;
  SELECT COUNT(*) INTO v_business_count FROM plan_modules WHERE plan_id = v_business_plan_id AND activer = true;
  SELECT COUNT(*) INTO v_professional_count FROM plan_modules WHERE plan_id = v_professional_plan_id AND activer = true;
  SELECT COUNT(*) INTO v_enterprise_count FROM plan_modules WHERE plan_id = v_enterprise_plan_id AND activer = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ DE LA CONFIGURATION';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Plan Starter : % module(s)', v_starter_count;
  RAISE NOTICE '  Plan Business : % module(s)', v_business_count;
  RAISE NOTICE '  Plan Professional : % module(s)', v_professional_count;
  RAISE NOTICE '  Plan Enterprise : % module(s)', v_enterprise_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

