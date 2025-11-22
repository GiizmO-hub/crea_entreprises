import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, CheckCircle, Lock, Unlock, Settings, Info, ToggleLeft, ToggleRight } from 'lucide-react';

interface ModulesProps {
  onNavigate: (page: string) => void;
}

interface Module {
  id: string;
  code: string;
  nom: string;
  description: string;
  icone?: string;
  categorie: 'core' | 'premium' | 'option' | 'admin';
  disponible: boolean;
  active: boolean;
  source?: 'plan' | 'option' | 'super_admin';
  plan_nom?: string;
  option_nom?: string;
}


export default function Modules({ onNavigate }: ModulesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('modules');
  const [modulesTab, setModulesTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Mapping des modules vers les routes (uniquement les modules créés)
  const moduleRoutes: Record<string, string> = {
    'dashboard': 'dashboard',
    'clients': 'clients',
    'factures': 'factures',
    'collaborateurs': 'collaborateurs',
  };

  const handleModuleClick = (module: Module) => {
    if (!module.active && !isSuperAdmin) return;
    
    const route = moduleRoutes[module.id];
    if (route) {
      onNavigate(route);
    }
  };

  // Obtenir les modules actifs pour les onglets (uniquement pour super admin)
  // Les clients n'ont pas besoin de cette liste car ils ne voient que les modules actifs
  const activeModules = isSuperAdmin ? modules.filter((m) => m.active) : [];

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadModules();
    }
  }, [user, isSuperAdmin]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      const { data: utilisateur, error } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        setIsSuperAdmin(isAdmin);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      setIsSuperAdmin(isAdmin);
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadModules = async () => {
    try {
      setLoading(true);

      // Liste des modules disponibles - UNIQUEMENT les modules réellement créés
      const allModules: Omit<Module, 'disponible' | 'active' | 'source' | 'plan_nom' | 'option_nom'>[] = [
        // Modules Core
        { id: 'dashboard', code: 'dashboard', nom: 'Tableau de bord', description: 'Vue d\'ensemble de votre activité', categorie: 'core' },
        { id: 'clients', code: 'clients', nom: 'Gestion des clients', description: 'Gérer vos clients et leurs informations', categorie: 'core' },
        { id: 'factures', code: 'facturation', nom: 'Facturation', description: 'Créer et gérer vos factures', categorie: 'core' },
        
        // Modules Admin
        { id: 'collaborateurs', code: 'collaborateurs', nom: 'Gestion des collaborateurs', description: 'Gérer les collaborateurs et administrateurs', categorie: 'admin' },
      ];

      // Charger le statut des modules depuis la table modules_activation
      let modulesStatusMap = new Map();
      
      try {
        const { data: modulesStatus, error: modulesError } = await supabase.rpc('get_all_modules_status');

        if (modulesError) {
          console.error('Erreur chargement statut modules:', modulesError);
          // Si la fonction n'existe pas encore (migration non appliquée), utiliser un Map vide
        } else if (modulesStatus && Array.isArray(modulesStatus)) {
          modulesStatus.forEach((mod: any) => {
            modulesStatusMap.set(mod.code, mod);
          });
        }
      } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
        // En cas d'erreur, continuer avec un Map vide (tous les modules seront inactifs)
      }

      // Déterminer la disponibilité de chaque module
      const modulesWithStatus: Module[] = allModules.map((module) => {
        let disponible = isSuperAdmin; // Super admin voit tout, clients seulement les modules actifs
        let active = false;
        let source: 'plan' | 'option' | 'super_admin' | undefined = 'super_admin';
        
        // Vérifier le statut dans modules_activation
        const moduleStatus = modulesStatusMap.get(module.code);
        if (moduleStatus) {
          active = moduleStatus.actif === true;
        } else {
          // Si le module n'existe pas encore dans la table, il est inactif par défaut
          active = false;
        }

        // Pour les clients, ils ne voient que les modules actifs
        if (!isSuperAdmin) {
          disponible = active;
        }

        return {
          ...module,
          disponible,
          active,
          source,
        };
      });

      setModules(modulesWithStatus);
    } catch (error) {
      console.error('Erreur chargement modules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Séparer les modules actifs et inactifs
  const modulesActifs = modules.filter((m) => m.active);
  const modulesInactifs = modules.filter((m) => !m.active && m.disponible);

  // Fonction pour activer/désactiver un module
  const handleToggleModule = async (module: Module, activer: boolean) => {
    // Vérifier les permissions : seuls les super admins peuvent activer/désactiver les modules
    if (!isSuperAdmin) {
      alert('❌ Vous n\'avez pas les droits pour activer/désactiver des modules.\nSeul l\'administrateur peut gérer les modules.');
      return;
    }

    try {
      // D'abord, créer ou mettre à jour le module dans modules_activation avec ses informations complètes
      // On utilise INSERT ... ON CONFLICT pour créer ou mettre à jour
      const { error: insertError } = await supabase
        .from('modules_activation')
        .upsert({
          module_code: module.code,
          module_nom: module.nom,
          module_description: module.description,
          categorie: module.categorie,
          actif: activer,
        }, {
          onConflict: 'module_code'
        });

      if (insertError) {
        console.error('Erreur upsert module:', insertError);
        throw insertError;
      }

      console.log('Module activé/désactivé:', { code: module.code, nom: module.nom, activer });

      // Recharger les modules après un court délai
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadModules();
      
      alert(activer ? '✅ Module activé avec succès!' : '✅ Module désactivé avec succès!');
    } catch (error: any) {
      console.error('Erreur toggle module:', error);
      alert('❌ Erreur lors de la modification: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const categories = [
    { id: 'all', label: 'Tous les modules' },
    { id: 'core', label: 'Modules de base' },
    { id: 'premium', label: 'Modules premium' },
    { id: 'option', label: 'Options supplémentaires' },
    { id: 'admin', label: 'Modules admin' },
  ];

  // Filtrer selon l'onglet actif (all/active/inactive) et la catégorie
  let filteredModules = modules;
  
  // Filtrer par statut (actif/inactif)
  if (modulesTab === 'active') {
    filteredModules = filteredModules.filter((m) => m.active);
  } else if (modulesTab === 'inactive') {
    filteredModules = filteredModules.filter((m) => !m.active && m.disponible);
  }
  
  // Filtrer par catégorie
  if (selectedCategory !== 'all') {
    filteredModules = filteredModules.filter((m) => m.categorie === selectedCategory);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Chargement des modules...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Modules</h1>
        <p className="text-gray-300">
          {isSuperAdmin
            ? 'Gérez l\'activation et la désactivation des modules'
            : 'Modules disponibles selon votre configuration'}
        </p>
      </div>

      {/* Onglets pour modules actifs */}
      {activeModules.length > 0 && (
        <div className="mb-6 bg-white/10 backdrop-blur-lg rounded-xl p-2 border border-white/20">
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('modules')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'modules'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              Tous les modules
            </button>
            {activeModules.map((module) => {
              const route = moduleRoutes[module.id];
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setActiveTab(module.id);
                    if (route) {
                      onNavigate(route);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                    activeTab === module.id
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {module.nom}
                  {module.categorie === 'admin' && isSuperAdmin && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Admin</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Onglets Modules Actifs/Inactifs - Uniquement pour super admin */}
      {isSuperAdmin && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setModulesTab('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              modulesTab === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Tous les modules
          </button>
          <button
            onClick={() => setModulesTab('active')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              modulesTab === 'active'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Actifs ({modulesActifs.length})
          </button>
          <button
            onClick={() => setModulesTab('inactive')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              modulesTab === 'inactive'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Lock className="w-4 h-4" />
            Désactivés ({modulesInactifs.length})
          </button>
        </div>
      )}

      {/* Filtres par catégorie - Uniquement pour super admin */}
      {isSuperAdmin && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Liste des modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module) => (
          <div
            key={module.id}
            onClick={() => handleModuleClick(module)}
            className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border transition-all cursor-pointer ${
              module.active
                ? 'border-green-500/50 hover:border-green-500 hover:scale-105'
                : module.disponible
                ? 'border-blue-500/50 hover:border-blue-500 hover:scale-105'
                : 'border-gray-500/50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${
                  module.active
                    ? 'bg-green-500/20'
                    : module.disponible
                    ? 'bg-blue-500/20'
                    : 'bg-gray-500/20'
                }`}>
                  <Package className={`w-6 h-6 ${
                    module.active ? 'text-green-400' : module.disponible ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{module.nom}</h3>
                  <p className="text-sm text-gray-400 mt-1">{module.description}</p>
                </div>
              </div>
              <div>
                {module.active ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : module.disponible ? (
                  <Unlock className="w-6 h-6 text-blue-400" />
                ) : (
                  <Lock className="w-6 h-6 text-gray-400" />
                )}
              </div>
            </div>

            {/* Badge catégorie */}
            <div className="mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                module.categorie === 'core'
                  ? 'bg-blue-500/20 text-blue-300'
                  : module.categorie === 'premium'
                  ? 'bg-purple-500/20 text-purple-300'
                  : module.categorie === 'option'
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'bg-red-500/20 text-red-300'
              }`}>
                {module.categorie === 'core' ? 'Base' :
                 module.categorie === 'premium' ? 'Premium' :
                 module.categorie === 'option' ? 'Option' : 'Admin'}
              </span>
            </div>

            {/* Informations de disponibilité */}
            {module.source && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {module.source === 'super_admin' && (
                    <>
                      <Settings className="w-4 h-4" />
                      <span>Disponible via Super Admin</span>
                    </>
                  )}
                  {module.source === 'plan' && module.plan_nom && (
                    <>
                      <Package className="w-4 h-4" />
                      <span>Inclus dans {module.plan_nom}</span>
                    </>
                  )}
                  {module.source === 'option' && module.option_nom && (
                    <>
                      <Info className="w-4 h-4" />
                      <span>Option: {module.option_nom}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Toggle et bouton d'accès - Pour TOUS les modules (option, core, admin) - uniquement super admin */}
            {isSuperAdmin && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleModule(module, !module.active);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    module.active
                      ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                      : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                  }`}
                  title={module.active ? 'Désactiver ce module' : 'Activer ce module'}
                >
                  {module.active ? (
                    <>
                      <ToggleRight className="w-5 h-5" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5" />
                      Activer
                    </>
                  )}
                </button>
                
                {module.active && moduleRoutes[module.id] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const route = moduleRoutes[module.id];
                      if (route) {
                        onNavigate(route);
                      }
                    }}
                    className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    Accéder
                  </button>
                )}
              </div>
            )}
            
            {/* Bouton d'accès pour les modules actifs (clients uniquement, pas super admin) */}
            {!isSuperAdmin && module.active && moduleRoutes[module.id] && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const route = moduleRoutes[module.id];
                    if (route) {
                      onNavigate(route);
                    }
                  }}
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Accéder au module
                </button>
              </div>
            )}
            {!module.disponible && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  {module.categorie === 'premium'
                    ? 'Disponible avec un plan premium'
                    : module.categorie === 'option'
                    ? 'Souscrivez à cette option pour l\'activer'
                    : 'Non disponible'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredModules.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun module trouvé dans cette catégorie</p>
        </div>
      )}
    </div>
  );
}

