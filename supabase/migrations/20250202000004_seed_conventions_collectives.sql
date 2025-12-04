/*
  # Seed des conventions collectives courantes avec leurs taux
  
  Cette migration pré-remplit la table conventions_collectives avec
  les conventions collectives les plus courantes et leurs taux 2025.
*/

-- Insérer les conventions collectives courantes
INSERT INTO conventions_collectives (
  code_idcc,
  libelle,
  secteur_activite,
  annee,
  -- Taux salariaux (en décimal)
  taux_ss_maladie_sal,
  taux_ss_vieil_plaf_sal,
  taux_ss_vieil_deplaf_sal,
  taux_ass_chomage_sal,
  taux_ret_compl_sal,
  taux_csg_ded_sal,
  taux_csg_non_ded_sal,
  -- Taux patronaux (en décimal)
  taux_ss_maladie_pat,
  taux_ss_vieil_plaf_pat,
  taux_ss_vieil_deplaf_pat,
  taux_alloc_fam_pat,
  taux_at_mp_pat,
  taux_ass_chomage_pat,
  taux_ret_compl_pat,
  source_url,
  date_mise_a_jour
) VALUES
-- Syntec (IDCC 1486) - Bureaux d'études techniques
(
  'IDCC1486',
  'Syntec - Bureaux d''études techniques, cabinets d''ingénieurs-conseils et sociétés de conseils',
  'services_conseil',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Hôtels, Cafés, Restaurants (IDCC 1090)
(
  'IDCC1090',
  'Hôtels, cafés, restaurants',
  'hotellerie_restauration',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- BTP (IDCC 1596)
(
  'IDCC1596',
  'Bâtiment et travaux publics',
  'btp_construction',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Commerce de détail (IDCC 2264)
(
  'IDCC2264',
  'Commerce de détail et de gros à prédominance alimentaire',
  'commerce_retail',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Métallurgie (IDCC 2120)
(
  'IDCC2120',
  'Métallurgie',
  'industrie_production',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Experts-comptables (IDCC 1501)
(
  'IDCC1501',
  'Experts-comptables et commissaires aux comptes',
  'finance_comptabilite',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Prestataires de services tertiaire (IDCC 1597)
(
  'IDCC1597',
  'Prestataires de services du secteur tertiaire',
  'services_conseil',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
),
-- Télécommunications (IDCC 1097)
(
  'IDCC1097',
  'Télécommunications',
  'transversal',
  2025,
  0.0075, 0.006, 0.004, 0.024, 0.0315, 0.0525, 0.029,
  0.07, 0.0855, 0.019, 0.0345, 0.015, 0.0405, 0.0472,
  'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635173',
  CURRENT_DATE
)
ON CONFLICT (code_idcc) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  secteur_activite = EXCLUDED.secteur_activite,
  annee = EXCLUDED.annee,
  taux_ss_maladie_sal = EXCLUDED.taux_ss_maladie_sal,
  taux_ss_vieil_plaf_sal = EXCLUDED.taux_ss_vieil_plaf_sal,
  taux_ss_vieil_deplaf_sal = EXCLUDED.taux_ss_vieil_deplaf_sal,
  taux_ass_chomage_sal = EXCLUDED.taux_ass_chomage_sal,
  taux_ret_compl_sal = EXCLUDED.taux_ret_compl_sal,
  taux_csg_ded_sal = EXCLUDED.taux_csg_ded_sal,
  taux_csg_non_ded_sal = EXCLUDED.taux_csg_non_ded_sal,
  taux_ss_maladie_pat = EXCLUDED.taux_ss_maladie_pat,
  taux_ss_vieil_plaf_pat = EXCLUDED.taux_ss_vieil_plaf_pat,
  taux_ss_vieil_deplaf_pat = EXCLUDED.taux_ss_vieil_deplaf_pat,
  taux_alloc_fam_pat = EXCLUDED.taux_alloc_fam_pat,
  taux_at_mp_pat = EXCLUDED.taux_at_mp_pat,
  taux_ass_chomage_pat = EXCLUDED.taux_ass_chomage_pat,
  taux_ret_compl_pat = EXCLUDED.taux_ret_compl_pat,
  source_url = EXCLUDED.source_url,
  date_mise_a_jour = EXCLUDED.date_mise_a_jour,
  updated_at = now();

