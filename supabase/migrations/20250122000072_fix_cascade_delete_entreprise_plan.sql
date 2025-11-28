/*
  # Correction cascade suppression entreprise et plans
  
  PROBLÈMES:
  1. Quand on supprime une entreprise, l'espace client reste actif au lieu d'être supprimé
  2. Quand on supprime un plan, la suppression fonctionne mais le plan reste présent
  
  SOLUTIONS:
  1. Vérifier et corriger les contraintes CASCADE sur espaces_membres_clients
  2. Corriger les contraintes sur abonnements pour permettre suppression plan
  3. S'assurer que tous les éléments liés sont bien supprimés en cascade
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et corriger espaces_membres_clients
-- ============================================================================

-- Vérifier si la contrainte CASCADE existe, sinon la recréer
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe (peut-être sans CASCADE)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'espaces_membres_clients'::regclass
    AND conname LIKE '%entreprise_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE espaces_membres_clients
    DROP CONSTRAINT IF EXISTS espaces_membres_clients_entreprise_id_fkey;
  END IF;
  
  -- Recréer avec CASCADE
  ALTER TABLE espaces_membres_clients
  ADD CONSTRAINT espaces_membres_clients_entreprise_id_fkey
  FOREIGN KEY (entreprise_id)
  REFERENCES entreprises(id)
  ON DELETE CASCADE;
  
  RAISE NOTICE 'Contrainte CASCADE créée/recréée pour espaces_membres_clients.entreprise_id';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors de la création de la contrainte: %', SQLERRM;
END $$;

-- Vérifier aussi pour client_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'espaces_membres_clients'::regclass
    AND conname LIKE '%client_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE espaces_membres_clients
    DROP CONSTRAINT IF EXISTS espaces_membres_clients_client_id_fkey;
  END IF;
  
  ALTER TABLE espaces_membres_clients
  ADD CONSTRAINT espaces_membres_clients_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;
  
  RAISE NOTICE 'Contrainte CASCADE créée/recréée pour espaces_membres_clients.client_id';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors de la création de la contrainte client_id: %', SQLERRM;
END $$;

-- ============================================================================
-- PARTIE 2 : Corriger les contraintes sur abonnements pour plans
-- ============================================================================

-- Pour permettre la suppression d'un plan, on doit d'abord supprimer ou annuler les abonnements
-- OU changer la contrainte en SET NULL (mais plan_id est NOT NULL, donc on préfère SET NULL sur plan_id)

-- Option 1 : Changer plan_id pour permettre NULL (plus sûr)
DO $$
BEGIN
  -- Vérifier si plan_id peut être NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements'
    AND column_name = 'plan_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Modifier la colonne pour permettre NULL temporairement
    ALTER TABLE abonnements
    ALTER COLUMN plan_id DROP NOT NULL;
    
    RAISE NOTICE 'Colonne plan_id modifiée pour permettre NULL';
  END IF;
  
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'abonnements'::regclass
    AND conname LIKE '%plan_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE abonnements
    DROP CONSTRAINT IF EXISTS abonnements_plan_id_fkey;
  END IF;
  
  -- Recréer avec SET NULL pour permettre suppression du plan
  ALTER TABLE abonnements
  ADD CONSTRAINT abonnements_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES plans_abonnement(id)
  ON DELETE SET NULL;
  
  RAISE NOTICE 'Contrainte SET NULL créée/recréée pour abonnements.plan_id';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors de la modification abonnements.plan_id: %', SQLERRM;
END $$;

-- ============================================================================
-- PARTIE 3 : Vérifier et corriger plans_modules
-- ============================================================================

-- S'assurer que plans_modules a CASCADE pour permettre suppression du plan
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'plans_modules'
  ) THEN
    -- Supprimer l'ancienne contrainte si elle existe
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'plans_modules'::regclass
      AND conname LIKE '%plan_id%'
      AND contype = 'f'
    ) THEN
      ALTER TABLE plans_modules
      DROP CONSTRAINT IF EXISTS plans_modules_plan_id_fkey;
    END IF;
    
    -- Recréer avec CASCADE
    ALTER TABLE plans_modules
    ADD CONSTRAINT plans_modules_plan_id_fkey
    FOREIGN KEY (plan_id)
    REFERENCES plans_abonnement(id)
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Contrainte CASCADE créée/recréée pour plans_modules.plan_id';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors de la modification plans_modules: %', SQLERRM;
END $$;

-- ============================================================================
-- PARTIE 4 : Fonction pour supprimer un plan proprement
-- ============================================================================

-- Fonction RPC pour supprimer un plan et gérer les abonnements existants
CREATE OR REPLACE FUNCTION delete_plan_abonnement_safe(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnements_count integer;
  v_result jsonb;
BEGIN
  -- Vérifier si l'utilisateur est admin
  IF NOT is_admin_user_simple() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Admin requis'
    );
  END IF;
  
  -- Compter les abonnements actifs pour ce plan
  SELECT COUNT(*) INTO v_abonnements_count
  FROM abonnements
  WHERE plan_id = p_plan_id
  AND statut = 'actif';
  
  -- Si des abonnements actifs existent, annuler d'abord le plan (marquer comme inactif)
  IF v_abonnements_count > 0 THEN
    -- Marquer le plan comme inactif au lieu de le supprimer
    UPDATE plans_abonnement
    SET actif = false
    WHERE id = p_plan_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Plan désactivé (non supprimé car %s abonnement(s) actif(s) existent)', v_abonnements_count),
      'abonnements_actifs', v_abonnements_count,
      'action', 'desactivated'
    );
  ELSE
    -- Pas d'abonnements actifs, on peut supprimer
    DELETE FROM plans_abonnement
    WHERE id = p_plan_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Plan supprimé avec succès',
      'action', 'deleted'
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION delete_plan_abonnement_safe(uuid) IS 'Supprime un plan d''abonnement en gérant les abonnements actifs (désactive si abonnements existent, supprime sinon)';

GRANT EXECUTE ON FUNCTION delete_plan_abonnement_safe(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 5 : Fonction pour supprimer une entreprise proprement
-- ============================================================================

-- S'assurer que la suppression d'entreprise supprime bien tout en cascade
CREATE OR REPLACE FUNCTION delete_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clients_count integer;
  v_espaces_count integer;
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
  
  -- Supprimer l'entreprise (les cascades feront le reste)
  DELETE FROM entreprises
  WHERE id = p_entreprise_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Entreprise supprimée avec succès (%s client(s), %s espace(s) supprimé(s))', v_clients_count, v_espaces_count),
    'clients_deleted', v_clients_count,
    'espaces_deleted', v_espaces_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION delete_entreprise_complete(uuid) IS 'Supprime une entreprise et tous ses éléments liés en cascade';

GRANT EXECUTE ON FUNCTION delete_entreprise_complete(uuid) TO authenticated;




