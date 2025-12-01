/*
  # CORRECTION CRITIQUE : Modules manquants pour plans Starter et Business
  
  PROBLÈME IDENTIFIÉ:
  - Les plans Starter et Business n'ont AUCUN module associé dans plan_modules
  - La page Gestion Plans ne peut pas afficher correctement les plans sans modules
  - Les plans Professional et Enterprise ont des modules mais pas Starter et Business
  
  SOLUTION:
  1. Vérifier que la table plan_modules existe
  2. Associer les modules manquants aux plans Starter et Business
  3. Utiliser les modules créés dans modules_activation comme référence
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et créer la table plan_modules si nécessaire
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans_abonnement(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  module_nom text,
  activer boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_plan_modules_plan_id ON plan_modules(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_modules_module_code ON plan_modules(module_code);

-- Activer RLS si pas déjà fait
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plan_modules' 
    AND policyname = 'Plan modules visibles par tous authentifiés'
  ) THEN
    ALTER TABLE plan_modules ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Plan modules visibles par tous authentifiés"
      ON plan_modules FOR SELECT
      TO authenticated
      USING (true);
      
    CREATE POLICY "Super admin peut gérer plan_modules"
      ON plan_modules FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM utilisateurs
          WHERE utilisateurs.id = auth.uid()
          AND utilisateurs.role = 'super_admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Associer les modules aux plans Starter et Business
-- ============================================================================

DO $$
DECLARE
  v_starter_plan_id uuid;
  v_business_plan_id uuid;
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
  v_module_record RECORD;
  v_count_starter integer := 0;
  v_count_business integer := 0;
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_starter_plan_id FROM plans_abonnement WHERE nom = 'Starter' LIMIT 1;
  SELECT id INTO v_business_plan_id FROM plans_abonnement WHERE nom = 'Business' LIMIT 1;
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  IF v_starter_plan_id IS NULL THEN
    RAISE WARNING '⚠️ Plan Starter non trouvé';
  END IF;
  
  IF v_business_plan_id IS NULL THEN
    RAISE WARNING '⚠️ Plan Business non trouvé';
  END IF;
  
  -- ============================================================================
  -- PLAN STARTER : Modules de base essentiels
  -- ============================================================================
  IF v_starter_plan_id IS NOT NULL THEN
    -- Modules Core pour Starter
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_starter_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_starter_plan_id, 'clients', 'Gestion des clients', true),
    (v_starter_plan_id, 'facturation', 'Facturation', true),
    (v_starter_plan_id, 'factures', 'Factures', true),
    (v_starter_plan_id, 'documents', 'Gestion de documents', true),
    (v_starter_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_starter_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_starter_plan_id, 'abonnements', 'Mes abonnements', true),
    (v_starter_plan_id, 'settings', 'Paramètres', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    SELECT COUNT(*) INTO v_count_starter FROM plan_modules WHERE plan_id = v_starter_plan_id AND activer = true;
    RAISE NOTICE '✅ Plan Starter : % module(s) associé(s)', v_count_starter;
  END IF;
  
  -- ============================================================================
  -- PLAN BUSINESS : Starter + comptabilité, salariés, automatisations
  -- ============================================================================
  IF v_business_plan_id IS NOT NULL THEN
    -- Tous les modules Starter
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_business_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_business_plan_id, 'clients', 'Gestion des clients', true),
    (v_business_plan_id, 'facturation', 'Facturation', true),
    (v_business_plan_id, 'factures', 'Factures', true),
    (v_business_plan_id, 'documents', 'Gestion de documents', true),
    (v_business_plan_id, 'tableau_de_bord', 'Tableau de bord client', true),
    (v_business_plan_id, 'mon_entreprise', 'Mon entreprise', true),
    (v_business_plan_id, 'abonnements', 'Mes abonnements', true),
    (v_business_plan_id, 'settings', 'Paramètres', true),
    -- Modules Business supplémentaires
    (v_business_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_business_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_business_plan_id, 'automatisations', 'Automatisations', true),
    (v_business_plan_id, 'messagerie', 'Messagerie interne', true)
    ON CONFLICT (plan_id, module_code) DO UPDATE
    SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer;
    
    SELECT COUNT(*) INTO v_count_business FROM plan_modules WHERE plan_id = v_business_plan_id AND activer = true;
    RAISE NOTICE '✅ Plan Business : % module(s) associé(s)', v_count_business;
  END IF;
  
  -- ============================================================================
  -- Vérification finale
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ DES CORRECTIONS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Plan Starter : % module(s)', v_count_starter;
  RAISE NOTICE '  Plan Business : % module(s)', v_count_business;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- PARTIE 3 : Vérifier que tous les plans ont des modules
-- ============================================================================

DO $$
DECLARE
  v_plan_record RECORD;
  v_module_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 VÉRIFICATION FINALE:';
  
  FOR v_plan_record IN
    SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre
  LOOP
    SELECT COUNT(*) INTO v_module_count 
    FROM plan_modules 
    WHERE plan_id = v_plan_record.id AND activer = true;
    
    IF v_module_count = 0 THEN
      RAISE WARNING '⚠️ Plan "%" : AUCUN module associé !', v_plan_record.nom;
    ELSE
      RAISE NOTICE '✅ Plan "%" : % module(s) associé(s)', v_plan_record.nom, v_module_count;
    END IF;
  END LOOP;
END $$;

SELECT '✅ Migration de correction des modules manquants appliquée avec succès !' as resultat;

