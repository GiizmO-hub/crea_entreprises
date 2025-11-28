/*
  # Fix: Colonne client_id/user_id dans abonnements
  
  PROBLÈME:
  - Erreur: "column "user_id" of relation "abonnements" does not exist"
  - La colonne user_id a peut-être été renommée en client_id ou supprimée
  
  SOLUTION:
  - Vérifier quelle colonne existe (client_id ou user_id)
  - Ajouter la colonne appropriée si aucune n'existe
  - S'assurer qu'elle peut être NULL si nécessaire pour les abonnements liés aux entreprises
*/

DO $$
DECLARE
  v_has_client_id boolean;
  v_has_user_id boolean;
BEGIN
  -- Vérifier si client_id existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'client_id'
  ) INTO v_has_client_id;
  
  -- Vérifier si user_id existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abonnements' 
    AND column_name = 'user_id'
  ) INTO v_has_user_id;
  
  -- Si aucune colonne n'existe, ajouter client_id (nouveau standard)
  IF NOT v_has_client_id AND NOT v_has_user_id THEN
    ALTER TABLE abonnements
    ADD COLUMN client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    
    -- Créer un index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_abonnements_client_id ON abonnements(client_id);
    
    RAISE NOTICE '✅ Colonne client_id ajoutée à la table abonnements';
  ELSIF v_has_user_id AND NOT v_has_client_id THEN
    RAISE NOTICE 'ℹ️ La colonne user_id existe, client_id sera ajoutée si nécessaire';
  ELSIF v_has_client_id THEN
    RAISE NOTICE '✅ La colonne client_id existe déjà';
  END IF;
END $$;




