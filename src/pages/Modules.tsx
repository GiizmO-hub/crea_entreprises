import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Package, CheckCircle, Lock, Unlock, ToggleLeft, ToggleRight, Hammer, Briefcase, Store, Factory, Heart, GraduationCap, Truck, Hotel, Home, Users, TrendingUp } from 'lucide-react';

interface Module {
  id: string;
  code: string;
  nom: string;
  description: string;
  icone?: string;
  categorie: 'core' | 'premium' | 'option' | 'admin';
  secteur_activite?: string;
  priorite?: number;
  disponible: boolean;
  active: boolean;
  est_cree?: boolean;
  source?: 'plan' | 'option' | 'super_admin';
}

// Mapping des secteurs d'activité vers icônes
const secteurIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'transversal': Package,
  'btp_construction': Hammer,
  'services_conseil': Briefcase,
  'commerce_retail': Store,
  'industrie_production': Factory,
  'sante_medical': Heart,
  'formation_education': GraduationCap,
  'transport_logistique': Truck,
  'hotellerie_restauration': Hotel,
  'immobilier': Home,
  'ressources_humaines': Users,
  'marketing_commercial': TrendingUp,
};

// Mapping des secteurs vers labels en français
const secteurLabels: Record<string, string> = {
  'transversal': '🔄 Transversal',
  'btp_construction': '🏗️ BTP / Construction',
  'services_conseil': '💼 Services / Conseil',
  'commerce_retail': '🏪 Commerce / Retail',
  'industrie_production': '🏭 Industrie / Production',
  'sante_medical': '🏥 Santé / Médical',
  'formation_education': '🎓 Formation / Éducation',
  'transport_logistique': '🚚 Transport / Logistique',
  'hotellerie_restauration': '🏨 Hôtellerie / Restauration',
  'immobilier': '🏛️ Immobilier',
  'ressources_humaines': '👥 Ressources Humaines',
  'marketing_commercial': '📊 Marketing / Commercial',
};

interface ModulesProps {
  onNavigate?: (path: string) => void;
}

