/*
  # Ajouter le type proforma aux factures
  
  1. Ajouter colonne type à factures si elle n'existe pas
  2. Modifier la colonne pour permettre 'facture', 'proforma', 'avoir'
  3. Définir 'facture' comme valeur par défaut
*/

-- Ajouter colonne type si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures' AND column_name = 'type'
  ) THEN
    ALTER TABLE factures ADD COLUMN type text DEFAULT 'facture' CHECK (type IN ('facture', 'proforma', 'avoir'));
  ELSE
    -- Si la colonne existe, mettre à jour la contrainte CHECK
    ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_type_check;
    ALTER TABLE factures ADD CONSTRAINT factures_type_check 
      CHECK (type IN ('facture', 'proforma', 'avoir'));
  END IF;
END $$;

-- Mettre à jour les factures existantes pour avoir le type 'facture' par défaut
UPDATE factures 
SET type = 'facture' 
WHERE type IS NULL;

COMMENT ON COLUMN factures.type IS 'Type de document: facture, proforma, ou avoir';

