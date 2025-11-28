/*
  # Fix: delete_entreprise_complete - Utiliser CASCADE au lieu de suppressions explicites
  
  PROBLÈME:
  - Erreur: "tuple to be deleted was already modified"
  - Les suppressions explicites entrent en conflit avec les triggers et CASCADE
  - Multiple triggers BEFORE/AFTER DELETE créent des conflits
  
  SOLUTION:
  - Laisser les contraintes CASCADE faire le travail automatiquement
  - Supprimer uniquement ce qui n'est pas géré par CASCADE
  - Utiliser une transaction pour garantir l'atomicité
*/

-- Recréer la fonction delete_entreprise_complete en utilisant CASCADE
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
  
  -- Compter les éléments liés AVANT suppression
  SELECT COUNT(*) INTO v_clients_count FROM clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_espaces_count FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_abonnements_count FROM abonnements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_factures_count FROM factures WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_paiements_count FROM paiements WHERE entreprise_id = p_entreprise_id;
  
  -- Compter les options d'abonnement
  SELECT COUNT(*) INTO v_options_count
  FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  
  RAISE NOTICE '📊 [delete_entreprise_complete] Éléments à supprimer - Clients: %, Espaces: %, Abonnements: %, Options: %, Factures: %, Paiements: %',
    v_clients_count, v_espaces_count, v_abonnements_count, v_options_count, v_factures_count, v_paiements_count;
  
  -- ============================================================
  -- ✅ SOLUTION: Supprimer uniquement ce qui n'est PAS géré par CASCADE
  -- La plupart des éléments seront supprimés automatiquement par CASCADE
  -- On supprime seulement les éléments qui n'ont pas de FK avec CASCADE
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options MANUELLEMENT (pas de FK directe vers entreprises)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des options d''abonnement...';
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  RAISE NOTICE '✅ [delete_entreprise_complete] Options supprimées';
  
  -- 2. Supprimer les abonnements MANUELLEMENT (si pas de CASCADE sur entreprise_id)
  -- Note: Si abonnements a une FK CASCADE vers entreprises, cette ligne sera inutile mais pas nuisible
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des abonnements...';
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Abonnements supprimés';
  
  -- 3. Supprimer les paiements MANUELLEMENT (si pas de CASCADE)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des paiements...';
  DELETE FROM paiements WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Paiements supprimés';
  
  -- 4. Supprimer les factures MANUELLEMENT (si pas de CASCADE)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression des factures...';
  DELETE FROM factures WHERE entreprise_id = p_entreprise_id;
  RAISE NOTICE '✅ [delete_entreprise_complete] Factures supprimées';
  
  -- 5. Supprimer autres éléments optionnels (si tables existent)
  BEGIN
    DELETE FROM notifications WHERE entreprise_id = p_entreprise_id;
    DELETE FROM devis WHERE entreprise_id = p_entreprise_id;
    DELETE FROM documents_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM demandes_clients WHERE entreprise_id = p_entreprise_id;
    DELETE FROM previsionnels WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  [delete_entreprise_complete] Certaines tables n''existent pas (normal)';
  END;
  
  -- 6. NE PAS supprimer explicitement espaces_membres_clients
  -- Ils seront supprimés par CASCADE quand on supprime les clients
  
  -- 7. NE PAS supprimer explicitement les clients
  -- Ils seront supprimés par CASCADE quand on supprime l'entreprise
  -- Les triggers AFTER DELETE sur clients supprimeront les auth.users
  
  -- 8. Supprimer l'entreprise (CASCADE supprimera automatiquement clients et espaces)
  RAISE NOTICE '🗑️  [delete_entreprise_complete] Suppression de l''entreprise (CASCADE supprimera clients et espaces)...';
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
      'sqlstate', SQLSTATE,
      'hint', 'Vérifiez les logs PostgreSQL pour plus de détails'
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise. Les clients et espaces sont supprimés automatiquement par CASCADE. Version optimisée pour éviter les conflits avec les triggers.';


