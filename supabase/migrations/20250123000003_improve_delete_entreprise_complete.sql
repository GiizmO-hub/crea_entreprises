/*
  # Amélioration suppression complète entreprise
  
  PROBLÈME:
  - Les abonnements ne sont pas supprimés lors de la suppression d'une entreprise
  - Les plans peuvent garder des références orphelines
  - Les informations restent en mémoire dans plans/abonnements
  
  SOLUTION:
  - Supprimer explicitement TOUS les abonnements liés à l'entreprise
  - Supprimer les abonnement_options liés
  - S'assurer que tout est vraiment supprimé
*/

-- Recréer la fonction delete_entreprise_complete pour supprimer TOUT
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
  v_result jsonb;
BEGIN
  -- Vérifier si l'utilisateur est admin ou propriétaire
  IF NOT (
    is_admin_user_simple()
    OR EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = p_entreprise_id
      AND user_id = auth.uid()
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé'
    );
  END IF;
  
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
  
  -- ============================================================
  -- SUPPRESSION EXPLICITE DE TOUT CE QUI EST LIÉ
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options des abonnements de cette entreprise
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (
    SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id
  );
  GET DIAGNOSTICS v_options_count = ROW_COUNT;
  
  -- 2. Supprimer TOUS les abonnements de cette entreprise
  DELETE FROM abonnements
  WHERE entreprise_id = p_entreprise_id;
  
  -- 3. Les espaces_membres_clients seront supprimés en cascade via la contrainte FOREIGN KEY
  -- 4. Les clients seront supprimés en cascade via la contrainte FOREIGN KEY
  -- 5. Les auth.users seront supprimés via les triggers
  
  -- 6. Supprimer d'autres éléments liés si ils existent
  -- Supprimer les notifications liées (si table existe)
  BEGIN
    DELETE FROM notifications
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Table peut ne pas exister
  END;
  
  -- Supprimer les factures liées (si table existe)
  BEGIN
    DELETE FROM factures
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les devis liés (si table existe)
  BEGIN
    DELETE FROM devis
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les documents liés (si table existe)
  BEGIN
    DELETE FROM documents_clients
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les demandes liées (si table existe)
  BEGIN
    DELETE FROM demandes_clients
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Supprimer les prévisionnels liés (si table existe)
  BEGIN
    DELETE FROM previsionnels
    WHERE entreprise_id = p_entreprise_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- 7. Enfin, supprimer l'entreprise elle-même
  DELETE FROM entreprises
  WHERE id = p_entreprise_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée avec succès (%s client(s), %s espace(s), %s abonnement(s), %s option(s) supprimé(s))',
      v_clients_count,
      v_espaces_count,
      v_abonnements_count,
      v_options_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'options_deleted', v_options_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime complètement une entreprise et TOUS ses éléments liés (clients, espaces, abonnements, options, etc.)';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;




