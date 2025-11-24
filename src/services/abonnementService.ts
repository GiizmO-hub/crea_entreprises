/**
 * Service centralisé pour la gestion des abonnements
 * 
 * Ce service regroupe toutes les opérations liées aux abonnements :
 * - Création d'abonnement
 * - Liaison avec les espaces clients
 * - Récupération des modules d'un abonnement
 */

import { supabase } from '../lib/supabase';

export interface Abonnement {
  id: string;
  entreprise_id: string;
  plan_id: string;
  statut: string;
  date_debut: string;
  date_fin?: string;
  montant_mensuel: number;
  mode_paiement: string;
}

export interface CreateAbonnementParams {
  client_id: string;
  plan_id: string;
  entreprise_id?: string;
  mode_paiement?: string;
  date_debut?: string;
  date_fin?: string;
  montant_mensuel?: number;
  options_ids?: string[];
  statut?: string;
}

export interface PlanModule {
  module_code: string;
  module_nom: string;
  module_description?: string;
  categorie: string;
  inclus: boolean;
  prix_mensuel: number;
  prix_annuel: number;
  est_cree: boolean;
  actif: boolean;
}

/**
 * Crée un abonnement complet pour un client
 */
export async function createAbonnement(params: CreateAbonnementParams): Promise<{
  success: boolean;
  data?: { abonnement_id: string; montant_mensuel: number };
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('create_abonnement_complete', {
      p_client_id: params.client_id,
      p_plan_id: params.plan_id,
      p_entreprise_id: params.entreprise_id || null,
      p_mode_paiement: params.mode_paiement || 'mensuel',
      p_date_debut: params.date_debut || null,
      p_date_fin: params.date_fin || null,
      p_montant_mensuel: params.montant_mensuel || null,
      p_options_ids: params.options_ids || [],
      p_statut: params.statut || 'actif',
    });

    if (error) {
      console.error('Erreur création abonnement:', error);
      return { success: false, error: error.message };
    }

    if (data?.success) {
      return {
        success: true,
        data: {
          abonnement_id: data.abonnement_id,
          montant_mensuel: data.montant_mensuel,
        },
      };
    }

    return { success: false, error: data?.error || 'Erreur inconnue' };
  } catch (error: unknown) {
    console.error('Erreur création abonnement:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, error: errorMessage };
  }
}

/**
 * Lie un abonnement à un espace client
 */
export async function linkAbonnementToClientSpace(
  abonnementId: string,
  espaceId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('espaces_membres_clients')
      .update({ abonnement_id: abonnementId })
      .eq('id', espaceId);

    if (error) {
      console.error('Erreur liaison abonnement/espace:', error);
      return false;
    }

    // Déclencher la synchronisation des modules
    const { error: syncError } = await supabase.rpc('sync_client_modules_from_plan', {
      p_espace_id: espaceId,
    });

    if (syncError) {
      console.error('Erreur synchronisation modules après liaison:', syncError);
      // Ne pas échouer la liaison si la sync échoue
    }

    return true;
  } catch (error) {
    console.error('Erreur liaison abonnement/espace:', error);
    return false;
  }
}

/**
 * Récupère les modules d'un plan d'abonnement
 */
export async function getPlanModules(planId: string): Promise<PlanModule[]> {
  try {
    const { data, error } = await supabase.rpc('get_plan_modules', {
      p_plan_id: planId,
    });

    if (error) {
      console.error('Erreur récupération modules du plan:', error);
      return [];
    }

    // Normaliser les valeurs boolean
    return (data || []).map((mod: {
      module_code?: string;
      module_nom?: string;
      module_description?: string;
      categorie?: string;
      actif?: boolean;
    }) => ({
      module_code: mod.module_code || '',
      module_nom: mod.module_nom || '',
      module_description: mod.module_description || '',
      categorie: mod.categorie || '',
      inclus: mod.inclus === true || mod.inclus === 'true' || String(mod.inclus).toLowerCase() === 'true',
      prix_mensuel: parseFloat(String(mod.prix_mensuel || 0)),
      prix_annuel: parseFloat(String(mod.prix_annuel || 0)),
      est_cree: mod.est_cree === true || mod.est_cree === 'true' || String(mod.est_cree).toLowerCase() === 'true',
      actif: mod.actif === true || mod.actif === 'true' || String(mod.actif).toLowerCase() === 'true',
    }));
  } catch (error) {
    console.error('Erreur récupération modules du plan:', error);
    return [];
  }
}

/**
 * Récupère les modules actifs d'un abonnement (modules inclus dans le plan)
 */
export async function getAbonnementModules(abonnementId: string): Promise<PlanModule[]> {
  try {
    // Récupérer l'abonnement pour obtenir le plan_id
    const { data: abonnement, error: abonnementError } = await supabase
      .from('abonnements')
      .select('plan_id')
      .eq('id', abonnementId)
      .single();

    if (abonnementError || !abonnement) {
      console.error('Erreur récupération abonnement:', abonnementError);
      return [];
    }

    // Récupérer les modules du plan (seulement ceux inclus)
    const allModules = await getPlanModules(abonnement.plan_id);
    return allModules.filter((mod) => mod.inclus && mod.est_cree && mod.actif);
  } catch (error) {
    console.error('Erreur récupération modules abonnement:', error);
    return [];
  }
}

