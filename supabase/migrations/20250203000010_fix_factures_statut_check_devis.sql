/*
  # Mettre à jour la contrainte CHECK sur factures.statut pour accepter les statuts de devis
  
  OBJECTIF:
  - Permettre les statuts spécifiques aux devis : 'envoye', 'accepte', 'refuse', 'expire'
  - Conserver les statuts existants pour les factures : 'brouillon', 'envoyee', 'en_attente', 'payee', 'annulee', 'valide'
*/

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Chercher la contrainte CHECK sur factures.statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'factures'::regclass
    AND contype = 'c'
    AND conname LIKE '%statut%'
  LIMIT 1;
  
  -- Si une contrainte existe, la supprimer
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE factures DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE '✅ Ancienne contrainte CHECK sur statut supprimée: %', v_constraint_name;
  END IF;
  
  -- Créer une nouvelle contrainte avec tous les statuts (factures + devis)
  ALTER TABLE factures
  ADD CONSTRAINT factures_statut_check 
  CHECK (
    statut IN (
      -- Statuts pour factures/proforma
      'brouillon', 
      'envoyee', 
      'en_attente', 
      'payee', 
      'annulee', 
      'valide',
      -- Statuts pour devis
      'envoye',
      'accepte',
      'refuse',
      'expire'
    )
  );
  
  RAISE NOTICE '✅ Nouvelle contrainte CHECK créée avec tous les statuts (factures + devis)';
END $$;

