/**
 * Hook personnalisé pour gérer les modules actifs d'un client
 * 
 * Ce hook :
 * - Charge les modules actifs depuis l'espace client
 * - Gère le mapping codes → menu IDs
 * - Filtre les modules admin
 * - Retourne les modules actifs prêts à être affichés
 */

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { filterActiveModules, mapModuleCodeToMenuId } from '../services/moduleService';

export interface MenuItem {
  id: string;
  label: string;
  superAdminOnly?: boolean;
  moduleCode?: string;
}

interface UseClientModulesOptions {
  menuItems: MenuItem[];
  isSuperAdmin?: boolean;
  isClientSuperAdmin?: boolean;
}

export function useClientModules({ menuItems, isSuperAdmin = false, isClientSuperAdmin = false }: UseClientModulesOptions) {
  const { user } = useAuth();
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set(['dashboard', 'entreprises', 'settings']));
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // ✅ Déclarer la fonction AVANT de l'utiliser dans useEffect
  const loadActiveModules = async () => {
    try {
      setLoading(true);

      if (!user) {
        setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
        setLoading(false);
        return;
      }

      // ✅ Vérifier d'abord si c'est un client (a un espace membre)
      const { data: espaceClientCheck } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // ✅ Si c'est un client, charger uniquement les modules de son abonnement
      if (espaceClientCheck) {
        setIsClient(true);
        
        const { data: espaceClient, error: espaceError } = await supabase
          .from('espaces_membres_clients')
          .select('modules_actifs, client_id, entreprise_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (espaceError || !espaceClient) {
          console.warn('⚠️ Erreur chargement espace client, modules de base uniquement');
          setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
          setLoading(false);
          return;
        }

        console.log('✅ Espace client trouvé:', {
          client_id: espaceClient.client_id,
          entreprise_id: espaceClient.entreprise_id,
          modules_actifs: espaceClient.modules_actifs,
        });

        // Extraire et mapper les modules actifs
        let modulesActifs = espaceClient.modules_actifs || {};
        
        // Si modules_actifs est vide ou n'a que les modules de base, tenter une synchronisation
        const moduleKeys = Object.keys(modulesActifs);
        const hasOnlyBaseModules = moduleKeys.length <= 3 && 
          (moduleKeys.includes('dashboard') || moduleKeys.includes('tableau_de_bord') || 
           moduleKeys.includes('tableau-de-bord')) &&
          (moduleKeys.includes('entreprises') || moduleKeys.includes('mon_entreprise') || 
           moduleKeys.includes('mon-entreprise')) &&
          (moduleKeys.includes('settings') || moduleKeys.includes('parametres') || 
           moduleKeys.includes('paramètres'));
        
        if (hasOnlyBaseModules || moduleKeys.length === 0) {
          console.warn('⚠️ Modules limités détectés, tentative de synchronisation automatique...');
          try {
            const { data: syncResult, error: syncError } = await supabase.rpc(
              'sync_client_modules_from_subscription',
              { p_client_user_id: user.id }
            );
            
            if (!syncError && syncResult?.success) {
              console.log('✅ Synchronisation réussie, rechargement des modules...');
              // Recharger les modules après synchronisation
              const { data: updatedEspace } = await supabase
                .from('espaces_membres_clients')
                .select('modules_actifs')
                .eq('user_id', user.id)
                .maybeSingle();
              
              if (updatedEspace?.modules_actifs) {
                modulesActifs = updatedEspace.modules_actifs;
                console.log('📦 Modules après synchronisation:', JSON.stringify(modulesActifs, null, 2));
              }
            } else {
              console.warn('⚠️ Synchronisation échouée:', syncError || syncResult?.error);
            }
          } catch (syncErr) {
            console.error('❌ Erreur lors de la synchronisation:', syncErr);
          }
        }
        
        console.log('📦 Modules actifs depuis la base:', JSON.stringify(modulesActifs, null, 2));
        
        // Debug : Vérifier le mapping de chaque module
        Object.keys(modulesActifs).forEach((code) => {
          const menuId = mapModuleCodeToMenuId(code);
          const isActive = modulesActifs[code] === true || 
                          modulesActifs[code] === 'true' || 
                          String(modulesActifs[code]).toLowerCase() === 'true';
          console.log(`   🔍 Module: ${code} (actif: ${isActive}) → ${menuId || '❌ NON MAPPÉ'}`);
        });
        
        // Filtrer et mapper les modules
        const filteredModules = filterActiveModules(modulesActifs, menuItems);
        
        console.log(`✅ Modules actifs finaux pour le client: ${filteredModules.join(', ')}`);
        
        // Toujours s'assurer que les modules de base sont présents
        if (filteredModules.length === 0 || filteredModules.length <= 3) {
          console.warn('⚠️ Peu de modules trouvés, utilisation des modules de base par défaut');
          setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
        } else {
          setActiveModules(new Set(filteredModules));
        }
        
        setLoading(false);
        return;
      }
      
      // ✅ Si ce n'est pas un client, vérifier si c'est un super admin plateforme
      setIsClient(false);
      
      if (isSuperAdmin && !isClientSuperAdmin) {
        // Super admin plateforme voit TOUS les modules (sans filtre)
        console.log('👑 Super Admin PLATEFORME détecté - Chargement de TOUS les modules');
        const allModules = menuItems.map(item => item.id);
        console.log(`✅ Modules chargés pour Super Admin PLATEFORME: ${allModules.join(', ')}`);
        setActiveModules(new Set(allModules));
        setLoading(false);
        return;
      }
      
      // Par défaut, modules de base
      setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement modules actifs:', error);
      // En cas d'erreur, afficher les modules de base
      setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
      setLoading(false);
    }
  };

  // ✅ useEffect pour charger les modules
  useEffect(() => {
    if (!user) {
      setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
      setLoading(false);
      return;
    }

    loadActiveModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSuperAdmin, isClientSuperAdmin]); // loadActiveModules est stable, pas besoin de l'inclure

  return {
    activeModules,
    loading,
    isClient,
    reload: loadActiveModules,
  };
}

