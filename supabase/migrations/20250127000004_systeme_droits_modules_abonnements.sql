/*
  # SYSTÈME COMPLET DE DROITS BASÉ SUR LES PLANS D'ABONNEMENT
  
  PROBLÈMES À RÉSOUDRE:
  1. ❌ Les modules ne sont pas correctement liés aux plans d'abonnement
  2. ❌ La plateforme (super_admin) n'a pas accès à tous les modules
  3. ❌ Les clients n'ont pas accès aux modules selon leur abonnement
  4. ❌ La fonction sync_client_modules_from_plan n'existe pas
  
  SOLUTIONS:
  1. ✅ Créer une table plan_modules pour lier modules ↔ plans
  2. ✅ Créer la fonction sync_client_modules_from_plan
  3. ✅ Créer une fonction pour récupérer les modules disponibles selon le rôle
  4. ✅ Mettre à jour les plans avec les modules correspondants
  5. ✅ S'assurer que super_admin a accès à tous les modules
*/

-- ============================================================================
-- PARTIE 1 : Créer la table de liaison plans ↔ modules
-- ============================================================================

-- Table pour lier les modules aux plans d'abonnement
CREATE TABLE IF NOT EXISTS plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans_abonnement(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  module_nom text,
  activer boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, module_code)
);

ALTER TABLE plan_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan modules visibles par tous authentifiés"
  ON plan_modules FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE plan_modules IS 'Liaison entre plans d''abonnement et modules disponibles. Chaque plan peut avoir plusieurs modules activés.';

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_plan_modules_plan_id ON plan_modules(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_modules_module_code ON plan_modules(module_code);

-- ============================================================================
-- PARTIE 2 : Créer la fonction de synchronisation modules ↔ plan
-- ============================================================================

-- Supprimer l'ancienne fonction si elle existe avec des signatures différentes
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid) CASCADE;

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
    -- Ajouter le module à l'objet JSON
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- 3. Toujours s'assurer que les modules de base sont présents
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
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés: %', v_modules_json;
  
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

COMMENT ON FUNCTION sync_client_modules_from_plan IS 
  'Synchronise les modules d''un client avec son plan d''abonnement. Met à jour espaces_membres_clients.modules_actifs avec les modules du plan.';

