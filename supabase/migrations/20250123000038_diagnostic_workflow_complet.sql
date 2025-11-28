/*
  # Migration de Diagnostic - Workflow Complet Entreprise + Paiement
  
  Cette migration vérifie que tous les éléments du workflow sont en place :
  1. Toutes les fonctions RPC nécessaires existent
  2. Tous les triggers sont actifs
  3. Les tables ont les bonnes structures
  4. Les contraintes sont correctes
  
  Elle crée aussi une fonction de diagnostic pour tester le workflow.
*/

-- ============================================================================
-- PARTIE 1 : Fonction de diagnostic complète
-- ============================================================================

CREATE OR REPLACE FUNCTION diagnostic_workflow_complet()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb := jsonb_build_object();
  v_functions jsonb := jsonb_build_array();
  v_triggers jsonb := jsonb_build_array();
  v_tables jsonb := jsonb_build_array();
  v_issues jsonb := jsonb_build_array();
  v_function_name text;
  v_trigger_name text;
  v_table_name text;
  v_exists boolean;
BEGIN
  -- 1. Vérifier les fonctions RPC critiques
  RAISE NOTICE '🔍 Vérification des fonctions RPC...';
  
  -- Fonction 1: create_complete_entreprise_automated
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_complete_entreprise_automated'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'create_complete_entreprise_automated',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'create_complete_entreprise_automated',
      'severity', 'critical',
      'message', 'Fonction essentielle pour créer une entreprise avec paiement'
    );
  END IF;
  
  -- Fonction 2: valider_paiement_carte_immediat
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'valider_paiement_carte_immediat'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'valider_paiement_carte_immediat',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'valider_paiement_carte_immediat',
      'severity', 'critical',
      'message', 'Fonction essentielle pour valider un paiement par carte'
    );
  END IF;
  
  -- Fonction 3: choisir_paiement_virement
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'choisir_paiement_virement'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'choisir_paiement_virement',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'choisir_paiement_virement',
      'severity', 'critical',
      'message', 'Fonction essentielle pour choisir le paiement par virement'
    );
  END IF;
  
  -- Fonction 4: creer_facture_et_abonnement_apres_paiement
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'creer_facture_et_abonnement_apres_paiement',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'creer_facture_et_abonnement_apres_paiement',
      'severity', 'critical',
      'message', 'Fonction essentielle pour créer facture et abonnement après paiement'
    );
  END IF;
  
  -- Fonction 5: finaliser_creation_apres_paiement
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'finaliser_creation_apres_paiement'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'finaliser_creation_apres_paiement',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'finaliser_creation_apres_paiement',
      'severity', 'critical',
      'message', 'Fonction essentielle pour finaliser la création de l''espace client'
    );
  END IF;
  
  -- Fonction 6: get_paiement_info_for_stripe
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_paiement_info_for_stripe'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'get_paiement_info_for_stripe',
    'exists', v_exists,
    'critical', false
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'get_paiement_info_for_stripe',
      'severity', 'warning',
      'message', 'Fonction utile pour récupérer les infos de paiement pour Stripe'
    );
  END IF;
  
  -- Fonction 7: valider_paiement_virement_manuel
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'valider_paiement_virement_manuel'
  ) INTO v_exists;
  v_functions := v_functions || jsonb_build_object(
    'name', 'valider_paiement_virement_manuel',
    'exists', v_exists,
    'critical', false
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_function',
      'name', 'valider_paiement_virement_manuel',
      'severity', 'warning',
      'message', 'Fonction pour validation manuelle des virements par l''équipe technique'
    );
  END IF;
  
  -- 2. Vérifier les triggers critiques
  RAISE NOTICE '🔍 Vérification des triggers...';
  
  -- Trigger 1: trigger_paiement_creer_facture_abonnement
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
    AND tgrelid = 'paiements'::regclass
    AND tgenabled = 'O'
  ) INTO v_exists;
  v_triggers := v_triggers || jsonb_build_object(
    'name', 'trigger_paiement_creer_facture_abonnement',
    'table', 'paiements',
    'exists', v_exists,
    'enabled', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_trigger',
      'name', 'trigger_paiement_creer_facture_abonnement',
      'severity', 'critical',
      'message', 'Trigger essentiel pour créer automatiquement facture et abonnement après paiement'
    );
  END IF;
  
  -- 3. Vérifier les tables critiques
  RAISE NOTICE '🔍 Vérification des tables...';
  
  -- Table 1: entreprises
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'entreprises'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'entreprises',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_table',
      'name', 'entreprises',
      'severity', 'critical',
      'message', 'Table essentielle pour le workflow'
    );
  END IF;
  
  -- Table 2: paiements
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'paiements'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'paiements',
    'exists', v_exists,
    'critical', true
  );
  IF NOT v_exists THEN
    v_issues := v_issues || jsonb_build_object(
      'type', 'missing_table',
      'name', 'paiements',
      'severity', 'critical',
      'message', 'Table essentielle pour le workflow de paiement'
    );
  END IF;
  
  -- Table 3: clients
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'clients'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'clients',
    'exists', v_exists,
    'critical', true
  );
  
  -- Table 4: factures
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'factures'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'factures',
    'exists', v_exists,
    'critical', true
  );
  
  -- Table 5: abonnements
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'abonnements'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'abonnements',
    'exists', v_exists,
    'critical', true
  );
  
  -- Table 6: espaces_membres_clients
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'espaces_membres_clients'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'espaces_membres_clients',
    'exists', v_exists,
    'critical', true
  );
  
  -- Table 7: plans_abonnement
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plans_abonnement'
  ) INTO v_exists;
  v_tables := v_tables || jsonb_build_object(
    'name', 'plans_abonnement',
    'exists', v_exists,
    'critical', true
  );
  
  -- 4. Vérifier les colonnes critiques de la table paiements
  RAISE NOTICE '🔍 Vérification des colonnes de la table paiements...';
  
  DECLARE
    v_has_notes boolean;
    v_has_entreprise_id boolean;
    v_has_statut boolean;
    v_notes_type text;
  BEGIN
    -- Vérifier colonne notes
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'paiements'
      AND column_name = 'notes'
    ) INTO v_has_notes;
    
    IF v_has_notes THEN
      SELECT data_type INTO v_notes_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'paiements'
      AND column_name = 'notes';
      
      IF v_notes_type NOT IN ('text', 'jsonb') THEN
        v_issues := v_issues || jsonb_build_object(
          'type', 'column_type_issue',
          'table', 'paiements',
          'column', 'notes',
          'severity', 'warning',
          'message', format('Colonne notes a le type %s, devrait être text ou jsonb', v_notes_type)
        );
      END IF;
    ELSE
      v_issues := v_issues || jsonb_build_object(
        'type', 'missing_column',
        'table', 'paiements',
        'column', 'notes',
        'severity', 'critical',
        'message', 'Colonne notes manquante dans la table paiements (nécessaire pour stocker plan_id, client_id, etc.)'
      );
    END IF;
    
    -- Vérifier colonne entreprise_id
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'paiements'
      AND column_name = 'entreprise_id'
    ) INTO v_has_entreprise_id;
    
    IF NOT v_has_entreprise_id THEN
      v_issues := v_issues || jsonb_build_object(
        'type', 'missing_column',
        'table', 'paiements',
        'column', 'entreprise_id',
        'severity', 'critical',
        'message', 'Colonne entreprise_id manquante dans la table paiements'
      );
    END IF;
    
    -- Vérifier colonne statut
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'paiements'
      AND column_name = 'statut'
    ) INTO v_has_statut;
    
    IF NOT v_has_statut THEN
      v_issues := v_issues || jsonb_build_object(
        'type', 'missing_column',
        'table', 'paiements',
        'column', 'statut',
        'severity', 'critical',
        'message', 'Colonne statut manquante dans la table paiements'
      );
    END IF;
  END;
  
  -- 5. Vérifier les statuts possibles pour paiements.statut
  RAISE NOTICE '🔍 Vérification des contraintes de statut...';
  
  DECLARE
    v_statut_constraint text;
    v_has_en_attente_validation boolean;
  BEGIN
    -- Vérifier si le statut 'en_attente_validation' est autorisé
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_constraint c2 ON c2.conname = c.conname
      WHERE c.conrelid = 'paiements'::regclass
      AND c.conname LIKE '%statut%'
      AND (
        SELECT pg_get_constraintdef(c.oid) 
        LIKE '%en_attente_validation%'
      )
    ) INTO v_has_en_attente_validation;
    
    IF NOT v_has_en_attente_validation THEN
      v_issues := v_issues || jsonb_build_object(
        'type', 'constraint_issue',
        'table', 'paiements',
        'severity', 'warning',
        'message', 'Le statut ''en_attente_validation'' pourrait ne pas être autorisé dans la contrainte CHECK'
      );
    END IF;
  END;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'timestamp', now(),
    'functions', v_functions,
    'triggers', v_triggers,
    'tables', v_tables,
    'issues', v_issues,
    'summary', jsonb_build_object(
      'total_functions', jsonb_array_length(v_functions),
      'missing_functions', (
        SELECT COUNT(*) FROM jsonb_array_elements(v_functions) f
        WHERE (f->>'exists')::boolean = false
      ),
      'total_triggers', jsonb_array_length(v_triggers),
      'missing_triggers', (
        SELECT COUNT(*) FROM jsonb_array_elements(v_triggers) t
        WHERE (t->>'exists')::boolean = false
      ),
      'total_tables', jsonb_array_length(v_tables),
      'missing_tables', (
        SELECT COUNT(*) FROM jsonb_array_elements(v_tables) tbl
        WHERE (tbl->>'exists')::boolean = false
      ),
      'total_issues', jsonb_array_length(v_issues),
      'critical_issues', (
        SELECT COUNT(*) FROM jsonb_array_elements(v_issues) i
        WHERE (i->>'severity')::text = 'critical'
      ),
      'warnings', (
        SELECT COUNT(*) FROM jsonb_array_elements(v_issues) i
        WHERE (i->>'severity')::text = 'warning'
      )
    )
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', true,
    'error_message', SQLERRM,
    'error_detail', SQLSTATE,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION diagnostic_workflow_complet IS 
