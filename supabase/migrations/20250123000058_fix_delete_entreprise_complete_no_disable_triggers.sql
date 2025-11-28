/*
  # Fix: delete_entreprise_complete - Sans désactiver les triggers système
  
  PROBLÈME:
  - Erreur: "permission denied: RI_ConstraintTrigger_a_17529 is a system trigger"
  - On ne peut pas désactiver les triggers système (RI_ConstraintTrigger_*)
  - Ces triggers gèrent les contraintes de clés étrangères
  
  SOLUTION:
  - Ne PAS désactiver les triggers (surtout pas les triggers système)
  - Supprimer les éléments dans le bon ordre pour éviter les conflits
  - Laisser les triggers AFTER DELETE s'exécuter normalement
*/

-- Recréer la fonction delete_entreprise_complete SANS désactiver les triggers
CREATE OR REPLACE FUNCTION delete_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clients_count integer := 0;
  v_espaces_count integer := 0;
  v_abonnements_count integer := 0;
  v_options_count integer := 0;
  v_factures_count integer := 0;
  v_paiements_count integer := 0;
  v_is_super_admin boolean := false;
  v_is_owner boolean := false;
  v_is_admin boolean := false;
BEGIN
  RAISE NOTICE '🚀 [delete_entreprise_complete] DÉBUT - Entreprise ID: %', p_entreprise_id;
  RAISE NOTICE '👤 [delete_entreprise_complete] User ID: %', auth.uid();
  
  -- Vérifier que l'entreprise existe
  IF NOT EXISTS(SELECT 1 FROM entreprises WHERE id = p_entreprise_id) THEN
    RAISE WARNING '❌ [delete_entreprise_complete] Entreprise non trouvée - ID: %', p_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Entreprise trouvée';
  
  -- ✅ VÉRIFICATION DES DROITS
  BEGIN
    SELECT check_is_super_admin() INTO v_is_super_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_super_admin := false;
  END;
  
  BEGIN
    SELECT is_admin_user_simple() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  
  SELECT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) INTO v_is_owner;
  
  IF NOT (v_is_super_admin OR v_is_admin OR v_is_owner) THEN
    RAISE WARNING '❌ [delete_entreprise_complete] Accès non autorisé';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Vous devez être le propriétaire de l''entreprise ou administrateur de la plateforme.'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Droits vérifiés';
  
  -- Compter les éléments liés
  SELECT COUNT(*) INTO v_clients_count FROM clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_espaces_count FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_abonnements_count FROM abonnements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_factures_count FROM factures WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_paiements_count FROM paiements WHERE entreprise_id = p_entreprise_id;
  
  RAISE NOTICE '📊 [delete_entreprise_complete] Éléments à supprimer - Clients: %, Espaces: %, Abonnements: %, Factures: %, Paiements: %',
    v_clients_count, v_espaces_count, v_abonnements_count, v_factures_count, v_paiements_count;
  
  -- ============================================================
  -- ✅ CORRECTION: SUPPRESSION DANS LE BON ORDRE
  -- On ne désactive PAS les triggers, on supprime dans l'ordre
  -- pour éviter les conflits avec les contraintes FK
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options (dépendent des abonnements)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des options d''abonnement...';
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  GET DIAGNOSTICS v_options_count = ROW_COUNT;
  RAISE NOTICE '✅ [delete_entreprise_complete] Options supprimées: %', v_options_count;
  
  -- 2. Supprimer les abonnements (dépendent de l'entreprise)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des abonnements...';
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Abonnements supprimés: %', v_abonnements_count;
  
  -- 3. Supprimer les paiements (dépendent de l'entreprise)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des paiements...';
  DELETE FROM paiements WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Paiements supprimés: %', v_paiements_count;
  
  -- 4. Supprimer les factures (dépendent de l'entreprise)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des factures...';
  DELETE FROM factures WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Factures supprimées: %', v_factures_count;
  
  -- 5. Supprimer autres éléments (si tables existent)
  BEGIN
    DELETE FROM notifications WHERE entreprise_id = p_entreprise_id;
    DELETE FROM devis WHERE entreprise_id = p_entreprise_id;
    DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM previsionnels WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  [delete_entreprise_complete] Certaines tables n''existent pas (normal)';
  END;
  
  -- 6. Supprimer les espaces membres AVANT les clients
  -- (car les clients peuvent avoir des FK vers espaces)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des espaces membres...';
  DELETE FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Espaces membres supprimés: %', v_espaces_count;
  
  -- 7. Supprimer les clients (les triggers AFTER DELETE sur clients supprimeront les auth.users)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des clients...';
  DELETE FROM clients WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Clients supprimés: %', v_clients_count;
  
  -- 8. Enfin, supprimer l'entreprise elle-même
  -- Les triggers AFTER DELETE sur entreprises s'exécuteront normalement
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression de l''entreprise...';
  DELETE FROM entreprises WHERE id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '❌ [delete_entreprise_complete] L''entreprise n''a pas pu être supprimée';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'L''entreprise n''a pas pu être supprimée'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Entreprise supprimée avec succès !';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée avec succès (%s client(s), %s espace(s), %s abonnement(s), %s option(s), %s facture(s), %s paiement(s) supprimé(s))',
      v_clients_count, v_espaces_count, v_abonnements_count, v_options_count, v_factures_count, v_paiements_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'options_deleted', v_options_count,
    'factures_deleted', v_factures_count,
    'paiements_deleted', v_paiements_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [delete_entreprise_complete] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise et TOUS ses éléments liés. Les éléments sont supprimés dans le bon ordre pour éviter les conflits avec les contraintes FK. Les triggers système ne sont pas désactivés.';


