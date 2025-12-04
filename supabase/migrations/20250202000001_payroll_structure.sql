-- Structure de données pour un bulletin de salaire complet
-- Tables : rubriques_paie, fiches_paie (enrichie), fiches_paie_lignes, parametres_paie

-------------------------------
-- 1. Table rubriques_paie
-------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'rubriques_paie'
      AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.rubriques_paie (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      libelle text NOT NULL,
      categorie text NOT NULL DEFAULT 'COTISATION_SAL', -- REMUNERATION, COTISATION_SAL, COTISATION_PAT, INFO, TOTAL
      sens text NOT NULL DEFAULT 'gain',               -- gain, retenue_salariale, retenue_patronale
      ordre_affichage integer NOT NULL DEFAULT 0,
      groupe_affichage text,                           -- SALAIRE, SANTE, RETRAITE, CSG, DIVERS...
      par_defaut_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

-------------------------------
-- 5. Données de base rubriques_paie
-------------------------------

DO $$
DECLARE
  v_exists boolean;
BEGIN
  -- On ne seed qu'une fois : si des rubriques existent déjà, on ne fait rien
  SELECT EXISTS (SELECT 1 FROM public.rubriques_paie) INTO v_exists;
  IF v_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.rubriques_paie (code, libelle, categorie, sens, ordre_affichage, groupe_affichage)
  VALUES
    -- Bloc Rémunération
    ('SAL_BASE', 'Salaire de base', 'REMUNERATION', 'gain', 10, 'REMUNERATION'),
    ('HS_25', 'Heures normales majorées 25%', 'REMUNERATION', 'gain', 20, 'REMUNERATION'),
    ('HS_50', 'Heures majorées 50%', 'REMUNERATION', 'gain', 30, 'REMUNERATION'),
    ('PRIME', 'Primes diverses', 'REMUNERATION', 'gain', 40, 'REMUNERATION'),

    -- Bloc Sécurité sociale / Santé (cotisations salariales)
    ('SS_MALADIE', 'Sécurité sociale - Maladie, maternité, invalidité, décès', 'COTISATION_SAL', 'retenue_salariale', 110, 'SANTE'),
    ('SS_VIEIL_PLAF', 'Sécurité sociale - Vieillesse (plafonnée)', 'COTISATION_SAL', 'retenue_salariale', 120, 'RETRAITE'),
    ('SS_VIEIL_DEPLAF', 'Sécurité sociale - Vieillesse (déplafonnée)', 'COTISATION_SAL', 'retenue_salariale', 130, 'RETRAITE'),
    ('CHOMAGE_SAL', 'Assurance chômage (part salarié)', 'COTISATION_SAL', 'retenue_salariale', 140, 'CHOMAGE'),
    ('RET_COMP', 'Retraite complémentaire', 'COTISATION_SAL', 'retenue_salariale', 150, 'RETRAITE'),
    ('CSG_DED', 'CSG/CRDS déductible', 'COTISATION_SAL', 'retenue_salariale', 160, 'CSG'),
    ('CSG_NON_DED', 'CSG/CRDS non déductible', 'COTISATION_SAL', 'retenue_salariale', 170, 'CSG'),

    -- Bloc cotisations patronales
    ('SS_MALADIE_PAT', 'Sécurité sociale - Maladie, maternité, invalidité, décès (patronale)', 'COTISATION_PAT', 'retenue_patronale', 210, 'SANTE'),
    ('SS_VIEIL_PLAF_PAT', 'Sécurité sociale - Vieillesse (plafonnée) (patronale)', 'COTISATION_PAT', 'retenue_patronale', 220, 'RETRAITE'),
    ('SS_VIEIL_DEPLAF_PAT', 'Sécurité sociale - Vieillesse (déplafonnée) (patronale)', 'COTISATION_PAT', 'retenue_patronale', 230, 'RETRAITE'),
    ('ALLOC_FAM', 'Allocations familiales', 'COTISATION_PAT', 'retenue_patronale', 240, 'FAMILLE'),
    ('AT_MP', 'Accidents du travail / maladies professionnelles', 'COTISATION_PAT', 'retenue_patronale', 250, 'AT_MP'),
    ('CHOMAGE_PAT', 'Assurance chômage (part employeur)', 'COTISATION_PAT', 'retenue_patronale', 260, 'CHOMAGE'),
    ('RET_COMP_PAT', 'Retraite complémentaire (part employeur)', 'COTISATION_PAT', 'retenue_patronale', 270, 'RETRAITE'),
    ('AUTRES_CONTRIB', 'Autres contributions employeur', 'COTISATION_PAT', 'retenue_patronale', 280, 'DIVERS'),

    -- Lignes de total / info
    ('TOTAL_SAL', 'Total part salariale', 'TOTAL', 'retenue_salariale', 900, 'TOTAL'),
    ('TOTAL_PAT', 'Total part employeur', 'TOTAL', 'retenue_patronale', 910, 'TOTAL'),
    ('NET_IMPOSABLE', 'Net imposable', 'TOTAL', 'gain', 920, 'TOTAL'),
    ('NET_A_PAYER', 'Net à payer', 'TOTAL', 'gain', 930, 'TOTAL'),
    ('COUT_EMPLOYEUR', 'Coût total employeur', 'TOTAL', 'gain', 940, 'TOTAL');
END
$$;

-------------------------------
-- 2. Enrichissement de fiches_paie
-------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'fiches_paie'
      AND table_schema = 'public'
  ) THEN
    -- Colonnes de synthèse
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'net_imposable') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN net_imposable numeric(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'net_a_payer') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN net_a_payer numeric(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'total_cotisations_salariales') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN total_cotisations_salariales numeric(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'total_cotisations_patronales') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN total_cotisations_patronales numeric(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'cout_total_employeur') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN cout_total_employeur numeric(12,2);
    END IF;

    -- Informations de période / heures / congés
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'mois') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN mois integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'annee') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN annee integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'heures_normales') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN heures_normales numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'heures_supp_25') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN heures_supp_25 numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'heures_supp_50') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN heures_supp_50 numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'nb_jours_conges_acquis') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN nb_jours_conges_acquis numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'nb_jours_conges_pris') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN nb_jours_conges_pris numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'nb_jours_conges_solde') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN nb_jours_conges_solde numeric(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches_paie' AND column_name = 'statut') THEN
      ALTER TABLE public.fiches_paie ADD COLUMN statut text DEFAULT 'brouillon';
    END IF;
  END IF;
END
$$;

-------------------------------
-- 3. Table fiches_paie_lignes
-------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'fiches_paie_lignes'
      AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.fiches_paie_lignes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      fiche_paie_id uuid NOT NULL REFERENCES public.fiches_paie(id) ON DELETE CASCADE,
      rubrique_id uuid REFERENCES public.rubriques_paie(id),
      libelle_affiche text NOT NULL,
      base numeric(14,4),
      unite_base text,                      -- H, €, %, J...
      taux_salarial numeric(7,3),
      montant_salarial numeric(14,4),
      taux_patronal numeric(7,3),
      montant_patronal numeric(14,4),
      montant_a_payer numeric(14,4),
      ordre_affichage integer NOT NULL DEFAULT 0,
      groupe_affichage text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_fiches_paie_lignes_fiche_paie_id
      ON public.fiches_paie_lignes(fiche_paie_id);
  END IF;
END
$$;

-------------------------------
-- 4. Table parametres_paie
-------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'parametres_paie'
      AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.parametres_paie (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
      annee integer NOT NULL,
      code_rubrique text NOT NULL,
      taux_salarial_par_defaut numeric(7,3),
      taux_patronal_par_defaut numeric(7,3),
      plafond_base numeric(14,4),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (entreprise_id, annee, code_rubrique)
    );
  END IF;
END
$$;