export default function Modules({ onNavigate }: ModulesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedSecteur, setSelectedSecteur] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('modules');
  const [modulesTab, setModulesTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Mapping des modules vers les routes (uniquement les modules créés)
  const moduleRoutes: Record<string, string> = {
    'dashboard': 'dashboard',
    'clients': 'clients',
    'factures': 'factures',
    'documents': 'documents',
    'collaborateurs': 'collaborateurs',
    'gestion-equipe': 'gestion-equipe',
    'gestion-projets': 'gestion-projets',
    'gestion-stock': 'gestion-stock',
    'crm-avance': 'crm-avance',
    'time-tracking': 'time-tracking',
    'gestion-budget': 'gestion-budget',
  };


  // Obtenir les modules actifs pour les onglets (uniquement pour super admin)
  const activeModules = isSuperAdmin ? modules.filter((m) => m.active && m.est_cree) : [];

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
      // Méthode 1 : Utiliser la fonction RPC qui contourne RLS
      const { data: roleData, error: rpcError } = await supabase.rpc('get_current_user_role');
      
      if (!rpcError && roleData) {
        const isAdmin = roleData.is_super_admin === true || roleData.is_admin === true;
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Méthode 2 : Essayer de lire directement depuis la table utilisateurs
      const { data: utilisateur, error: tableError } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!tableError && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Méthode 3 : Fallback sur user_metadata
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role || authUser?.app_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      setIsSuperAdmin(isAdmin);
    } catch (error) {
      console.error('❌ Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadModules = async () => {
    try {
      setLoading(true);

      // Charger les modules depuis la table modules_activation avec leurs métiers
      interface ModuleFromDB {
        module_code: string;
        module_nom: string;
        module_description?: string;
        categorie?: string;
        actif: boolean;
        est_cree: boolean;
        prix_optionnel?: number;
        [key: string]: unknown;
      }
      
      let modulesFromDB: ModuleFromDB[] = [];
      
      try {
        // Récupérer tous les modules avec leurs informations complètes
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules_activation')
          .select(`
            module_code,
            module_nom,
            module_description,
            categorie,
            secteur_activite,
            priorite,
            actif,
            est_cree,
            icone,
            route
          `)
          .order('secteur_activite', { ascending: true })
          .order('priorite', { ascending: true });

        if (modulesError) {
          console.error('Erreur chargement modules depuis DB:', modulesError);
        } else if (modulesData && Array.isArray(modulesData)) {
          modulesFromDB = modulesData;
        }
      } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
      }

      // Si aucun module dans la DB, créer la liste de base avec les modules existants
      if (modulesFromDB.length === 0) {
        const allModules: Omit<Module, 'disponible' | 'active'>[] = [
          // Modules Core
          { 
            id: 'dashboard', 
            code: 'dashboard', 
            nom: 'Tableau de bord', 
            description: 'Vue d\'ensemble de votre activité', 
            categorie: 'core',
            secteur_activite: 'transversal',
            priorite: 0
          },
          { 
            id: 'clients', 
            code: 'clients', 
            nom: 'Gestion des clients', 
            description: 'Gérer vos clients et leurs informations', 
            categorie: 'core',
            secteur_activite: 'transversal',
            priorite: 0
          },
          { 
            id: 'factures', 
            code: 'facturation', 
            nom: 'Facturation', 
            description: 'Créer et gérer vos factures', 
            categorie: 'core',
            secteur_activite: 'transversal',
            priorite: 0
          },
          { 
            id: 'documents', 
            code: 'documents', 
            nom: 'Gestion de documents', 
            description: 'Gérer tous vos documents d\'entreprise', 
            categorie: 'core',
            secteur_activite: 'transversal',
            priorite: 0
          },
          // Modules Admin
          { 
            id: 'collaborateurs', 
            code: 'collaborateurs', 
            nom: 'Gestion des collaborateurs', 
            description: 'Gérer les collaborateurs et administrateurs', 
            categorie: 'admin',
            secteur_activite: 'transversal',
            priorite: 0
          },
          { 
            id: 'gestion-equipe', 
            code: 'gestion-equipe', 
            nom: 'Gestion d\'Équipe', 
            description: 'Gérer les équipes et les permissions d\'accès aux dossiers', 
            categorie: 'admin',
            secteur_activite: 'transversal',
            priorite: 0
          },
        ];

        // Mapper les modules de base avec statut
        const modulesWithStatus: Module[] = allModules.map((module) => ({
          ...module,
          disponible: isSuperAdmin,
          active: true, // Les modules core sont toujours actifs
          est_cree: true,
        }));

        setModules(modulesWithStatus);
        setLoading(false);
        return;
      }

      // Mapper les modules depuis la DB
      const modulesWithStatus: Module[] = modulesFromDB.map((mod: ModuleFromDB) => {
        let disponible = isSuperAdmin;
        const active = mod.actif === true;
        
        // Pour les clients, ils ne voient que les modules actifs et créés
        if (!isSuperAdmin) {
          disponible = active && mod.est_cree === true;
        }
        
        // Convertir icone en string si nécessaire
        let iconeString: string | undefined;
        if (typeof mod.icone === 'string') {
          iconeString = mod.icone;
        } else if (mod.icone) {
          iconeString = String(mod.icone);
        }

        return {
          id: mod.module_code,
          code: mod.module_code,
          nom: mod.module_nom || mod.module_code,
          description: mod.module_description || '',
          categorie: (mod.categorie as 'core' | 'premium' | 'option' | 'admin') || 'option',
          secteur_activite: mod.secteur_activite || 'transversal',
          priorite: mod.priorite || 999,
          disponible,
          active,
          est_cree: mod.est_cree || false,
          icone: iconeString,
        };
      });

      // Trier par secteur puis par priorité
      modulesWithStatus.sort((a, b) => {
        if (a.secteur_activite !== b.secteur_activite) {
          return (a.secteur_activite || 'zzz').localeCompare(b.secteur_activite || 'zzz');
        }
        return (a.priorite || 999) - (b.priorite || 999);
      });

      setModules(modulesWithStatus);
    } catch (error) {
      console.error('Erreur chargement modules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Grouper les modules par secteur d'activité
  const modulesBySecteur = modules.reduce((acc, module) => {
    const secteur = module.secteur_activite || 'transversal';
    if (!acc[secteur]) {
      acc[secteur] = [];
    }
    acc[secteur].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  // Obtenir la liste des secteurs présents
  const secteurs = Object.keys(modulesBySecteur).sort();

  // Séparer les modules actifs et inactifs
  const modulesActifs = modules.filter((m) => m.active);
  const modulesInactifs = modules.filter((m) => !m.active && m.disponible);

  // Fonction pour activer/désactiver un module
  const handleToggleModule = async (module: Module, activer: boolean) => {
    if (!isSuperAdmin) {
      alert('❌ Vous n\'avez pas les droits pour activer/désactiver des modules.\nSeul l\'administrateur peut gérer les modules.');
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('modules_activation')
        .upsert({
          module_code: module.code,
          module_nom: module.nom,
          module_description: module.description,
          categorie: module.categorie,
          secteur_activite: module.secteur_activite || 'transversal',
          priorite: module.priorite || 999,
          actif: activer,
        }, {
          onConflict: 'module_code'
        });

      if (insertError) {
        console.error('Erreur upsert module:', insertError);
        throw insertError;
      }

      console.log('Module activé/désactivé:', { code: module.code, nom: module.nom, activer });

      await new Promise(resolve => setTimeout(resolve, 200));
      await loadModules();
      
      alert(activer ? '✅ Module activé avec succès!' : '✅ Module désactivé avec succès!');
    } catch (error: unknown) {
      console.error('Erreur toggle module:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la modification: ' + errorMessage);
    }
  };

  // Filtrer les modules selon l'onglet et le secteur
  let filteredModules = modules;
  
  // Filtrer par statut (actif/inactif)
  if (modulesTab === 'active') {
    filteredModules = filteredModules.filter((m) => m.active);
  } else if (modulesTab === 'inactive') {
    filteredModules = filteredModules.filter((m) => !m.active && m.disponible);
  }
  
  // Filtrer par secteur
  if (selectedSecteur !== 'all') {
    filteredModules = filteredModules.filter((m) => (m.secteur_activite || 'transversal') === selectedSecteur);
  }

  // Grouper les modules filtrés par secteur
  const filteredModulesBySecteur = filteredModules.reduce((acc, module) => {
    const secteur = module.secteur_activite || 'transversal';
    if (!acc[secteur]) {
      acc[secteur] = [];
    }
    acc[secteur].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

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
            ? 'Gérez l\'activation et la désactivation des modules par métier'
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
              const route = moduleRoutes[module.code];
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setActiveTab(module.id);
                    if (route) {
                      if (onNavigate) {
                        onNavigate(route);
                      } else {
                        window.location.hash = `#${route}`;
                      }
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

      {/* Filtres par secteur - Uniquement pour super admin */}
      {isSuperAdmin && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedSecteur('all')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              selectedSecteur === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Package className="w-4 h-4" />
            Tous les secteurs
          </button>
          {secteurs.map((secteur) => {
            const Icon = secteurIcons[secteur] || Package;
            return (
              <button
                key={secteur}
                onClick={() => setSelectedSecteur(secteur)}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                  selectedSecteur === secteur
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {secteurLabels[secteur] || secteur}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste des modules groupés par secteur */}
      {Object.keys(filteredModulesBySecteur).length === 0 ? (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun module trouvé</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(filteredModulesBySecteur)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([secteur, modulesSecteur]) => {
              const Icon = secteurIcons[secteur] || Package;
              // Trier les modules par priorité
              const sortedModules = [...modulesSecteur].sort((a, b) => (a.priorite || 999) - (b.priorite || 999));
              
              return (
                <div key={secteur} className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-6">
                    <Icon className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-bold text-white">
                      {secteurLabels[secteur] || secteur}
                    </h2>
                    <span className="text-sm text-gray-400">({sortedModules.length} module{sortedModules.length > 1 ? 's' : ''})</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedModules.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        isSuperAdmin={isSuperAdmin}
                        moduleRoutes={moduleRoutes}
                        onNavigate={onNavigate}
                        onToggle={handleToggleModule}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// Composant carte module
function ModuleCard({
  module,
  isSuperAdmin,
  moduleRoutes,
  onNavigate,
  onToggle,
}: {
  module: Module;
  isSuperAdmin: boolean;
  moduleRoutes: Record<string, string>;
  onNavigate: (page: string) => void;
  onToggle: (module: Module, activer: boolean) => void;
}) {
  return (
    <div
      onClick={() => {
        if (module.active && module.est_cree) {
          const route = moduleRoutes[module.code];
          if (route) {
            onNavigate(route);
          }
        }
      }}
      className={`bg-white/10 backdrop-blur-lg rounded-xl p-4 border transition-all ${
        module.active && module.est_cree
          ? 'border-green-500/50 hover:border-green-500 hover:scale-105 cursor-pointer'
          : module.disponible
          ? 'border-blue-500/50 hover:border-blue-500 hover:scale-105 cursor-pointer'
          : 'border-gray-500/50 opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className={`w-5 h-5 ${
            module.active ? 'text-green-400' : module.disponible ? 'text-blue-400' : 'text-gray-400'
          }`} />
          <div>
            <h3 className="font-bold text-white text-base">{module.nom}</h3>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{module.description}</p>
          </div>
        </div>
        <div>
          {module.active ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : module.disponible ? (
            <Unlock className="w-5 h-5 text-blue-400" />
          ) : (
            <Lock className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Badge catégorie et statut */}
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
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
        {!module.est_cree && (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300">
            À venir
          </span>
        )}
        {module.priorite && module.priorite <= 10 && (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
            Priorité {module.priorite}
          </span>
        )}
      </div>

      {/* Toggle et bouton d'accès - Uniquement super admin */}
      {isSuperAdmin && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(module, !module.active);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              module.active
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
            }`}
            title={module.active ? 'Désactiver ce module' : 'Activer ce module'}
          >
            {module.active ? (
              <>
                <ToggleRight className="w-4 h-4" />
                Désactiver
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                Activer
              </>
            )}
          </button>
          
          {module.active && module.est_cree && moduleRoutes[module.code] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const route = moduleRoutes[module.code];
                if (route && onNavigate) {
                  onNavigate(route);
                } else if (route) {
                  window.location.hash = `#${route}`;
                }
              }}
              className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Accéder
            </button>
          )}
        </div>
      )}
      
      {/* Bouton d'accès pour les clients */}
      {!isSuperAdmin && module.active && module.est_cree && moduleRoutes[module.code] && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const route = moduleRoutes[module.code];
              if (route) {
                onNavigate(route);
              }
            }}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Accéder au module
          </button>
        </div>
      )}
    </div>
  );
}
