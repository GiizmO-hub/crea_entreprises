/*
  # Fix : Ajouter les rôles collaborateurs dans utilisateurs
  
  Problème : La table `utilisateurs` autorise seulement ('super_admin', 'admin', 'collaborateur', 'client')
  alors que `collaborateurs` autorise aussi ('manager', 'comptable', 'commercial')
  
  Solution : Ajouter les rôles manquants à la contrainte CHECK de `utilisateurs`
*/

-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE utilisateurs 
  DROP CONSTRAINT IF EXISTS utilisateurs_role_check;

-- 2. Ajouter la nouvelle contrainte avec tous les rôles
ALTER TABLE utilisateurs
  ADD CONSTRAINT utilisateurs_role_check 
  CHECK (role IN ('super_admin', 'admin', 'collaborateur', 'client', 'manager', 'comptable', 'commercial'));

-- 3. Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Contrainte utilisateurs_role_check mise à jour avec succès';
  RAISE NOTICE 'Rôles autorisés: super_admin, admin, collaborateur, client, manager, comptable, commercial';
END $$;




