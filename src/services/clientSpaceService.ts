/**
 * Service centralisé pour la gestion des espaces clients
 * 
 * Ce service regroupe toutes les opérations liées aux espaces membres clients :
 * - Création d'espace membre
 * - Récupération d'informations
 * - Gestion des modules actifs
 * - Synchronisation
 */

import { supabase } from '../lib/supabase';

export interface ClientSpace {
  id: string;
  client_id: string;
  entreprise_id: string;
  user_id?: string;
  abonnement_id?: string;
  actif: boolean;
  modules_actifs: Record<string, boolean>;
  preferences?: Record<string, any>;
  email?: string;
  statut_compte?: string;
}

export interface CreateClientSpaceParams {
  client_id: string;
  entreprise_id: string;
  password?: string;
  plan_id?: string;
  options_ids?: string[];
}

export interface ClientSpaceCredentials {
  email: string;
  password: string;
}

/**
 * Crée un espace membre pour un client
 */
export async function createClientSpace(params: CreateClientSpaceParams): Promise<{
  success: boolean;
  data?: ClientSpaceCredentials;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('create_espace_membre_from_client', {
      p_client_id: params.client_id,
      p_entreprise_id: params.entreprise_id,
      p_password: params.password || null,
      p_plan_id: params.plan_id || null,
      p_options_ids: params.options_ids || [],
    });

    if (error) {
      console.error('Erreur création espace membre:', error);
      return { success: false, error: error.message };
    }

    if (data?.success) {
      return {
        success: true,
        data: {
          email: data.email,
          password: data.password,
        },
      };
    }

    return { success: false, error: data?.error || 'Erreur inconnue' };
  } catch (error: any) {
    console.error('Erreur création espace membre:', error);
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}

/**
 * Récupère l'espace membre d'un client
 */
export async function getClientSpace(clientId: string): Promise<ClientSpace | null> {
  try {
    const { data, error } = await supabase
      .from('espaces_membres_clients')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      console.error('Erreur récupération espace client:', error);
      return null;
    }

    return data as ClientSpace | null;
  } catch (error) {
    console.error('Erreur récupération espace client:', error);
    return null;
  }
}

/**
 * Met à jour un espace membre client
 */
export async function updateClientSpace(
  spaceId: string,
  updates: Partial<ClientSpace>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('espaces_membres_clients')
      .update(updates)
      .eq('id', spaceId);

    if (error) {
      console.error('Erreur mise à jour espace client:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur mise à jour espace client:', error);
    return false;
  }
}

/**
 * Synchronise les modules d'un espace client depuis son plan
 */
export async function syncClientModules(spaceId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('sync_client_modules_from_plan', {
      p_espace_id: spaceId,
    });

    if (error) {
      console.error('Erreur synchronisation modules:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur synchronisation modules:', error);
    return false;
  }
}

/**
 * Récupère les modules actifs d'un client
 */
export async function getClientActiveModules(clientId: string): Promise<Record<string, boolean>> {
  try {
    const space = await getClientSpace(clientId);
    return space?.modules_actifs || {};
  } catch (error) {
    console.error('Erreur récupération modules actifs:', error);
    return {};
  }
}

