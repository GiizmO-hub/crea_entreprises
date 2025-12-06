-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION : Ajouter les colonnes manquantes à la table fiches_paie
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Ajouter periode_debut si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'periode_debut'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN periode_debut date;
  END IF;

  -- Ajouter periode_fin si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'periode_fin'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN periode_fin date;
  END IF;

  -- Ajouter numero si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'numero'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN numero text;
  END IF;

  -- S'assurer que date_paiement existe (devrait déjà exister mais on vérifie)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'date_paiement'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN date_paiement date;
  END IF;

  -- S'assurer que toutes les autres colonnes nécessaires existent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'net_imposable'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN net_imposable numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'total_cotisations_salariales'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN total_cotisations_salariales numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'total_cotisations_patronales'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN total_cotisations_patronales numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'cout_total_employeur'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN cout_total_employeur numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'heures_normales'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN heures_normales numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'heures_supp_25'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN heures_supp_25 numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'heures_supp_50'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN heures_supp_50 numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'est_automatique'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN est_automatique boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiches_paie' 
    AND column_name = 'statut'
  ) THEN
    ALTER TABLE public.fiches_paie ADD COLUMN statut text DEFAULT 'brouillon';
  END IF;
END
$$;

