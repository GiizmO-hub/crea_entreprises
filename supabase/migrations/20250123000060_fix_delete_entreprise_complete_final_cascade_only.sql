/*
  # Fix FINAL: delete_entreprise_complete - Utiliser uniquement CASCADE
  
  PROBLÈME:
  - Erreur: "tuple to be deleted was already modified"
  - Les suppressions explicites entrent en conflit avec les triggers et CASCADE
  
  SOLUTION:
  - Utiliser UNIQUEMENT CASCADE pour tout
  - Supprimer seulement les éléments qui n'ont PAS de FK avec CASCADE
  - Laisser PostgreSQL gérer automatiquement le reste
*/

-- Recréer la fonction delete_entreprise_complete - Version FINALE simplifiée
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
  
  -- Vérifier que l'entreprise existe
  IF NOT EXISTS(SELECT 1 FROM entreprises WHERE id = p_entreprise_id) THEN
    RAISE WARNING '❌ [delete_entreprise_complete] Entreprise non trouvée';
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise non trouvée');
  END IF;
  
  -- Vérification des droits
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
    WHERE id = p_entreprise_id AND user_id = auth.uid()
  ) INTO v_is_owner;
  
  IF NOT (v_is_super_admin OR v_is_admin OR v_is_owner) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé'
    );
  END IF;
  
  -- Compter AVANT suppression
  SELECT COUNT(*) INTO v_clients_count FROM clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_espaces_count FROM espaces_membres_clients WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_abonnements_count FROM abonnements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_factures_count FROM factures WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_paiements_count FROM paiements WHERE entreprise_id = p_entreprise_id;
  SELECT COUNT(*) INTO v_options_count
  FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  
  RAISE NOTICE '📊 [delete_entreprise_complete] À supprimer - Clients: %, Espaces: %, Abonnements: %, Options: %',
    v_clients_count, v_espaces_count, v_abonnements_count, v_options_count;
  
  -- ============================================================
  -- ✅ SOLUTION FINALE: Supprimer SEULEMENT ce qui n'a pas CASCADE
  -- ============================================================
  
  -- 1. Supprimer les abonnement_options (pas de FK directe vers entreprises)
  DELETE FROM abonnement_options
  WHERE abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = p_entreprise_id);
  
  -- 2. Supprimer les abonnements (si pas de CASCADE - à vérifier dans la DB)
  DELETE FROM abonnements WHERE entreprise_id = p_entreprise_id;
  
  -- 3. NE PAS supprimer clients, espaces, factures, paiements
  -- Ils seront supprimés automatiquement par CASCADE quand on supprime l'entreprise
  
  -- 4. Supprimer l'entreprise (CASCADE supprimera automatiquement):
  --    - clients (CASCADE)
  --    - espaces_membres_clients (CASCADE)
  --    - factures (CASCADE)
  --    - transactions (CASCADE)
  --    - etc.
  -- Les triggers AFTER DELETE s'exécuteront normalement après
  DELETE FROM entreprises WHERE id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suppression échouée');
  END IF;
  
  RAISE NOTICE '✅ [delete_entreprise_complete] Entreprise supprimée avec succès !';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      'Entreprise supprimée avec succès (%s client(s), %s espace(s), %s abonnement(s), %s option(s) supprimé(s))',
      v_clients_count, v_espaces_count, v_abonnements_count, v_options_count
    ),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count,
    'abonnements_deleted', v_abonnements_count,
    'options_deleted', v_options_count
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

COMMENT ON FUNCTION delete_entreprise_complete IS 'Supprime une entreprise. Utilise CASCADE pour supprimer automatiquement clients, espaces, factures, etc. Version finale simplifiée.';


