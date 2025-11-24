/**
 * Système de Réutilisation de Modules
 * 
 * Ce fichier permet aux nouveaux modules de réutiliser les fonctionnalités
 * des modules existants (facturation, documents, équipes, etc.) au lieu de les recréer.
 */

import { supabase } from './supabase';

export interface ModuleDependency {
  module_depend_de: string;
  module_nom: string;
  type_dependance: 'requis' | 'optionnel' | 'reutilise';
  description: string;
  actif: boolean;
  est_cree: boolean;
  configuration: Record<string, unknown>;
}

export interface ReusableModuleFeature {
  module: string;
  feature: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

/**
 * Récupère les dépendances d'un module (quels modules il réutilise)
 */
export async function getModuleDependencies(moduleCode: string): Promise<ModuleDependency[]> {
  try {
    const { data, error } = await supabase.rpc('get_module_dependencies', {
      p_module_code: moduleCode
    });

    if (error) {
      console.error(`Erreur récupération dépendances pour ${moduleCode}:`, error);
      return [];
    }

    return (data || []) as ModuleDependency[];
  } catch (error) {
    console.error(`Erreur récupération dépendances pour ${moduleCode}:`, error);
    return [];
  }
}

/**
 * Vérifie si un module peut être activé (vérifie les dépendances requises)
 */
export async function canActivateModule(moduleCode: string): Promise<{
  can_activate: boolean;
  message: string;
  missing?: string[];
  inactive?: string[];
}> {
  try {
    const { data, error } = await supabase.rpc('can_activate_module', {
      p_module_code: moduleCode
    });

    if (error) {
      console.error(`Erreur vérification activation pour ${moduleCode}:`, error);
      return {
        can_activate: false,
        message: 'Erreur lors de la vérification des dépendances'
      };
    }

    return (data || { can_activate: false, message: 'Erreur inconnue' }) as any;
  } catch (error) {
    console.error(`Erreur vérification activation pour ${moduleCode}:`, error);
    return {
      can_activate: false,
      message: 'Erreur lors de la vérification des dépendances'
    };
  }
}

/**
 * Récupère les modules réutilisables activés pour un module donné
 */
export async function getReusableModules(moduleCode: string): Promise<ReusableModuleFeature[]> {
  const dependencies = await getModuleDependencies(moduleCode);
  
  return dependencies
    .filter(dep => dep.type_dependance === 'reutilise' && dep.actif && dep.est_cree)
    .map(dep => ({
      module: dep.module_depend_de,
      feature: dep.description,
      enabled: true,
      config: dep.configuration
    }));
}

/**
 * Vérifie si un module spécifique peut être réutilisé
 */
export async function canReuseModule(moduleCode: string, moduleToReuse: string): Promise<boolean> {
  const dependencies = await getModuleDependencies(moduleCode);
  
  const dependency = dependencies.find(dep => dep.module_depend_de === moduleToReuse);
  
  if (!dependency) {
    return false; // Aucune dépendance définie
  }

  // Vérifier que le module à réutiliser est actif et créé
  return dependency.actif && dependency.est_cree;
}

/**
 * Navigation vers un module réutilisable
 */
export function navigateToReusableModule(moduleCode: string, onNavigate: (page: string) => void) {
  const moduleRoutes: Record<string, string> = {
    'clients': 'clients',
    'facturation': 'factures',
    'documents': 'documents',
    'collaborateurs': 'collaborateurs',
    'gestion-equipe': 'gestion-equipe',
  };

  const route = moduleRoutes[moduleCode];
  if (route) {
    onNavigate(route);
  }
}

/**
 * Obtient le libellé d'un module pour l'affichage
 */
export function getModuleLabel(moduleCode: string): string {
  const labels: Record<string, string> = {
    'clients': 'Gestion des Clients',
    'facturation': 'Facturation',
    'documents': 'Gestion de Documents',
    'collaborateurs': 'Gestion des Collaborateurs',
    'gestion-equipe': 'Gestion d\'Équipe',
  };

  return labels[moduleCode] || moduleCode;
}

/**
 * Obtient l'icône d'un module
 */
export function getModuleIcon(moduleCode: string): string {
  const icons: Record<string, string> = {
    'clients': 'Users',
    'facturation': 'FileText',
    'documents': 'FolderOpen',
    'collaborateurs': 'Users',
    'gestion-equipe': 'Shield',
  };

  return icons[moduleCode] || 'Package';
}