'Fonction de diagnostic complète pour vérifier que tous les éléments du workflow sont en place. Retourne un JSON avec tous les détails.';

GRANT EXECUTE ON FUNCTION diagnostic_workflow_complet() TO authenticated;

-- ============================================================================
-- PARTIE 2 : Fonction de test simplifiée pour vérifier rapidement
-- ============================================================================

CREATE OR REPLACE FUNCTION test_diagnostic_rapide()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_summary jsonb;
  v_critical_issues integer;
  v_output text := '';
BEGIN
  -- Appeler la fonction de diagnostic complète
  SELECT diagnostic_workflow_complet() INTO v_result;
  
  -- Extraire le résumé
  v_summary := v_result->'summary';
  v_critical_issues := (v_summary->>'critical_issues')::integer;
  
  -- Construire un message simple
  v_output := format(
    E'📊 DIAGNOSTIC WORKFLOW COMPLET\n' ||
    E'═══════════════════════════════════════════════\n\n' ||
    E'✅ Fonctions: %s/%s\n' ||
    E'✅ Triggers: %s/%s\n' ||
    E'✅ Tables: %s/%s\n\n' ||
    E'❌ Problèmes critiques: %s\n' ||
    E'⚠️  Avertissements: %s\n\n',
    (v_summary->>'total_functions')::integer - (v_summary->>'missing_functions')::integer,
    v_summary->>'total_functions',
    (v_summary->>'total_triggers')::integer - (v_summary->>'missing_triggers')::integer,
    v_summary->>'total_triggers',
    (v_summary->>'total_tables')::integer - (v_summary->>'missing_tables')::integer,
    v_summary->>'total_tables',
    v_critical_issues,
    v_summary->>'warnings'
  );
  
  -- Ajouter les problèmes critiques si il y en a
  IF v_critical_issues > 0 THEN
    v_output := v_output || E'🚨 PROBLÈMES CRITIQUES:\n' ||
                E'─────────────────────────────────────\n';
    
    FOR v_result IN 
      SELECT jsonb_array_elements(v_result->'issues') as issue
      WHERE (jsonb_array_elements(v_result->'issues')->>'severity')::text = 'critical'
    LOOP
      v_output := v_output || format(
        E'  • %s: %s\n',
        v_result->>'type',
        v_result->>'message'
      );
    END LOOP;
    
    v_output := v_output || E'\n';
  END IF;
  
  -- Ajouter un message de conclusion
  IF v_critical_issues = 0 THEN
    v_output := v_output || E'✅ Tous les éléments critiques sont en place !\n';
  ELSE
    v_output := v_output || E'❌ Des éléments critiques manquent. Veuillez corriger avant de continuer.\n';
  END IF;
  
  RETURN v_output;
END;
$$;

COMMENT ON FUNCTION test_diagnostic_rapide IS 
'Fonction de test rapide qui retourne un message texte simple avec le résultat du diagnostic.';

GRANT EXECUTE ON FUNCTION test_diagnostic_rapide() TO authenticated;

-- ============================================================================
-- PARTIE 3 : Afficher le résultat du diagnostic
-- ============================================================================

DO $$
DECLARE
  v_result text;
BEGIN
  -- Exécuter le diagnostic rapide et afficher le résultat
  SELECT test_diagnostic_rapide() INTO v_result;
  RAISE NOTICE '%', v_result;
END $$;

