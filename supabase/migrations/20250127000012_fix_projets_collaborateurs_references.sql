/*
  # FIX : Corriger les références de collaborateurs dans projets
  
  PROBLÈME:
  - La table projets référence collaborateurs(id) 
  - Mais la vraie table est collaborateurs_entreprise(id)
  - Cela cause des erreurs lors du chargement des projets
  
  SOLUTION:
  - Corriger les foreign keys dans projets et projets_taches
  - Remplacer collaborateurs par collaborateurs_entreprise
*/

-- 1. Supprimer les anciennes contraintes de foreign key
DO $$
BEGIN
  -- Vérifier et supprimer la contrainte sur projets.responsable_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projets_responsable_id_fkey'
    AND table_name = 'projets'
  ) THEN
    ALTER TABLE projets DROP CONSTRAINT projets_responsable_id_fkey;
    RAISE NOTICE '✅ Contrainte projets_responsable_id_fkey supprimée';
  END IF;
  
  -- Vérifier et supprimer la contrainte sur projets_taches.collaborateur_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projets_taches_collaborateur_id_fkey'
    AND table_name = 'projets_taches'
  ) THEN
    ALTER TABLE projets_taches DROP CONSTRAINT projets_taches_collaborateur_id_fkey;
    RAISE NOTICE '✅ Contrainte projets_taches_collaborateur_id_fkey supprimée';
  END IF;
END $$;

-- 2. Recréer les contraintes avec collaborateurs_entreprise
-- Vérifier d'abord que la table collaborateurs_entreprise existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'collaborateurs_entreprise'
  ) THEN
    -- Recréer la contrainte pour projets.responsable_id
    ALTER TABLE projets
    ADD CONSTRAINT projets_responsable_id_fkey 
    FOREIGN KEY (responsable_id) 
    REFERENCES collaborateurs_entreprise(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Contrainte projets_responsable_id_fkey recréée avec collaborateurs_entreprise';
    
    -- Recréer la contrainte pour projets_taches.collaborateur_id
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'projets_taches'
    ) THEN
      ALTER TABLE projets_taches
      ADD CONSTRAINT projets_taches_collaborateur_id_fkey 
      FOREIGN KEY (collaborateur_id) 
      REFERENCES collaborateurs_entreprise(id) 
      ON DELETE SET NULL;
      
      RAISE NOTICE '✅ Contrainte projets_taches_collaborateur_id_fkey recréée avec collaborateurs_entreprise';
    END IF;
  ELSE
    RAISE WARNING '⚠️ La table collaborateurs_entreprise n''existe pas encore';
  END IF;
END $$;

SELECT '✅ Migration de correction des références collaborateurs appliquée !' as resultat;

