/*
  # FIX: search_path explicite pour les fonctions publiques

  Le linter Supabase signale que certaines fonctions ont un search_path mutable.
  Pour éviter tout problème de sécurité (utilisation d'un mauvais schéma),
  on force le search_path sur un ensemble sûr : public, auth, extensions.

  Cette migration est GENERIQUE : elle parcourt toutes les fonctions du schéma public
  et applique le même search_path, sans rien casser au niveau applicatif.
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f' -- fonctions (pas agrégats, pas procédures)
      AND p.proname IN (
        'get_module_dependencies',
        'can_activate_module',
        'update_projets_updated_at',
        'update_client_contacts_updated_at',
        'search_facture_articles',
        'update_parametres_documents_updated_at',
        'update_updated_at_column',
        'sync_user_to_utilisateurs',
        'get_client_role',
        'migration_applied',
        'mark_migration_applied',
        'trigger_create_crm_activity_on_paiement',
        'valider_paiement_carte_immediat',
        'update_collaborateurs_updated_at',
        'toggle_module_activation',
        'get_all_modules_status',
        'update_documents_updated_at',
        'update_equipes_updated_at',
        'get_accessible_folders',
        'update_document_folders_updated_at',
        'get_folder_path',
        'get_child_folders',
        'update_permissions_dossiers_updated_at',
        'can_access_folder',
        'update_espaces_membres_clients_updated_at',
        'get_modules_by_secteur',
        'get_modules_by_abonnement',
        'calculer_declaration_tva',
        'mark_notification_as_read',
        'mark_all_notifications_as_read',
        'count_unread_notifications',
        'get_client_role_code',
        'calculate_heures_mensuelles',
        'get_projet_stats',
        'create_stock_mouvement',
        'get_stock_alertes',
        'is_super_admin_check',
        'update_stock_quantity',
        'trigger_create_crm_activity_on_client_status',
        'is_super_admin_simple',
        'add_client_tag',
        'init_parametres_comptables_entreprise',
        'get_crm_pipeline_stats',
        'diagnostic_creation_abonnement',
        'init_plan_comptable_entreprise',
        'create_crm_activity_auto',
        'auto_init_comptabilite_entreprise',
        'generer_fiche_paie_auto',
        'is_client_with_role',
        'calculer_anciennete',
        'mettre_a_jour_anciennete',
        'get_crm_opportunites_by_etape',
        'creer_ecriture_facture_vente',
        'trigger_auto_ecriture_paiement',
        'creer_ecriture_paiement',
        'trigger_auto_ecriture_facture',
        'trigger_add_tags_from_client_status',
        'init_journaux_comptables_entreprise',
        'diagnostic_workflow_60_percent',
        'trigger_add_tags_from_crm_activity',
        'test_diagnostic_rapide',
        'get_taux_cotisations',
        'trigger_create_crm_activity_on_facture',
        'update_codes_ape_naf_updated_at',
        'add_collaborateur_tag',
        'init_parametres_paie_entreprise'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, auth, extensions',
      r.func_regproc
    );
  END LOOP;

  RAISE NOTICE '✅ search_path fixé pour toutes les fonctions ciblées (public, auth, extensions)';
END $$;


