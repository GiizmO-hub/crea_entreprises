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

interface Abonnement {
  id: string;
  plan_id: string;
  plan_nom: string;
  statut: string;
  fonctionnalites: Record<string, boolean>;
  options: Array<{
    id: string;
    nom: string;
    code: string;
  }>;
}

export default function Modules({ onNavigate }: ModulesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('modules');
  const [modulesTab, setModulesTab] = useState<'all' | 'active' | 'inactive'>('all');

  // Mapping des modules vers les routes
  const moduleRoutes: Record<string, string> = {
    'dashboard': 'dashboard',
    'clients': 'clients',
    'factures': 'factures',
    'comptabilite': 'comptabilite',
    'salaries': 'salaries',
    'automatisations': 'automatisations',
    'administration': 'administration',
    'api': 'api',
    'integration_bancaire': 'integration_bancaire',
    'comptabilite_avancee': 'comptabilite_avancee',
    'signature_electronique': 'signature_electronique',
    'support_prioritaire': 'support_prioritaire',
    'support_dedie': 'support_dedie',
    'collaborateurs': 'collaborateurs',
  };

  const handleModuleClick = (module: Module) => {
    if (!module.active && !isSuperAdmin) return;
    
    const route = moduleRoutes[module.id];
    if (route) {
      onNavigate(route);
    }
  };

  // Obtenir les modules actifs pour les onglets
  const activeModules = modules.filter((m) => m.active || (isSuperAdmin && m.categorie === 'admin'));

  useEffect(() => {
    checkSuperAdmin();
    loadAbonnement();
  }, [user]);

  useEffect(() => {
    if (user && (isSuperAdmin || abonnement)) {
      loadModules();
    }
  }, [user, isSuperAdmin, abonnement]);

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

  const loadAbonnement = async () => {
    if (!user) return;

    try {
      // Pour les super admin, on peut charger n'importe quel abonnement ou créer un abonnement fictif
      if (isSuperAdmin) {
        // Les super admin voient tous les modules
        setAbonnement({
          id: 'super-admin',
          plan_id: 'all',
          plan_nom: 'Super Admin',
          statut: 'actif',
          fonctionnalites: {},
          options: [],
        });
        return;
      }

      // Récupérer l'abonnement du client
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!client) return;

      // Essayer d'abord avec client_id, puis user_id, puis via entreprise
      let abonnementData = null;
      let abonnementError = null;

      // Essayer avec client_id si existe
      const { data: dataClientId, error: errorClientId } = await supabase
        .from('abonnements')
        .select('id, plan_id, statut')
        .eq('client_id', user.id)
        .eq('statut', 'actif')
        .maybeSingle();

      if (!errorClientId && dataClientId) {
        abonnementData = dataClientId;
      } else {
        // Essayer avec user_id
        const { data: dataUserId, error: errorUserId } = await supabase
          .from('abonnements')
          .select('id, plan_id, statut')
          .eq('user_id', user.id)
          .eq('statut', 'actif')
          .maybeSingle();

        if (!errorUserId && dataUserId) {
          abonnementData = dataUserId;
        } else {
          // Essayer via entreprise
          const { data: entreprises } = await supabase
            .from('entreprises')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);

          if (entreprises && entreprises.length > 0) {
            const { data: dataEntreprise, error: errorEntreprise } = await supabase
              .from('abonnements')
              .select('id, plan_id, statut')
              .eq('entreprise_id', entreprises[0].id)
              .eq('statut', 'actif')
              .maybeSingle();

            if (!errorEntreprise && dataEntreprise) {
              abonnementData = dataEntreprise;
              abonnementError = null;
            } else {
              abonnementError = errorEntreprise;
            }
          } else {
            abonnementError = errorUserId || errorClientId;
          }
        }
      }

      if (abonnementError || !abonnementData) {
        console.log('Aucun abonnement actif trouvé');
        return;
      }

      // Récupérer le plan séparément
      const { data: planData, error: planError } = await supabase
        .from('plans_abonnement')
        .select('nom, fonctionnalites')
        .eq('id', abonnementData.plan_id)
        .single();

      if (planError || !planData) {
        console.log('Plan non trouvé');
        return;
      }

      // Récupérer les options souscrites
      const { data: optionsData } = await supabase
        .from('abonnement_options')
        .select(`
          id,
          options_supplementaires (
            id,
            nom
          )
        `)
        .eq('abonnement_id', abonnementData.id)
        .eq('actif', true);

      const options = (optionsData || []).map((opt: any) => {
        const option = Array.isArray(opt.options_supplementaires) 
          ? opt.options_supplementaires[0] 
          : opt.options_supplementaires;
        return {
          id: option?.id,
          nom: option?.nom,
          code: option?.nom?.toLowerCase().replace(/\s+/g, '_'),
        };
      }).filter((opt: any) => opt.nom);

      setAbonnement({
        id: abonnementData.id,
        plan_id: abonnementData.plan_id,
        plan_nom: planData.nom || 'Inconnu',
        statut: abonnementData.statut,
        fonctionnalites: (planData.fonctionnalites as Record<string, boolean>) || {},
        options: options,
      });
    } catch (error) {
      console.error('Erreur chargement abonnement:', error);
    }
  };

  const loadModules = async () => {
    try {
      setLoading(true);

      // Liste des modules disponibles
      const allModules: Omit<Module, 'disponible' | 'active' | 'source' | 'plan_nom' | 'option_nom'>[] = [
        // Modules Core (inclus dans tous les plans)
        { id: 'dashboard', code: 'dashboard', nom: 'Tableau de bord', description: 'Vue d\'ensemble de votre activité', categorie: 'core' },
        { id: 'clients', code: 'clients', nom: 'Gestion des clients', description: 'Gérer vos clients et leurs informations', categorie: 'core' },
        { id: 'factures', code: 'facturation', nom: 'Facturation', description: 'Créer et gérer vos factures', categorie: 'core' },
        
        // Modules Premium
        { id: 'comptabilite', code: 'comptabilite', nom: 'Comptabilité', description: 'Gestion comptable complète', categorie: 'premium' },
        { id: 'salaries', code: 'salaries', nom: 'Gestion des salariés', description: 'Fiches de paie et gestion RH', categorie: 'premium' },
        { id: 'automatisations', code: 'automatisations', nom: 'Automatisations', description: 'Automatiser vos processus', categorie: 'premium' },
        { id: 'administration', code: 'administration', nom: 'Administration', description: 'Gestion administrative avancée', categorie: 'premium' },
        
        // Modules Options
        { id: 'api', code: 'api', nom: 'API Avancée', description: 'Accès complet à l\'API REST avec webhooks', categorie: 'option' },
        { id: 'integration_bancaire', code: 'integration_bancaire', nom: 'Intégration bancaire', description: 'Synchronisation avec vos banques', categorie: 'option' },
        { id: 'comptabilite_avancee', code: 'comptabilite_avancee', nom: 'Comptabilité avancée', description: 'Module de comptabilité analytique', categorie: 'option' },
        { id: 'signature_electronique', code: 'signature_electronique', nom: 'Signature électronique', description: 'Signature de documents en ligne', categorie: 'option' },
        { id: 'support_prioritaire', code: 'support_prioritaire', nom: 'Support prioritaire', description: 'Support sous 2h par téléphone et email', categorie: 'option' },
        { id: 'support_dedie', code: 'support_dedie', nom: 'Support dédié', description: 'Support dédié avec manager de compte', categorie: 'option' },
        
        // Modules Admin
        { id: 'collaborateurs', code: 'collaborateurs', nom: 'Gestion des collaborateurs', description: 'Gérer les collaborateurs et administrateurs', categorie: 'admin' },
      ];

      // Déterminer la disponibilité de chaque module
      const modulesWithStatus: Module[] = allModules.map((module) => {
        let disponible = false;
        let active = false;
        let source: 'plan' | 'option' | 'super_admin' | undefined;
        let plan_nom: string | undefined;
        let option_nom: string | undefined;

        if (isSuperAdmin) {
          // Super admin voit tout
          disponible = true;
          active = true;
          source = 'super_admin';
        } else if (abonnement) {
          // Vérifier si le module est inclus dans le plan
          if (module.categorie === 'core') {
            disponible = true;
            active = abonnement.fonctionnalites[module.code] !== false;
            source = 'plan';
            plan_nom = abonnement.plan_nom;
          } else if (module.categorie === 'premium') {
            disponible = abonnement.fonctionnalites[module.code] === true;
            active = disponible;
            source = disponible ? 'plan' : undefined;
            plan_nom = disponible ? abonnement.plan_nom : undefined;
          } else if (module.categorie === 'option') {
            // Vérifier si l'option est souscrite
            const optionSouscrite = abonnement.options.find(
              (opt) => opt.code === module.code || opt.nom?.toLowerCase().replace(/\s+/g, '_') === module.code
            );
            disponible = !!optionSouscrite;
            active = disponible;
            source = disponible ? 'option' : undefined;
            option_nom = disponible ? (optionSouscrite?.nom || '') : undefined;
          } else if (module.categorie === 'admin') {
            // Modules admin uniquement pour super admin
            disponible = false;
            active = false;
          }
        }

        return {
          ...module,
          disponible,
          active,
          source,
          plan_nom,
          option_nom,
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
    if (!isSuperAdmin && !module.disponible) {
      alert('❌ Ce module n\'est pas disponible avec votre abonnement');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('toggle_module_option', {
        p_option_code: module.code,
        p_user_id: user?.id || null,
        p_activer: activer,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      // Recharger les modules
      await loadModules();
      await loadAbonnement();
      
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
            ? 'Tous les modules sont disponibles (Super Admin)'
            : abonnement
            ? `Plan actuel: ${abonnement.plan_nom}`
            : 'Aucun abonnement actif'}
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

      {/* Onglets Modules Actifs/Inactifs */}
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

      {/* Filtres par catégorie */}
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

            {/* Toggle et bouton d'accès */}
            {module.disponible && (module.categorie === 'option' || (isSuperAdmin && module.categorie !== 'core')) && (
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
            
            {module.active && moduleRoutes[module.id] && !(module.categorie === 'option' || (isSuperAdmin && module.categorie !== 'core')) && (
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

