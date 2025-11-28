/*
  # Fix: Corrections pour création automatisée
  
  PROBLÈME 1:
  - Erreur: "new row for relation "utilisateurs" violates check constraint "utilisateurs_role_check""
  - Le rôle 'client_super_admin' doit être dans la contrainte
  
  PROBLÈME 2:
  - Erreur: "column "actif" of relation "abonnements" does not exist"
  - La table abonnements utilise 'statut' pas 'actif'
  
  SOLUTION:
  - Vérifier/corriger la contrainte utilisateurs_role_check
  - Vérifier la structure de la table abonnements
*/

-- ============================================================================
-- PARTIE 1 : Corriger la contrainte utilisateurs_role_check
-- ============================================================================

DO $$
BEGIN
  -- Vérifier si la colonne role existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'utilisateurs' 
    AND column_name = 'role'
  ) THEN
    -- Supprimer l'ancienne contrainte si elle existe
    ALTER TABLE utilisateurs 
    DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
    
    -- Recréer la contrainte avec tous les rôles possibles
    ALTER TABLE utilisateurs
    ADD CONSTRAINT utilisateurs_role_check 
    CHECK (role IN ('admin', 'super_admin', 'client', 'client_super_admin', 'collaborateur', 'manager'));
    
    RAISE NOTICE '✅ Contrainte utilisateurs_role_check recréée avec tous les rôles';
  ELSE
    RAISE NOTICE '⚠️ La colonne role n''existe pas dans utilisateurs';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Vérifier la structure de la table abonnements
-- ============================================================================

DO $$
BEGIN
  -- Vérifier si la colonne 'actif' existe (elle ne devrait pas)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'actif'
  ) THEN
    RAISE NOTICE '⚠️ La colonne "actif" existe dans abonnements (devrait être supprimée)';
  END IF;
  
  -- Vérifier si la colonne 'statut' existe (elle devrait)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'statut'
  ) THEN
    RAISE NOTICE '✅ La colonne "statut" existe dans abonnements';
  ELSE
    RAISE NOTICE '⚠️ La colonne "statut" n''existe pas dans abonnements';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3 : Vérifier que user_id existe dans abonnements (peut être NULL)
-- ============================================================================

DO $$
BEGIN
  -- Vérifier si la colonne user_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE '✅ La colonne "user_id" existe dans abonnements';
  ELSE
    RAISE NOTICE '⚠️ La colonne "user_id" n''existe pas dans abonnements';
  END IF;
END $$;




