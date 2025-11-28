/*
  # Ajouter la colonne user_id à entreprises si elle n'existe pas
  
  PROBLÈME:
  - La colonne user_id peut ne pas exister dans entreprises
  - Le frontend utilise user_id pour filtrer les entreprises
  - La fonction delete_entreprise_complete a été corrigée pour ne plus dépendre de user_id
  
  SOLUTION:
  - Vérifier si user_id existe
  - Si non, l'ajouter
  - Créer un index pour améliorer les performances
*/

-- Vérifier si la colonne user_id existe et l'ajouter si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entreprises' 
    AND column_name = 'user_id'
  ) THEN
    -- Ajouter la colonne user_id
    ALTER TABLE entreprises 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Créer un index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_entreprises_user_id ON entreprises(user_id);
    
    -- Mettre à jour les entreprises existantes pour les associer à l'utilisateur actuel si possible
    -- (Cela nécessite une logique spécifique selon votre cas d'usage)
    
    RAISE NOTICE '✅ Colonne user_id ajoutée à la table entreprises';
  ELSE
    RAISE NOTICE '✅ La colonne user_id existe déjà dans entreprises';
  END IF;
END $$;

-- S'assurer que l'index existe
CREATE INDEX IF NOT EXISTS idx_entreprises_user_id ON entreprises(user_id);

COMMENT ON COLUMN entreprises.user_id IS 'Propriétaire de l''entreprise (utilisateur qui l''a créée)';




