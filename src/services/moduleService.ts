/**
 * Service centralisé pour la gestion des modules
 * 
 * Ce service regroupe toutes les opérations liées aux modules :
 * - Mapping codes de modules → IDs de menu
 * - Normalisation des codes de modules
 * - Filtrage des modules selon les permissions
 */

/**
 * Mapping complet entre codes de modules (depuis modules_activation) et IDs du menu
 * Les codes peuvent utiliser des tirets, underscores, ou autres formats
 */
export const moduleCodeToMenuId: Record<string, string> = {
  // Modules de base
  'dashboard': 'dashboard',
  'tableau_de_bord': 'dashboard',
  'tableau-de-bord': 'dashboard',
  'mon_entreprise': 'entreprises',
  'mon-entreprise': 'entreprises',
  'entreprises': 'entreprises',
  
  // Modules clients
  'clients': 'clients',
  'gestion_clients': 'clients',
  'gestion-clients': 'clients',
  'gestion-des-clients': 'clients',
  'gestion_des_clients': 'clients',
  
  // Modules facturation
  'facturation': 'factures',
  'factures': 'factures',
  
  // Modules documents
  'documents': 'documents',
  'gestion_documents': 'documents',
  'gestion-documents': 'documents',
  'gestion-de-documents': 'documents',
  'gestion_de_documents': 'documents',
  
  // Modules gestion équipe
  'gestion-equipe': 'gestion-equipe',
  'gestion_equipe': 'gestion-equipe',
  'gestion-d-equipe': 'gestion-equipe',
  'gestion-d-équipe': 'gestion-equipe',
  'gestion_dequipe': 'gestion-equipe',
  'gestion_d_equipe': 'gestion-equipe',
  
  // Modules gestion projets
  'gestion-projets': 'gestion-projets',
  'gestion_projets': 'gestion-projets',
  'gestion-de-projets': 'gestion-projets',
  'gestion_de_projets': 'gestion-projets',
  
  // Modules comptabilité
  'comptabilite': 'comptabilite',
  'comptabilité': 'comptabilite',
  
  // Modules finance
  'finance': 'finance',
  'finances': 'finance',
  
  // Modules collaborateurs
  'collaborateurs': 'collaborateurs',
  'gestion-collaborateurs': 'collaborateurs',
  'gestion_des_collaborateurs': 'collaborateurs',
  'gestion-des-collaborateurs': 'collaborateurs',
  
  // Modules paramètres
  'parametres': 'settings',
  'paramètres': 'settings',
  'settings': 'settings',
};

/**
 * Normalise un code de module (tirets, underscores, espaces)
 */
export function normalizeModuleCode(code: string): string {
  if (!code) return '';
  
  // Normaliser en remplaçant underscores et espaces par tirets
  const normalized = code
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
  
  return normalized;
}

/**
 * Mappe un code de module vers un ID de menu
 */
export function mapModuleCodeToMenuId(moduleCode: string): string | null {
  if (!moduleCode) return null;
  
  // Essayer le mapping exact
  let menuId = moduleCodeToMenuId[moduleCode];
  
  // Si pas trouvé, essayer avec normalisation
  if (!menuId) {
    const normalizedCode1 = moduleCode.replace(/_/g, '-');
    const normalizedCode2 = moduleCode.replace(/-/g, '_');
    menuId = moduleCodeToMenuId[normalizedCode1] || moduleCodeToMenuId[normalizedCode2];
  }
  
  // Si toujours pas trouvé, essayer avec la fonction de normalisation
  if (!menuId) {
    const normalized = normalizeModuleCode(moduleCode);
    menuId = moduleCodeToMenuId[normalized];
  }
  
  return menuId || null;
}

/**
 * Filtre les modules actifs pour ne garder que ceux mappés et non admin
 */
type ModuleValue = boolean | string | number;

export function filterActiveModules(
  modulesActifs: Record<string, ModuleValue>,
  menuItems: Array<{ id: string; superAdminOnly?: boolean }>
): string[] {
  const activeMenuIds = new Set<string>();
  
  // Parcourir tous les modules actifs
  Object.keys(modulesActifs).forEach((moduleCode) => {
    const moduleValue: ModuleValue = modulesActifs[moduleCode];
    
    // Vérifier si le module est actif (gérer tous les types possibles)
    let isActive = false;
    if (typeof moduleValue === 'boolean') {
      isActive = moduleValue === true;
    } else if (typeof moduleValue === 'string') {
      isActive = moduleValue === 'true' || moduleValue === '1' || moduleValue.toLowerCase() === 'true';
    } else if (typeof moduleValue === 'number') {
      isActive = moduleValue === 1;
    }
    
    if (isActive) {
      // Mapper le code vers un ID de menu
      const menuId = mapModuleCodeToMenuId(moduleCode);
      
      if (menuId) {
        // Vérifier que le module n'est pas admin-only
        const menuItem = menuItems.find(item => item.id === menuId);
        const isAdminModule = menuItem?.superAdminOnly === true;
        
        if (!isAdminModule) {
          activeMenuIds.add(menuId);
        }
      }
    }
  });
  
  // Toujours ajouter les modules de base
  activeMenuIds.add('dashboard');
  activeMenuIds.add('entreprises');
  activeMenuIds.add('settings');
  
  return Array.from(activeMenuIds);
}

/**
 * Extrait les modules actifs depuis le JSON de modules_actifs
 */
export function extractActiveModules(modulesActifs: Record<string, ModuleValue>): Set<string> {
  const active = new Set<string>();
  
  Object.keys(modulesActifs).forEach((moduleCode) => {
    const moduleValue = modulesActifs[moduleCode];
    const isActive = moduleValue === true || 
                    moduleValue === 'true' || 
                    moduleValue === 1 || 
                    moduleValue === '1' ||
                    (typeof moduleValue === 'string' && moduleValue.toLowerCase() === 'true');
    
    if (isActive) {
      active.add(moduleCode);
    }
  });
  
  return active;
}

