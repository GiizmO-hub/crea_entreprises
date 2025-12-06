-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION : Rendre salary_id nullable dans fiches_paie
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Vérifier si la colonne salary_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'salary_id'
  ) THEN
    -- Rendre la colonne nullable si elle est NOT NULL
    ALTER TABLE public.fiches_paie 
    ALTER COLUMN salary_id DROP NOT NULL;
    
    RAISE NOTICE '✅ Colonne salary_id rendue nullable dans fiches_paie';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne salary_id n''existe pas dans fiches_paie';
  END IF;
END
$$;

