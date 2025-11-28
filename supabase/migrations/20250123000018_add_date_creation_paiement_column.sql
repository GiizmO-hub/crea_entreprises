/*
  # Ajouter la colonne date_creation_paiement à la table paiements
  
  Cette migration ajoute la colonne manquante pour calculer le délai de 96h pour les virements.
*/

-- Ajouter la colonne date_creation_paiement si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements'
    AND column_name = 'date_creation_paiement'
  ) THEN
    ALTER TABLE paiements
    ADD COLUMN date_creation_paiement timestamptz DEFAULT now();
    
    COMMENT ON COLUMN paiements.date_creation_paiement IS 'Date de création du paiement pour calculer le délai de 96h pour virement';
    
    RAISE NOTICE '✅ Colonne date_creation_paiement ajoutée à la table paiements';
  ELSE
    RAISE NOTICE '⚠️ La colonne date_creation_paiement existe déjà';
  END IF;
END $$;

-- Mettre à jour les paiements existants qui n'ont pas de date_creation_paiement
UPDATE paiements
SET date_creation_paiement = created_at
WHERE date_creation_paiement IS NULL;

-- Créer un index pour optimiser les requêtes de délai
CREATE INDEX IF NOT EXISTS idx_paiements_date_creation_paiement 
ON paiements(date_creation_paiement) 
WHERE methode_paiement = 'virement' AND statut = 'en_attente';




