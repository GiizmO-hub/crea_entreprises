/*
  # Ajouter colonne source dans factures
  
  Cette migration ajoute une colonne `source` pour distinguer les factures créées par :
  - 'plateforme' : Factures créées par la plateforme (super admin) pour les clients
  - 'client' : Factures créées par les clients eux-mêmes
*/

-- Ajouter la colonne source si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'source'
  ) THEN
    ALTER TABLE factures 
    ADD COLUMN source text DEFAULT 'client' CHECK (source IN ('plateforme', 'client'));
    
    -- Mettre à jour les factures existantes créées par la plateforme
    -- (celles qui ont été créées via generate_invoice_for_entreprise ou creer_facture_et_abonnement_apres_paiement)
    UPDATE factures
    SET source = 'plateforme'
    WHERE notes::text LIKE '%plateforme%' 
       OR notes::text LIKE '%generate_invoice%'
       OR notes::text LIKE '%automatiquement%'
       OR paiement_id IS NOT NULL; -- Les factures liées à un paiement sont créées par la plateforme
    
    -- Créer un index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_factures_source ON factures(source);
    
    RAISE NOTICE '✅ Colonne source ajoutée à la table factures';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne source existe déjà dans factures';
  END IF;
END $$;

-- Commentaire
COMMENT ON COLUMN factures.source IS 'Source de création: plateforme (créée par la plateforme) ou client (créée par le client)';

