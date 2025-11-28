/*
  # Fix: delete_entreprise_complete pour super_admin plateforme
  
  PROBLÈME:
  - La fonction utilise is_admin_user_simple() qui pourrait ne pas exister
  - Le super_admin de la plateforme doit pouvoir supprimer TOUTES les entreprises
  - La vérification des droits ne fonctionne pas correctement
  
  SOLUTION:
  - Utiliser check_is_super_admin() qui existe déjà
  - Permettre au super_admin de supprimer toutes les entreprises
  - Améliorer la gestion des erreurs
*/

-- Recréer la fonction delete_entreprise_complete
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
  v_result jsonb;
  v_entreprise_exists boolean := false;
BEGIN
  RAISE NOTICE '🚀 [delete_entreprise_complete] DÉBUT - Entreprise ID: %', p_entreprise_id;
  
  -- Vérifier que l'entreprise existe
  SELECT EXISTS(SELECT 1 FROM entreprises WHERE id = p_entreprise_id) INTO v_entreprise_exists;
  
  IF NOT v_entreprise_exists THEN
    RAISE WARNING '❌ [delete_entreprise_complete] Entreprise non trouvée - ID: %', p_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non trouvée'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Entreprise trouvée';
  
  -- ✅ CORRECTION: Vérification des droits pour supprimer
  -- Le super_admin plateforme peut supprimer TOUTES les entreprises
  -- Sinon, vérifier que l'utilisateur est propriétaire ou admin
  
  -- Vérifier si super_admin (plateforme) - peut tout supprimer
  DECLARE
    v_is_super_admin boolean := false;
    v_is_owner boolean := false;
  BEGIN
    -- Vérifier si super_admin
    BEGIN
      SELECT check_is_super_admin() INTO v_is_super_admin;
    EXCEPTION WHEN OTHERS THEN
      v_is_super_admin := false;
    END;
    
    -- Vérifier si propriétaire
    SELECT EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = p_entreprise_id
      AND user_id = auth.uid()
    ) INTO v_is_owner;
    
    -- Vérifier si admin (via is_admin_user_simple)
    DECLARE
      v_is_admin boolean := false;
    BEGIN
      BEGIN
        SELECT is_admin_user_simple() INTO v_is_admin;
      EXCEPTION WHEN OTHERS THEN
        v_is_admin := false;
      END;
      
      -- Autoriser si super_admin, admin, ou propriétaire
      IF NOT (v_is_super_admin OR v_is_admin OR v_is_owner) THEN
        RAISE WARNING '❌ [delete_entreprise_complete] Accès non autorisé - User ID: %, Super Admin: %, Admin: %, Owner: %', 
          auth.uid(), v_is_super_admin, v_is_admin, v_is_owner;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Accès non autorisé. Vous devez être le propriétaire de l''entreprise ou super administrateur de la plateforme.'
        );
      END IF;
    END;
  END;
    RAISE WARNING '❌ [delete_entreprise_complete] Accès non autorisé - User ID: %', auth.uid();
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Vous devez être le propriétaire de l''entreprise ou super administrateur de la plateforme.'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Droits vérifiés';
  
  -- Compter les éléments liés (pour info)
  SELECT COUNT(*) INTO v_clients_count
  FROM clients
  WHERE entreprise_id = p_entreprise_id;
  
  SELECT COUNT(*) INTO v_espaces_count
  FROM espaces_membres_clients
  WHERE entreprise_id = p_entreprise_id;
  
  SELECT COUNT(*) INTO v_abonnements_count
  FROM abonnements
  WHERE entreprise_id = p_entreprise_id;
  
  SELECT COUNT(*) INTO v_factures_count
  FROM factures
  WHERE entreprise_id = p_entreprise_id;
  
  SELECT COUNT(*) INTO v_paiements_count
  FROM paiements
  WHERE entreprise_id = p_entreprise_id;
  
  RAISE NOTICE '📊 [delete_entreprise_complete] Éléments à supprimer - Clients: %, Espaces: %, Abonnements: %, Factures: %, Paiements: %',
    v_clients_count, v_espaces_count, v_abonnements_count, v_factures_count, v_paiements_count;
  
  -- ============================================================
  -- SUPPRESSION EXPLICITE DE TOUT CE QUI EST LIÉ
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options des abonnements de cette entreprise
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des options d''abonnement...';
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (
    SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id
  );
  GET DIAGNOSTICS v_options_count = ROW_COUNT;
  RAISE NOTICE '✅ [delete_entreprise_complete] Options supprimées: %', v_options_count;
  
  -- 2. Supprimer TOUS les abonnements de cette entreprise
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des abonnements...';
  DELETE FROM abonnements
  WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Abonnements supprimés: %', v_abonnements_count;
  
  -- 3. Supprimer les paiements liés
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des paiements...';
  DELETE FROM paiements
  WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Paiements supprimés: %', v_paiements_count;
  
  -- 4. Supprimer les factures liées
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des factures...';
  DELETE FROM factures
  WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Factures supprimées: %', v_factures_count;
  
  -- 5. Les espaces_membres_clients seront supprimés en cascade via la contrainte FOREIGN KEY
  -- 6. Les clients seront supprimés en cascade via la contrainte FOREIGN KEY
  -- 7. Les auth.users seront supprimés via les triggers AFTER DELETE
  
  -- 8. Supprimer d'autres éléments liés si ils existent
  BEGIN
    DELETE FROM notifications WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Table peut ne pas exister
  END;
  
  BEGIN
    DELETE FROM devis WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    DELETE FROM previsionnels WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- 9. Enfin, supprimer l'entreprise elle-même
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression de l''entreprise...';
  DELETE FROM entreprises
  WHERE id = p_entreprise_id;
  
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
      v_clients_count,
      v_espaces_count,
      v_abonnements_count,
      v_options_count,
      v_factures_count,
      v_paiements_count
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

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise et TOUS ses éléments liés. Le super_admin plateforme peut supprimer toutes les entreprises. Version corrigée avec check_is_super_admin().';

-- Vérifier que la fonction existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_entreprise_complete') THEN
    RAISE NOTICE '✅ Fonction delete_entreprise_complete créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction delete_entreprise_complete non trouvée après création';
  END IF;
END $$;

-- Vérifier que check_is_super_admin existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_is_super_admin') THEN
    RAISE NOTICE '✅ Fonction check_is_super_admin disponible';
  ELSE
    RAISE WARNING '⚠️  Fonction check_is_super_admin non trouvée - la suppression pourrait échouer pour les super_admins';
  END IF;
END $$;

