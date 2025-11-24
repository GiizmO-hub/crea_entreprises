/*
  # Fix: Ajouter colonne statut_paiement si elle n'existe pas
  
  PROBLÈME:
  - Erreur: "column entreprises.statut_paiement does not exist"
  - La colonne est utilisée dans le frontend mais n'existe pas encore en base
  
  SOLUTION:
  - Ajouter la colonne conditionnellement
  - Mettre à jour les entreprises existantes avec une valeur par défaut
*/

-- Ajouter colonne statut_paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises'
    AND column_name = 'statut_paiement'
  ) THEN
    ALTER TABLE entreprises
    ADD COLUMN statut_paiement text DEFAULT 'non_requis'
    CHECK (statut_paiement IN ('non_requis', 'en_attente', 'paye', 'refuse', 'rembourse'));
    
    -- Mettre à jour les entreprises existantes
    UPDATE entreprises
    SET statut_paiement = 'non_requis'
    WHERE statut_paiement IS NULL;
    
    COMMENT ON COLUMN entreprises.statut_paiement IS 'Statut du paiement pour la création de l''entreprise';
    
    RAISE NOTICE '✅ Colonne statut_paiement ajoutée à la table entreprises';
  ELSE
    RAISE NOTICE 'ℹ️ La colonne statut_paiement existe déjà';
  END IF;
END $$;

