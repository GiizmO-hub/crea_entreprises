/*
  # Fix: delete_entreprise_complete - Désactiver triggers pendant suppression
  
  PROBLÈME:
  - Erreur: "tuple to be deleted was already modified by an operation triggered by the current command"
  - Les triggers BEFORE/AFTER DELETE entrent en conflit avec les suppressions explicites
  - Plusieurs triggers tentent de modifier la même ligne pendant la suppression
  
  SOLUTION:
  - Désactiver temporairement les triggers pendant la suppression
  - Supprimer explicitement tous les éléments liés AVANT de supprimer l'entreprise
  - Réactiver les triggers après
*/

-- Recréer la fonction delete_entreprise_complete avec désactivation des triggers
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
  -- ✅ CORRECTION: DÉSACTIVER LES TRIGGERS TEMPORAIREMENT
  -- ============================================================
  
  -- Désactiver tous les triggers sur entreprises
  ALTER TABLE entreprises DISABLE TRIGGER ALL;
  
  RAISE NOTICE '🔧 [delete_entreprise_complete] Triggers désactivés temporairement';
  
  -- ============================================================
  -- SUPPRESSION EXPLICITE DE TOUT CE QUI EST LIÉ
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  GET DIAGNOSTICS v_options_count = ROW_COUNT;
  
  -- 2. Supprimer les abonnements
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  
  -- 3. Supprimer les paiements
  DELETE FROM paiements WHERE entreprise_id = p_entreprise_id;
  
  -- 4. Supprimer les factures
  DELETE FROM factures WHERE entreprise_id = p_entreprise_id;
  
  -- 5. Supprimer autres éléments (si tables existent)
  BEGIN
    DELETE FROM notifications WHERE entreprise_id = p_entreprise_id;
    DELETE FROM devis WHERE entreprise_id = p_entreprise_id;
    DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM previsionnels WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Normal si tables n'existent pas
  END;
  
  -- 6. Supprimer les espaces membres explicitement AVANT les clients
  -- (car les clients ont une FK vers espaces qui pourrait bloquer)
  DELETE FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  -- 7. Supprimer les clients explicitement
  DELETE FROM clients WHERE entreprise_id = p_entreprise_id;
  
  -- 8. Enfin, supprimer l'entreprise elle-même (triggers désactivés donc pas de conflit)
  DELETE FROM entreprises WHERE id = p_entreprise_id;
  
  -- 9. Réactiver les triggers
  ALTER TABLE entreprises ENABLE TRIGGER ALL;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Triggers réactivés';
  
  IF NOT FOUND THEN
    -- Réactiver les triggers même en cas d'erreur
    ALTER TABLE entreprises ENABLE TRIGGER ALL;
    RAISE WARNING '❌ [delete_entreprise_complete] L''entreprise n''a pas pu être supprimée';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'L''entreprise n''a pas pu être supprimée'
    );
  END IF;
  
  -- 10. Note: Les auth.users liés aux clients et espaces seront supprimés
  -- par les triggers AFTER DELETE sur les tables clients et espaces_membres_clients
  -- qui sont toujours actifs (on n'a désactivé que les triggers sur entreprises)
  
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
    -- ✅ IMPORTANT: Réactiver les triggers même en cas d'erreur
    BEGIN
      ALTER TABLE entreprises ENABLE TRIGGER ALL;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorer si erreur lors de la réactivation
    END;
    
    RAISE WARNING '❌ [delete_entreprise_complete] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise et TOUS ses éléments liés. Les triggers sont désactivés temporairement pour éviter les conflits. Version corrigée pour éviter l''erreur "tuple already modified".';

