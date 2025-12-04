-- Seed initial des rubriques de paie (si la table est vide)

DO $$
DECLARE
  v_exists boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'rubriques_paie'
      AND table_schema = 'public'
  ) THEN
    RETURN;
  END IF;

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