-- ============================================================================
-- PARTIE 3 : Créer une fonction pour récupérer les modules disponibles
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_available_modules(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_role text;
  v_is_super_admin boolean;
  v_plan_id uuid;
  v_modules jsonb := '{}'::jsonb;
  v_module_record RECORD;
BEGIN
  -- 1. Vérifier si c'est un super_admin plateforme
  SELECT 
    COALESCE((raw_user_meta_data->>'role')::text, 'client'),
    (raw_user_meta_data->>'role')::text = 'super_admin' OR 
    (raw_user_meta_data->>'role')::text = 'admin'
  INTO v_user_role, v_is_super_admin
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_is_super_admin THEN
    -- Super admin plateforme : tous les modules disponibles
    RAISE NOTICE '[get_user_available_modules] 👑 Super admin détecté : tous les modules disponibles';
    
    -- Récupérer tous les modules uniques
    FOR v_module_record IN
      SELECT DISTINCT module_code, module_nom
      FROM plan_modules
      WHERE activer = true
      ORDER BY module_code
    LOOP
      v_modules := v_modules || jsonb_build_object(v_module_record.module_code, true);
    END LOOP;
    
    -- Ajouter les modules de base
    v_modules := v_modules || jsonb_build_object(
      'tableau_de_bord', true,
      'mon_entreprise', true,
      'factures', true,
      'documents', true,
      'abonnements', true,
      'modules', true,
      'gestion-plans', true,
      'parametres', true
    );
    
    RETURN jsonb_build_object(
      'is_super_admin', true,
      'modules', v_modules
    );
  END IF;
  
  -- 2. Sinon, c'est un client : récupérer les modules de son abonnement
  SELECT a.plan_id INTO v_plan_id
  FROM abonnements a
  WHERE a.client_id = p_user_id 
    AND a.statut = 'actif'
  ORDER BY a.created_at DESC
  LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    -- Pas d'abonnement actif : modules de base uniquement
    RAISE NOTICE '[get_user_available_modules] ⚠️ Pas d''abonnement actif : modules de base uniquement';
    RETURN jsonb_build_object(
      'is_super_admin', false,
      'modules', jsonb_build_object(
        'tableau_de_bord', true,
        'mon_entreprise', true
      )
    );
  END IF;
  
  -- Récupérer les modules du plan
  FOR v_module_record IN
    SELECT module_code, module_nom
    FROM plan_modules
    WHERE plan_id = v_plan_id AND activer = true
  LOOP
    v_modules := v_modules || jsonb_build_object(v_module_record.module_code, true);
  END LOOP;
  
  -- Ajouter les modules de base
  v_modules := v_modules || jsonb_build_object(
    'tableau_de_bord', true,
    'mon_entreprise', true,
    'factures', true,
    'documents', true,
    'abonnements', true
  );
  
  RAISE NOTICE '[get_user_available_modules] ✅ Modules récupérés pour client avec plan: %', v_plan_id;
  
  RETURN jsonb_build_object(
    'is_super_admin', false,
    'plan_id', v_plan_id,
    'modules', v_modules
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[get_user_available_modules] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'is_super_admin', false,
      'modules', jsonb_build_object('tableau_de_bord', true),
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION get_user_available_modules IS 
  'Retourne les modules disponibles pour un utilisateur. Super admin = tous les modules, Client = modules de son plan d''abonnement.';

-- ============================================================================
-- PARTIE 4 : Insérer les modules dans plan_modules pour chaque plan
-- ============================================================================

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
  
  -- PLAN STARTER : Modules de base
  IF v_starter_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_starter_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_starter_plan_id, 'clients', 'Gestion des clients', true),
    (v_starter_plan_id, 'factures', 'Facturation', true),
    (v_starter_plan_id, 'documents', 'Gestion de documents', true)
    ON CONFLICT (plan_id, module_code) DO NOTHING;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Starter';
  END IF;
  
  -- PLAN BUSINESS : Modules Starter + comptabilité, salariés, automatisations
  IF v_business_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_business_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_business_plan_id, 'clients', 'Gestion des clients', true),
    (v_business_plan_id, 'factures', 'Facturation', true),
    (v_business_plan_id, 'documents', 'Gestion de documents', true),
    (v_business_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_business_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_business_plan_id, 'automatisations', 'Automatisations', true)
    ON CONFLICT (plan_id, module_code) DO NOTHING;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Business';
  END IF;
  
  -- PLAN PROFESSIONAL : Modules Business + administration, API, support
  IF v_professional_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_professional_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_professional_plan_id, 'clients', 'Gestion des clients', true),
    (v_professional_plan_id, 'factures', 'Facturation', true),
    (v_professional_plan_id, 'documents', 'Gestion de documents', true),
    (v_professional_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_professional_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_professional_plan_id, 'automatisations', 'Automatisations', true),
    (v_professional_plan_id, 'administration', 'Administration', true),
    (v_professional_plan_id, 'api', 'API avancée', true),
    (v_professional_plan_id, 'support_prioritaire', 'Support prioritaire', true),
    (v_professional_plan_id, 'collaborateurs', 'Collaborateurs', true),
    (v_professional_plan_id, 'gestion-equipe', 'Gestion d''équipe', true)
    ON CONFLICT (plan_id, module_code) DO NOTHING;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Professional';
  END IF;
  
  -- PLAN ENTERPRISE : Tous les modules
  IF v_enterprise_plan_id IS NOT NULL THEN
    INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
    (v_enterprise_plan_id, 'dashboard', 'Tableau de bord', true),
    (v_enterprise_plan_id, 'clients', 'Gestion des clients', true),
    (v_enterprise_plan_id, 'factures', 'Facturation', true),
    (v_enterprise_plan_id, 'documents', 'Gestion de documents', true),
    (v_enterprise_plan_id, 'comptabilite', 'Comptabilité', true),
    (v_enterprise_plan_id, 'salaries', 'Gestion des salariés', true),
    (v_enterprise_plan_id, 'automatisations', 'Automatisations', true),
    (v_enterprise_plan_id, 'administration', 'Administration', true),
    (v_enterprise_plan_id, 'api', 'API avancée', true),
    (v_enterprise_plan_id, 'support_prioritaire', 'Support prioritaire', true),
    (v_enterprise_plan_id, 'support_dedie', 'Support dédié', true),
    (v_enterprise_plan_id, 'personnalisation', 'Personnalisation', true),
    (v_enterprise_plan_id, 'collaborateurs', 'Collaborateurs', true),
    (v_enterprise_plan_id, 'gestion-equipe', 'Gestion d''équipe', true),
    (v_enterprise_plan_id, 'gestion-projets', 'Gestion de projets', true),
    (v_enterprise_plan_id, 'gestion-stock', 'Gestion de stock', true),
    (v_enterprise_plan_id, 'crm-avance', 'CRM avancé', true),
    (v_enterprise_plan_id, 'time-tracking', 'Suivi du temps', true),
    (v_enterprise_plan_id, 'gestion-budget', 'Gestion de budget', true)
    ON CONFLICT (plan_id, module_code) DO NOTHING;
    
    RAISE NOTICE '✅ Modules ajoutés au plan Enterprise';
  END IF;
  
END $$;

-- ============================================================================
-- PARTIE 5 : Mettre à jour creer_facture_et_abonnement_apres_paiement pour appeler sync
-- ============================================================================

-- Cette partie est déjà dans la migration précédente, mais on s'assure que la fonction existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'sync_client_modules_from_plan'
  ) THEN
    RAISE EXCEPTION 'La fonction sync_client_modules_from_plan n''a pas été créée correctement.';
  END IF;
  
  RAISE NOTICE '✅ Fonction sync_client_modules_from_plan vérifiée';
END $$;

-- ============================================================================
-- PARTIE 6 : Fonction pour vérifier les modules configurés
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_modules_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_plan_count integer;
  v_module_count integer;
  v_link_count integer;
BEGIN
  -- Compter les plans
  SELECT COUNT(*) INTO v_plan_count FROM plans_abonnement WHERE actif = true;
  
  -- Compter les modules uniques
  SELECT COUNT(DISTINCT module_code) INTO v_module_count FROM plan_modules;
  
  -- Compter les liaisons
  SELECT COUNT(*) INTO v_link_count FROM plan_modules;
  
  v_result := jsonb_build_object(
    'plans_actifs', v_plan_count,
    'modules_uniques', v_module_count,
    'liaisons_plan_modules', v_link_count,
    'status', CASE 
      WHEN v_plan_count > 0 AND v_module_count > 0 AND v_link_count > 0 THEN 'ok'
      ELSE 'incomplet'
    END
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION verify_modules_configuration IS 
  'Vérifie que les modules sont correctement configurés et liés aux plans.';

-- ============================================================================
-- PARTIE 7 : Vérifications finales
-- ============================================================================

SELECT '✅ Migration de système de droits basé sur les abonnements appliquée avec succès !' as resultat;

-- Afficher un résumé de la configuration
SELECT verify_modules_configuration() as configuration_resume;

