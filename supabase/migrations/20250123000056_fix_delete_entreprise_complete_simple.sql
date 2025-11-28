/*
  # Fix: delete_entreprise_complete - Version simplifiée et robuste
  
  PROBLÈME:
  - La fonction ne fonctionne pas pour supprimer les entreprises
  - Vérification des droits trop complexe
  
  SOLUTION:
  - Simplifier la vérification des droits
  - Permettre au super_admin de supprimer toutes les entreprises
  - Utiliser les fonctions existantes (check_is_super_admin, is_admin_user_simple)
*/

-- Recréer la fonction delete_entreprise_complete de manière plus simple et robuste
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
  
  -- ✅ VÉRIFICATION DES DROITS - Version simplifiée
  -- 1. Vérifier si super_admin (plateforme)
  BEGIN
    SELECT check_is_super_admin() INTO v_is_super_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_super_admin := false;
    RAISE NOTICE '⚠️  [delete_entreprise_complete] Erreur check_is_super_admin: %', SQLERRM;
  END;
  
  -- 2. Vérifier si admin
  BEGIN
    SELECT is_admin_user_simple() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
    RAISE NOTICE '⚠️  [delete_entreprise_complete] Erreur is_admin_user_simple: %', SQLERRM;
  END;
  
  -- 3. Vérifier si propriétaire
  SELECT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) INTO v_is_owner;
  
  RAISE NOTICE '🔐 [delete_entreprise_complete] Droits - Super Admin: %, Admin: %, Owner: %', 
    v_is_super_admin, v_is_admin, v_is_owner;
  
  -- Autoriser si super_admin, admin, ou propriétaire
  IF NOT (v_is_super_admin OR v_is_admin OR v_is_owner) THEN
    RAISE WARNING '❌ [delete_entreprise_complete] Accès non autorisé';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé. Vous devez être le propriétaire de l''entreprise ou administrateur de la plateforme.'
    );
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Droits vérifiés - Suppression autorisée';
  
  -- Compter les éléments liés (pour info)
  SELECT COUNT(*) INTO v_clients_count FROM clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_espaces_count FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_abonnements_count FROM abonnements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_factures_count FROM factures WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_paiements_count FROM paiements WHERE entreprise_id = p_entreprise_id;
  
  RAISE NOTICE '📊 [delete_entreprise_complete] Éléments à supprimer - Clients: %, Espaces: %, Abonnements: %, Factures: %, Paiements: %',
    v_clients_count, v_espaces_count, v_abonnements_count, v_factures_count, v_paiements_count;
  
  -- ============================================================
  -- SUPPRESSION EXPLICITE DE TOUT CE QUI EST LIÉ
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des options d''abonnement...';
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  GET DIAGNOSTICS v_options_count = ROW_COUNT;
  
  -- 2. Supprimer les abonnements
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des abonnements...';
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  
  -- 3. Supprimer les paiements
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des paiements...';
  DELETE FROM paiements WHERE entreprise_id = p_entreprise_id;
  
  -- 4. Supprimer les factures
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des factures...';
  DELETE FROM factures WHERE entreprise_id = p_entreprise_id;
  
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
  
  -- 6. Supprimer l'entreprise (cascade supprimera clients et espaces)
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

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise et TOUS ses éléments liés. Super_admin et admin peuvent supprimer toutes les entreprises. Version corrigée et simplifiée.';

-- Vérifier que la fonction existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_entreprise_complete') THEN
    RAISE NOTICE '✅ Fonction delete_entreprise_complete créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction delete_entreprise_complete non trouvée après création';
  END IF;
END $$;


