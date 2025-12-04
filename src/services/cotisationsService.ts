/**
 * Service pour récupérer les taux de cotisations sociales
 * depuis des sources officielles (URSSAF, conventions collectives)
 */

import { supabase } from '../lib/supabase';

export interface TauxCotisations {
  // Salariales
  taux_ss_maladie_sal: number;
  taux_ss_vieil_plaf_sal: number;
  taux_ss_vieil_deplaf_sal: number;
  taux_ass_chomage_sal: number;
  taux_ret_compl_sal: number;
  taux_csg_ded_sal: number;
  taux_csg_non_ded_sal: number;
  
  // Patronales
  taux_ss_maladie_pat: number;
  taux_ss_vieil_plaf_pat: number;
  taux_ss_vieil_deplaf_pat: number;
  taux_alloc_fam_pat: number;
  taux_at_mp_pat: number;
  taux_ass_chomage_pat: number;
  taux_ret_compl_pat: number;
}

export interface ConventionCollective {
  code_idcc: string;
  libelle: string;
  secteur_activite?: string;
  annee: number;
}

/**
 * Récupère les taux de cotisations pour un collaborateur
 * en fonction de sa convention collective, son poste, etc.
 */
export async function getTauxCotisations(
  entrepriseId: string,
  collaborateurId: string
): Promise<TauxCotisations> {
  try {
    const { data, error } = await supabase.rpc('get_taux_cotisations', {
      p_entreprise_id: entrepriseId,
      p_collaborateur_id: collaborateurId,
    });

    if (error) {
      console.error('❌ Erreur récupération taux:', error);
      // Retourner les taux par défaut en cas d'erreur
      return getTauxParDefaut();
    }

    if (data && data.length > 0) {
      return data[0] as TauxCotisations;
    }

    return getTauxParDefaut();
  } catch (error) {
    console.error('❌ Erreur récupération taux:', error);
    return getTauxParDefaut();
  }
}

/**
 * Taux par défaut (généraux URSSAF 2025)
 */
export function getTauxParDefaut(): TauxCotisations {
  return {
    // Salariales (en décimal, ex: 0.0075 = 0.75%)
    taux_ss_maladie_sal: 0.0075,
    taux_ss_vieil_plaf_sal: 0.006,
    taux_ss_vieil_deplaf_sal: 0.004,
    taux_ass_chomage_sal: 0.024,
    taux_ret_compl_sal: 0.0315,
    taux_csg_ded_sal: 0.0525,
    taux_csg_non_ded_sal: 0.029,
    
    // Patronales
    taux_ss_maladie_pat: 0.07,
    taux_ss_vieil_plaf_pat: 0.0855,
    taux_ss_vieil_deplaf_pat: 0.019,
    taux_alloc_fam_pat: 0.0345,
    taux_at_mp_pat: 0.015,
    taux_ass_chomage_pat: 0.0405,
    taux_ret_compl_pat: 0.0472,
  };
}

/**
 * Recherche une convention collective depuis le web
 * (utilise des APIs publiques ou scrappe des sites officiels)
 */
export async function rechercherConventionCollective(
  codeIdcc?: string,
  secteurActivite?: string
): Promise<ConventionCollective | null> {
  // TODO: Implémenter la recherche depuis le web
  // Pour l'instant, retourner null et utiliser les taux par défaut
  
  if (codeIdcc) {
    // Vérifier si la convention existe déjà en base
    const { data } = await supabase
      .from('conventions_collectives')
      .select('code_idcc, libelle, secteur_activite, annee')
      .eq('code_idcc', codeIdcc)
      .eq('est_actif', true)
      .order('annee', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      return data as ConventionCollective;
    }
  }
  
  return null;
}

/**
 * Met à jour les taux d'une convention collective depuis le web
 */
export async function mettreAJourTauxConvention(
  codeIdcc: string,
  annee: number = new Date().getFullYear()
): Promise<boolean> {
  try {
    // TODO: Implémenter la récupération depuis le web
    // Sources possibles :
    // - API URSSAF (si disponible)
    // - Service-public.fr
    // - Legifrance
    // - Sites spécialisés (juritravail.com, etc.)
    
    console.log(`🔄 Mise à jour des taux pour convention ${codeIdcc} année ${annee}`);
    
    // Pour l'instant, retourner false (pas encore implémenté)
    return false;
  } catch (error) {
    console.error('❌ Erreur mise à jour taux:', error);
    return false;
  }
}

/**
 * Liste des conventions collectives courantes
 */
export const CONVENTIONS_COURANTES: Array<{ code: string; libelle: string; secteur: string }> = [
  { code: 'IDCC1486', libelle: 'Syntec (Bureaux d\'études techniques)', secteur: 'services_conseil' },
  { code: 'IDCC1090', libelle: 'Hôtels, Cafés, Restaurants', secteur: 'hotellerie_restauration' },
  { code: 'IDCC1596', libelle: 'BTP', secteur: 'btp_construction' },
  { code: 'IDCC2264', libelle: 'Commerce de détail', secteur: 'commerce_retail' },
  { code: 'IDCC2120', libelle: 'Métallurgie', secteur: 'industrie_production' },
  { code: 'IDCC1501', libelle: 'Experts-comptables', secteur: 'finance_comptabilite' },
  { code: 'IDCC1597', libelle: 'Prestataires de services du secteur tertiaire', secteur: 'services_conseil' },
  { code: 'IDCC1097', libelle: 'Télécommunications', secteur: 'transversal' },
];

