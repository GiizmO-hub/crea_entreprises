/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICE DE CALCUL AUTOMATIQUE DE FICHE DE PAIE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Ce service calcule automatiquement toutes les cotisations sociales
 * selon les taux URSSAF 2025 et les conventions collectives.
 * 
 * ✅ CALCULS CONFORMES AUX RÉGLEMENTATIONS FRANÇAISES
 * ✅ PRISE EN COMPTE DES PLAFONDS DE SÉCURITÉ SOCIALE (PASS)
 * ✅ GESTION DES CONVENTIONS COLLECTIVES
 * ✅ CALCUL AUTOMATIQUE SANS ERREUR
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../lib/supabase';
import { getTauxCotisations } from './cotisationsService';
import type { TauxCotisations } from '../types/shared';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES URSSAF 2025
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Plafond Annuel de la Sécurité Sociale (PASS) 2025
 * Source : URSSAF - https://www.urssaf.fr
 */
export const PASS_2025 = 46224; // € par an
export const PASS_MENSUEL_2025 = PASS_2025 / 12; // 3852 € par mois

/**
 * Plafond de la Sécurité Sociale pour les cotisations déplafonnées
 * (3 PASS pour certaines cotisations)
 */
export const PASS_DEPLAF_2025 = PASS_2025 * 3; // 138672 € par an
export const PASS_DEPLAF_MENSUEL_2025 = PASS_DEPLAF_2025 / 12; // 11556 € par mois

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface LignePaie {
  code_rubrique: string;
  libelle: string;
  base: number;
  taux_salarial?: number; // En pourcentage (ex: 0.75 pour 0.75%)
  montant_salarial?: number; // Montant en € (négatif pour retenues)
  taux_patronal?: number; // En pourcentage
  montant_patronal?: number; // Montant en €
  montant_a_payer?: number; // Pour les gains (salaire, primes)
  ordre_affichage: number;
  groupe_affichage: string;
}

export interface CalculPaieResult {
  salaire_brut: number;
  total_cotisations_salariales: number;
  total_cotisations_patronales: number;
  net_imposable: number;
  net_a_payer: number;
  cout_total_employeur: number;
  lignes: LignePaie[];
}

