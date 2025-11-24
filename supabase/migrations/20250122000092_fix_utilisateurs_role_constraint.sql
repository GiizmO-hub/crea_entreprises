/*
  # Fix: utilisateurs_role_check constraint
  
  PROBLÈME:
  - Erreur: "new row for relation "utilisateurs" violates check constraint "utilisateurs_role_check""
  - Le rôle 'client_super_admin' n'est pas autorisé par la contrainte CHECK
  - La fonction create_espace_membre_from_client_unified essaie d'insérer 'client_super_admin'
  
  SOLUTION:
  - Supprimer l'ancienne contrainte si elle existe
  - Créer/modifier la contrainte pour inclure 'client_super_admin'
  - S'assurer que tous les rôles possibles sont autorisés
*/

-- 1. Vérifier et supprimer l'ancienne contrainte
DO $$
BEGIN
  -- Supprimer toutes les contraintes CHECK existantes sur utilisateurs.role
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'utilisateurs'::regclass 
    AND conname LIKE '%role%check%'
  ) THEN
    ALTER TABLE utilisateurs 
    DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
    
    RAISE NOTICE '✅ Ancienne contrainte utilisateurs_role_check supprimée';
  END IF;
END $$;

-- 2. Vérifier si la colonne role existe et créer/modifier la contrainte
DO $$
BEGIN
  -- Vérifier si la colonne role existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'utilisateurs' 
    AND column_name = 'role'
  ) THEN
    -- Ajouter/modifier la contrainte CHECK pour inclure tous les rôles possibles
    ALTER TABLE utilisateurs
    DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
    
    ALTER TABLE utilisateurs
    ADD CONSTRAINT utilisateurs_role_check 
    CHECK (role IN ('admin', 'super_admin', 'client', 'client_super_admin', 'collaborateur', 'manager'));
    
    RAISE NOTICE '✅ Contrainte utilisateurs_role_check créée/modifiée avec tous les rôles';
  ELSE
    RAISE NOTICE '⚠️ La colonne role n''existe pas dans utilisateurs';
  END IF;
END $$;

-- 3. Vérification finale
DO $$
DECLARE
  v_constraint_exists boolean;
  v_constraint_definition text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'utilisateurs'::regclass 
    AND conname = 'utilisateurs_role_check'
  ) INTO v_constraint_exists;
  
  IF v_constraint_exists THEN
    SELECT pg_get_constraintdef(oid) INTO v_constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'utilisateurs'::regclass 
    AND conname = 'utilisateurs_role_check';
    
    RAISE NOTICE '✅ Contrainte vérifiée: %', v_constraint_definition;
  ELSE
    RAISE NOTICE '⚠️ La contrainte utilisateurs_role_check n''existe pas';
  END IF;
END $$;

