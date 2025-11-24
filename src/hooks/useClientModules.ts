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
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { filterActiveModules } from '../services/moduleService';

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

      // ✅ Vérifier d'abord si c'est un client (a un espace membre)
      const { data: espaceClientCheck } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      // ✅ Si c'est un client, charger uniquement les modules de son abonnement
      if (espaceClientCheck) {
        setIsClient(true);
        
        const { data: espaceClient, error: espaceError } = await supabase
          .from('espaces_membres_clients')
          .select('modules_actifs, client_id, entreprise_id')
          .eq('user_id', user!.id)
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
        const modulesActifs = espaceClient.modules_actifs || {};
        console.log('📦 Modules actifs depuis la base:', JSON.stringify(modulesActifs, null, 2));
        
        // Filtrer et mapper les modules
        const filteredModules = filterActiveModules(modulesActifs, menuItems);
        
        console.log(`✅ Modules actifs finaux pour le client: ${filteredModules.join(', ')}`);
        
        // Toujours s'assurer que les modules de base sont présents
        if (filteredModules.length === 0) {
          console.warn('⚠️ Aucun module trouvé, utilisation des modules de base par défaut');
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
        // Super admin plateforme voit tout
        const allModules = menuItems
          .filter(item => !item.superAdminOnly || item.id === 'gestion-plans' || item.id === 'modules')
          .map(item => item.id);
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

