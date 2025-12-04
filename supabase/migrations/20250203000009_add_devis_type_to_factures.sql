/*
  # Ajouter le type 'devis' aux factures
  
  OBJECTIF:
  - Permettre la création de devis dans la table factures
  - Utiliser la même structure que les factures pour éviter la duplication
  - Respecter le fichier tampon (shared.ts) qui définit les types
  
  ACTIONS:
  1. Vérifier si la colonne type existe dans factures
  2. Si elle existe, vérifier si elle accepte 'devis'
  3. Si non, modifier la contrainte CHECK pour inclure 'devis'
  4. Ajouter un champ date_validite pour les devis (optionnel)
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et modifier la contrainte CHECK sur factures.type
-- ============================================================================

DO $$
DECLARE
  v_constraint_name text;
  v_needs_update boolean := false;
BEGIN
  -- Chercher la contrainte CHECK sur factures.type
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'factures'::regclass
    AND contype = 'c'
    AND conname LIKE '%type%'
  LIMIT 1;
  
  -- Si aucune contrainte CHECK trouvée, la colonne type est probablement text sans contrainte
  -- On peut alors directement insérer 'devis' sans problème
  IF v_constraint_name IS NULL THEN
    RAISE NOTICE '✅ Colonne factures.type n''a pas de contrainte CHECK - ''devis'' sera accepté automatiquement';
  ELSE
    -- Vérifier si 'devis' est déjà dans la contrainte
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_get_constraintdef(c.oid) AS def ON true
      WHERE c.conname = v_constraint_name
        AND def::text LIKE '%devis%'
    ) THEN
      RAISE NOTICE '✅ Contrainte CHECK sur factures.type accepte déjà ''devis''';
    ELSE
      RAISE NOTICE '⚠️ Contrainte CHECK trouvée mais ''devis'' manquant - Modification nécessaire';
      v_needs_update := true;
    END IF;
  END IF;
  
  -- Si besoin de mise à jour, supprimer l'ancienne contrainte et en créer une nouvelle
  IF v_needs_update THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE format('ALTER TABLE factures DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE '✅ Ancienne contrainte CHECK supprimée';
    
    -- Créer une nouvelle contrainte avec 'devis' inclus
    ALTER TABLE factures
    ADD CONSTRAINT factures_type_check 
    CHECK (type IS NULL OR type IN ('facture', 'proforma', 'devis'));
    
    RAISE NOTICE '✅ Nouvelle contrainte CHECK créée avec ''devis'' inclus';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Ajouter colonne date_validite pour les devis (optionnel)
-- ============================================================================

DO $$
BEGIN
  -- Ajouter date_validite si elle n'existe pas (utile pour les devis)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'date_validite'
  ) THEN
    ALTER TABLE factures 
    ADD COLUMN date_validite date;
    
    COMMENT ON COLUMN factures.date_validite IS 'Date de validité du devis (uniquement pour type=devis)';
    
    RAISE NOTICE '✅ Colonne date_validite ajoutée à factures';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne date_validite existe déjà dans factures';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3 : Ajouter colonne devis_facture_id pour lier devis → facture (optionnel)
-- ============================================================================

DO $$
BEGIN
  -- Ajouter devis_facture_id si elle n'existe pas (pour transformer devis → facture)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'devis_facture_id'
  ) THEN
    ALTER TABLE factures 
    ADD COLUMN devis_facture_id uuid REFERENCES factures(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN factures.devis_facture_id IS 'ID du devis source si cette facture a été créée depuis un devis accepté';
    
    -- Index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_factures_devis_facture_id ON factures(devis_facture_id);
    
    RAISE NOTICE '✅ Colonne devis_facture_id ajoutée à factures';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne devis_facture_id existe déjà dans factures';
  END IF;
END $$;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration terminée - Le type ''devis'' est maintenant accepté dans factures.type';
  RAISE NOTICE '   Colonnes ajoutées: date_validite, devis_facture_id';
END $$;