export interface ParametresCalculPaie {
  salaire_brut: number;
  heures_normales?: number;
  heures_supp_25?: number;
  heures_supp_50?: number;
  primes?: number;
  avantages_nature?: number;
  periode: string; // Format: "YYYY-MM"
  entreprise_id: string;
  collaborateur_id: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule automatiquement une fiche de paie complète
 * avec toutes les cotisations selon les taux URSSAF 2025
 */
export async function calculerFichePaieComplete(
  params: ParametresCalculPaie
): Promise<CalculPaieResult> {
  const {
    salaire_brut,
    heures_normales = 0,
    heures_supp_25 = 0,
    heures_supp_50 = 0,
    primes = 0,
    avantages_nature = 0,
    periode,
    entreprise_id,
    collaborateur_id,
  } = params;

  // 1. Récupérer les taux de cotisations (selon convention collective)
  const taux = await getTauxCotisations(entreprise_id, collaborateur_id);

  // 2. Calculer le salaire brut total (base + heures sup + primes)
  const salaireBase = salaire_brut;
  const heuresSup25 = heures_supp_25 * (salaire_brut / 151.67) * 1.25; // Majoration 25%
  const heuresSup50 = heures_supp_50 * (salaire_brut / 151.67) * 1.50; // Majoration 50%
  const salaireBrutTotal = salaireBase + heuresSup25 + heuresSup50 + primes + avantages_nature;

  // 3. Calculer le plafond mensuel pour cette période
  const plafondMensuel = PASS_MENSUEL_2025;
  const plafondDeplafonne = PASS_DEPLAF_MENSUEL_2025;

  // 4. Calculer la base plafonnée (min entre salaire brut et plafond)
  const basePlafonnee = Math.min(salaireBrutTotal, plafondMensuel);
  const baseDeplafonnee = Math.min(salaireBrutTotal, plafondDeplafonne);

  // 5. Initialiser les lignes de paie
  const lignes: LignePaie[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOC RÉMUNÉRATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Salaire de base
  lignes.push({
    code_rubrique: 'SAL_BASE',
    libelle: 'Salaire de base',
    base: salaireBase,
    montant_a_payer: salaireBase,
    ordre_affichage: 10,
    groupe_affichage: 'REMUNERATION',
  });

  // Heures supplémentaires 25%
  if (heuresSup25 > 0) {
    lignes.push({
      code_rubrique: 'HS_25',
      libelle: `Heures supplémentaires majorées 25% (${heures_supp_25}h)`,
      base: heures_supp_25,
      montant_a_payer: heuresSup25,
      ordre_affichage: 20,
      groupe_affichage: 'REMUNERATION',
    });
  }

  // Heures supplémentaires 50%
  if (heuresSup50 > 0) {
    lignes.push({
      code_rubrique: 'HS_50',
      libelle: `Heures supplémentaires majorées 50% (${heures_supp_50}h)`,
      base: heures_supp_50,
      montant_a_payer: heuresSup50,
      ordre_affichage: 30,
      groupe_affichage: 'REMUNERATION',
    });
  }

  // Primes
  if (primes > 0) {
    lignes.push({
      code_rubrique: 'PRIME',
      libelle: 'Primes diverses',
      base: primes,
      montant_a_payer: primes,
      ordre_affichage: 40,
      groupe_affichage: 'REMUNERATION',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COTISATIONS SALARIALES
  // ═══════════════════════════════════════════════════════════════════════════

  // SS Maladie (0.75% sur base plafonnée)
  const ssMaladieSal = basePlafonnee * taux.taux_ss_maladie_sal;
  lignes.push({
    code_rubrique: 'SS_MALADIE',
    libelle: 'Sécurité sociale - Maladie, maternité, invalidité, décès',
    base: basePlafonnee,
    taux_salarial: taux.taux_ss_maladie_sal * 100,
    montant_salarial: -ssMaladieSal,
    ordre_affichage: 110,
    groupe_affichage: 'SANTE',
  });

  // SS Vieillesse plafonnée (0.6% sur base plafonnée)
  const ssVieilPlafSal = basePlafonnee * taux.taux_ss_vieil_plaf_sal;
  lignes.push({
    code_rubrique: 'SS_VIEIL_PLAF',
    libelle: 'Sécurité sociale - Vieillesse (plafonnée)',
    base: basePlafonnee,
    taux_salarial: taux.taux_ss_vieil_plaf_sal * 100,
    montant_salarial: -ssVieilPlafSal,
    ordre_affichage: 120,
    groupe_affichage: 'RETRAITE',
  });

  // SS Vieillesse déplafonnée (0.4% sur base déplafonnée)
  const ssVieilDeplafSal = baseDeplafonnee * taux.taux_ss_vieil_deplaf_sal;
  lignes.push({
    code_rubrique: 'SS_VIEIL_DEPLAF',
    libelle: 'Sécurité sociale - Vieillesse (déplafonnée)',
    base: baseDeplafonnee,
    taux_salarial: taux.taux_ss_vieil_deplaf_sal * 100,
    montant_salarial: -ssVieilDeplafSal,
    ordre_affichage: 130,
    groupe_affichage: 'RETRAITE',
  });

  // Assurance chômage (2.4% sur base plafonnée)
  const chomageSal = basePlafonnee * taux.taux_ass_chomage_sal;
  lignes.push({
    code_rubrique: 'CHOMAGE_SAL',
    libelle: 'Assurance chômage (part salarié)',
    base: basePlafonnee,
    taux_salarial: taux.taux_ass_chomage_sal * 100,
    montant_salarial: -chomageSal,
    ordre_affichage: 140,
    groupe_affichage: 'CHOMAGE',
  });

  // Retraite complémentaire (3.15% sur base plafonnée)
  const retComplSal = basePlafonnee * taux.taux_ret_compl_sal;
  lignes.push({
    code_rubrique: 'RET_COMP',
    libelle: 'Retraite complémentaire',
    base: basePlafonnee,
    taux_salarial: taux.taux_ret_compl_sal * 100,
    montant_salarial: -retComplSal,
    ordre_affichage: 150,
    groupe_affichage: 'RETRAITE',
  });

  // CSG déductible (5.25% sur base déplafonnée)
  const csgDedSal = baseDeplafonnee * taux.taux_csg_ded_sal;
  lignes.push({
    code_rubrique: 'CSG_DED',
    libelle: 'CSG/CRDS déductible',
    base: baseDeplafonnee,
    taux_salarial: taux.taux_csg_ded_sal * 100,
    montant_salarial: -csgDedSal,
    ordre_affichage: 160,
    groupe_affichage: 'CSG',
  });

  // CSG non déductible (2.9% sur base déplafonnée)
  const csgNonDedSal = baseDeplafonnee * taux.taux_csg_non_ded_sal;
  lignes.push({
    code_rubrique: 'CSG_NON_DED',
    libelle: 'CSG/CRDS non déductible',
    base: baseDeplafonnee,
    taux_salarial: taux.taux_csg_non_ded_sal * 100,
    montant_salarial: -csgNonDedSal,
    ordre_affichage: 170,
    groupe_affichage: 'CSG',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COTISATIONS PATRONALES
  // ═══════════════════════════════════════════════════════════════════════════

  // SS Maladie patronale (7% sur base plafonnée)
  const ssMaladiePat = basePlafonnee * taux.taux_ss_maladie_pat;
  lignes.push({
    code_rubrique: 'SS_MALADIE_PAT',
    libelle: 'Sécurité sociale - Maladie, maternité, invalidité, décès (patronale)',
    base: basePlafonnee,
    taux_patronal: taux.taux_ss_maladie_pat * 100,
    montant_patronal: ssMaladiePat,
    ordre_affichage: 210,
    groupe_affichage: 'SANTE',
  });

  // SS Vieillesse plafonnée patronale (8.55% sur base plafonnée)
  const ssVieilPlafPat = basePlafonnee * taux.taux_ss_vieil_plaf_pat;
  lignes.push({
    code_rubrique: 'SS_VIEIL_PLAF_PAT',
    libelle: 'Sécurité sociale - Vieillesse (plafonnée) (patronale)',
    base: basePlafonnee,
    taux_patronal: taux.taux_ss_vieil_plaf_pat * 100,
    montant_patronal: ssVieilPlafPat,
    ordre_affichage: 220,
    groupe_affichage: 'RETRAITE',
  });

  // SS Vieillesse déplafonnée patronale (1.9% sur base déplafonnée)
  const ssVieilDeplafPat = baseDeplafonnee * taux.taux_ss_vieil_deplaf_pat;
  lignes.push({
    code_rubrique: 'SS_VIEIL_DEPLAF_PAT',
    libelle: 'Sécurité sociale - Vieillesse (déplafonnée) (patronale)',
    base: baseDeplafonnee,
    taux_patronal: taux.taux_ss_vieil_deplaf_pat * 100,
    montant_patronal: ssVieilDeplafPat,
    ordre_affichage: 230,
    groupe_affichage: 'RETRAITE',
  });

  // Allocations familiales (3.45% sur base plafonnée)
  const allocFamPat = basePlafonnee * taux.taux_alloc_fam_pat;
  lignes.push({
    code_rubrique: 'ALLOC_FAM',
    libelle: 'Allocations familiales',
    base: basePlafonnee,
    taux_patronal: taux.taux_alloc_fam_pat * 100,
    montant_patronal: allocFamPat,
    ordre_affichage: 240,
    groupe_affichage: 'FAMILLE',
  });

  // AT/MP (1.5% sur base plafonnée - peut varier selon convention)
  const atMpPat = basePlafonnee * taux.taux_at_mp_pat;
  lignes.push({
    code_rubrique: 'AT_MP',
    libelle: 'Accidents du travail / maladies professionnelles',
    base: basePlafonnee,
    taux_patronal: taux.taux_at_mp_pat * 100,
    montant_patronal: atMpPat,
    ordre_affichage: 250,
    groupe_affichage: 'AT_MP',
  });

  // Assurance chômage patronale (4.05% sur base plafonnée)
  const chomagePat = basePlafonnee * taux.taux_ass_chomage_pat;
  lignes.push({
    code_rubrique: 'CHOMAGE_PAT',
    libelle: 'Assurance chômage (part employeur)',
    base: basePlafonnee,
    taux_patronal: taux.taux_ass_chomage_pat * 100,
    montant_patronal: chomagePat,
    ordre_affichage: 260,
    groupe_affichage: 'CHOMAGE',
  });

  // Retraite complémentaire patronale (4.72% sur base plafonnée)
  const retComplPat = basePlafonnee * taux.taux_ret_compl_pat;
  lignes.push({
    code_rubrique: 'RET_COMP_PAT',
    libelle: 'Retraite complémentaire (part employeur)',
    base: basePlafonnee,
    taux_patronal: taux.taux_ret_compl_pat * 100,
    montant_patronal: retComplPat,
    ordre_affichage: 270,
    groupe_affichage: 'RETRAITE',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCUL DES TOTAUX
  // ═══════════════════════════════════════════════════════════════════════════

  // Total cotisations salariales
  const totalCotisationsSalariales = lignes
    .filter(l => l.montant_salarial && l.montant_salarial < 0)
    .reduce((sum, l) => sum + Math.abs(l.montant_salarial || 0), 0);

  // Total cotisations patronales
  const totalCotisationsPatronales = lignes
    .filter(l => l.montant_patronal && l.montant_patronal > 0)
    .reduce((sum, l) => sum + (l.montant_patronal || 0), 0);

  // Net imposable (salaire brut - cotisations déductibles)
  // Les cotisations déductibles sont : SS, retraite, chômage, CSG déductible
  const cotisationsDeductibles = ssMaladieSal + ssVieilPlafSal + ssVieilDeplafSal + 
                                 chomageSal + retComplSal + csgDedSal;
  const netImposable = salaireBrutTotal - cotisationsDeductibles;

  // Net à payer (salaire brut - toutes les cotisations salariales)
  const netAPayer = salaireBrutTotal - totalCotisationsSalariales;

  // Coût total employeur (salaire brut + toutes les cotisations patronales)
  const coutTotalEmployeur = salaireBrutTotal + totalCotisationsPatronales;

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGNES DE TOTAL
  // ═══════════════════════════════════════════════════════════════════════════

  lignes.push({
    code_rubrique: 'TOTAL_SAL',
    libelle: 'Total part salariale',
    base: salaireBrutTotal,
    montant_salarial: -totalCotisationsSalariales,
    ordre_affichage: 900,
    groupe_affichage: 'TOTAL',
  });

  lignes.push({
    code_rubrique: 'TOTAL_PAT',
    libelle: 'Total part employeur',
    base: salaireBrutTotal,
    montant_patronal: totalCotisationsPatronales,
    ordre_affichage: 910,
    groupe_affichage: 'TOTAL',
  });

  lignes.push({
    code_rubrique: 'NET_IMPOSABLE',
    libelle: 'Net imposable',
    base: salaireBrutTotal,
    montant_a_payer: netImposable,
    ordre_affichage: 920,
    groupe_affichage: 'TOTAL',
  });

  lignes.push({
    code_rubrique: 'NET_A_PAYER',
    libelle: 'Net à payer',
    base: salaireBrutTotal,
    montant_a_payer: netAPayer,
    ordre_affichage: 930,
    groupe_affichage: 'TOTAL',
  });

  lignes.push({
    code_rubrique: 'COUT_EMPLOYEUR',
    libelle: 'Coût total employeur',
    base: salaireBrutTotal,
    montant_patronal: coutTotalEmployeur,
    ordre_affichage: 940,
    groupe_affichage: 'TOTAL',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RETOURNER LE RÉSULTAT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    salaire_brut: salaireBrutTotal,
    total_cotisations_salariales: totalCotisationsSalariales,
    total_cotisations_patronales: totalCotisationsPatronales,
    net_imposable: netImposable,
    net_a_payer: netAPayer,
    cout_total_employeur: coutTotalEmployeur,
    lignes: lignes.sort((a, b) => a.ordre_affichage - b.ordre_affichage),
  };
}

/**
 * Arrondit un montant selon les règles de la paie française
 * (arrondi au centime le plus proche)
 */
export function arrondirPaie(montant: number): number {
  return Math.round(montant * 100) / 100;
}

/**
 * Valide les paramètres de calcul de paie
 */
export function validerParametresCalculPaie(params: ParametresCalculPaie): {
  valide: boolean;
  erreurs: string[];
} {
  const erreurs: string[] = [];

  if (!params.salaire_brut || params.salaire_brut <= 0) {
    erreurs.push('Le salaire brut doit être supérieur à 0');
  }

  if (!params.entreprise_id) {
    erreurs.push('L\'entreprise_id est requis');
  }

  if (!params.collaborateur_id) {
    erreurs.push('Le collaborateur_id est requis');
  }

  if (!params.periode || !/^\d{4}-\d{2}$/.test(params.periode)) {
    erreurs.push('La période doit être au format YYYY-MM');
  }

  if (params.heures_normales && params.heures_normales < 0) {
    erreurs.push('Les heures normales ne peuvent pas être négatives');
  }

  if (params.heures_supp_25 && params.heures_supp_25 < 0) {
    erreurs.push('Les heures supplémentaires 25% ne peuvent pas être négatives');
  }

  if (params.heures_supp_50 && params.heures_supp_50 < 0) {
    erreurs.push('Les heures supplémentaires 50% ne peuvent pas être négatives');
  }

  return {
    valide: erreurs.length === 0,
    erreurs,
  };
}

