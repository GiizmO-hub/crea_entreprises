import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  X, 
  ToggleLeft,
  ToggleRight,
  Package,
  Settings,
  Save,
  AlertCircle,
} from 'lucide-react';

interface GestionPlansProps {
  onNavigate: (page: string) => void;
}

interface Plan {
  id: string;
  nom: string;
  description?: string;
  prix_mensuel: number;
  prix_annuel: number;
  actif: boolean;
  ordre: number;
  created_at: string;
  modules?: PlanModule[];
}

interface PlanModule {
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

interface Module {
  module_code: string;
  module_nom: string;
  module_description?: string;
  categorie: string;
  est_cree: boolean;
  actif: boolean;
  prix_optionnel: number;
}

export default function GestionPlans({ onNavigate: _onNavigate }: GestionPlansProps) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix_mensuel: 0,
    prix_annuel: 0,
    actif: true,
    ordre: 0,
    modules: [] as Array<{
      module_code: string;
      inclus: boolean;
      prix_mensuel: number;
      prix_annuel: number;
    }>,
  });

  useEffect(() => {
    checkSuperAdmin();
    loadData();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      const { data: roleData, error: rpcError } = await supabase.rpc('get_current_user_role');
      if (!rpcError && roleData) {
        const isAdmin = roleData.is_super_admin === true || roleData.is_admin === true;
        setIsSuperAdmin(isAdmin);
        return;
      }
      const { data: utilisateur, error: tableError } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!tableError && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        setIsSuperAdmin(isAdmin);
      }
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les plans
      const { data: plansData, error: plansError } = await supabase
        .from('plans_abonnement')
        .select('*')
        .order('ordre', { ascending: true });

      if (plansError) throw plansError;

      // Charger les modules créés
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules_activation')
        .select('module_code, module_nom, module_description, categorie, est_cree, actif, prix_optionnel')
        .eq('est_cree', true)
        .order('module_nom');

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Pour chaque plan, charger ses modules
      const plansWithModules = await Promise.all(
        (plansData || []).map(async (plan) => {
          try {
            const { data: planModulesData, error: modulesError } = await supabase.rpc('get_plan_modules', {
              p_plan_id: plan.id
            });
            
            if (modulesError) {
              console.error(`Erreur chargement modules pour plan ${plan.id}:`, modulesError);
              return {
                ...plan,
                modules: [],
              };
            }
            
            return {
              ...plan,
              modules: planModulesData || [],
            };
          } catch (error) {
            console.error(`Erreur chargement modules pour plan ${plan.id}:`, error);
            return {
              ...plan,
              modules: [],
            };
          }
        })
      );

      console.log('📊 Plans chargés avec modules:', plansWithModules.map(p => ({
        nom: p.nom,
        modulesCount: p.modules?.length || 0,
        modulesInclus: p.modules?.filter(m => m.inclus).length || 0,
      })));

      setPlans(plansWithModules);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlan = async (planId: string, currentActif: boolean) => {
    try {
      const { error } = await supabase
        .from('plans_abonnement')
        .update({ actif: !currentActif })
        .eq('id', planId);

      if (error) throw error;

      alert(`✅ Plan ${!currentActif ? 'activé' : 'désactivé'} avec succès!`);
      loadData();
    } catch (error: any) {
      console.error('Erreur toggle plan:', error);
      alert('❌ Erreur: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nom: plan.nom,
      description: plan.description || '',
      prix_mensuel: plan.prix_mensuel || 0,
      prix_annuel: plan.prix_annuel || 0,
      actif: plan.actif,
      ordre: plan.ordre,
      modules: (plan.modules || []).map(mod => ({
        module_code: mod.module_code,
        inclus: mod.inclus,
        prix_mensuel: mod.prix_mensuel || 0,
        prix_annuel: mod.prix_annuel || 0,
      })),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Préparer les modules au format JSON pour la fonction RPC
      const modulesJson = modules.map(mod => {
        const existingModule = formData.modules.find(m => m.module_code === mod.module_code);
        return {
          module_code: mod.module_code,
          inclus: existingModule?.inclus || false,
          prix_mensuel: existingModule?.prix_mensuel || mod.prix_optionnel || 0,
          prix_annuel: existingModule?.prix_annuel || 0,
        };
      });

      const { data, error } = await supabase.rpc('upsert_plan_with_modules', {
        p_nom: formData.nom,
        p_description: formData.description || null,
        p_prix_mensuel: parseFloat(formData.prix_mensuel.toString()),
        p_prix_annuel: parseFloat(formData.prix_annuel.toString()),
        p_actif: formData.actif,
        p_ordre: formData.ordre,
        p_modules: modulesJson as any,
        p_plan_id: editingPlan?.id || null,
      });

      if (error) throw error;

      if (data?.success) {
        alert('✅ Plan créé/modifié avec succès!');
        setShowForm(false);
        setEditingPlan(null);
        resetForm();
        loadData();
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('Erreur sauvegarde plan:', error);
      alert('❌ Erreur: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce plan ? Les abonnements liés ne seront pas supprimés.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('plans_abonnement')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      alert('✅ Plan supprimé avec succès!');
      loadData();
    } catch (error: any) {
      console.error('Erreur suppression plan:', error);
      alert('❌ Erreur: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      description: '',
      prix_mensuel: 0,
      prix_annuel: 0,
      actif: true,
      ordre: 0,
      modules: [],
    });
  };

  const toggleModuleInclus = (moduleCode: string) => {
    const existingModule = formData.modules.find(m => m.module_code === moduleCode);
    if (existingModule) {
      setFormData({
        ...formData,
        modules: formData.modules.map(m =>
          m.module_code === moduleCode
            ? { ...m, inclus: !m.inclus }
            : m
        ),
      });
    } else {
      const module = modules.find(m => m.module_code === moduleCode);
      setFormData({
        ...formData,
        modules: [
          ...formData.modules,
          {
            module_code: moduleCode,
            inclus: true,
            prix_mensuel: module?.prix_optionnel || 0,
            prix_annuel: 0,
          },
        ],
      });
    }
  };

  const updateModulePrice = (moduleCode: string, field: 'prix_mensuel' | 'prix_annuel', value: number) => {
    setFormData({
      ...formData,
      modules: formData.modules.map(m =>
        m.module_code === moduleCode
          ? { ...m, [field]: value }
          : m
      ),
    });
  };

  const calculateTotal = () => {
    const basePrice = formData.prix_mensuel || 0;
    const modulesPrice = formData.modules
      .filter(m => m.inclus)
      .reduce((sum, m) => sum + (m.prix_mensuel || 0), 0);
    return basePrice + modulesPrice;
  };

  const filteredPlans = plans.filter(plan =>
    plan.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-gray-300">Seul le super administrateur peut gérer les plans d'abonnements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <CreditCard className="w-8 h-8" />
            Gestion des Plans d'Abonnements
          </h1>
          <p className="text-gray-300">
            Créez et gérez vos plans d'abonnements avec sélection de modules et prix personnalisés
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingPlan(null);
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau Plan
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un plan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Liste des plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border transition-all ${
              plan.actif ? 'border-green-500/50' : 'border-gray-500/50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">{plan.nom}</h3>
                </div>
                {plan.description && (
                  <p className="text-gray-400 text-sm mb-3">{plan.description}</p>
                )}
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-gray-400 text-xs">Mensuel</p>
                    <p className="text-white font-bold">{plan.prix_mensuel.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Annuel</p>
                    <p className="text-white font-bold">{plan.prix_annuel.toFixed(2)}€</p>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-gray-400 text-xs mb-1">Modules inclus</p>
                  <p className="text-white font-semibold">
                    {plan.modules?.filter((m: PlanModule) => m.inclus === true).length || 0} module(s)
                    {plan.modules && plan.modules.length > 0 && (
                      <span className="text-gray-400 text-xs ml-2">
                        ({plan.modules.filter((m: PlanModule) => m.inclus && m.est_cree && m.actif).length} créés et actifs)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleTogglePlan(plan.id, plan.actif)}
                className={`p-2 rounded-lg transition-all ${
                  plan.actif
                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                    : 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                }`}
                title={plan.actif ? 'Désactiver' : 'Activer'}
              >
                {plan.actif ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={() => handleEdit(plan)}
                className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => handleDelete(plan.id)}
                className="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun plan trouvé</p>
        </div>
      )}

      {/* Formulaire Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingPlan ? 'Modifier le plan' : 'Nouveau plan d\'abonnement'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPlan(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Nom du plan *</label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Starter"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formData.ordre}
                    onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Description du plan..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Prix mensuel (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prix_mensuel}
                    onChange={(e) => setFormData({ ...formData, prix_mensuel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Prix annuel (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prix_annuel}
                    onChange={(e) => setFormData({ ...formData, prix_annuel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white">Plan actif</span>
                </label>
              </div>

              {/* Sélection des modules */}
              <div className="border-t border-white/20 pt-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Modules inclus dans ce plan
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Sélectionnez les modules à inclure et définissez leur prix pour ce plan
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto bg-white/5 rounded-lg p-4">
                  {modules.map((module) => {
                    const planModule = formData.modules.find(m => m.module_code === module.module_code);
                    const isInclus = planModule?.inclus || false;

                    return (
                      <div
                        key={module.module_code}
                        className={`p-4 rounded-lg border transition-all ${
                          isInclus ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <input
                                type="checkbox"
                                checked={isInclus}
                                onChange={() => toggleModuleInclus(module.module_code)}
                                className="w-4 h-4 rounded"
                              />
                              <h4 className="text-white font-semibold">{module.module_nom}</h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  module.categorie === 'core'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : module.categorie === 'premium'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'bg-orange-500/20 text-orange-300'
                                }`}
                              >
                                {module.categorie}
                              </span>
                            </div>
                            {module.module_description && (
                              <p className="text-gray-400 text-sm ml-7">{module.module_description}</p>
                            )}
                          </div>
                        </div>

                        {isInclus && (
                          <div className="ml-7 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-gray-400 text-xs mb-1">Prix mensuel (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={planModule?.prix_mensuel || module.prix_optionnel || 0}
                                onChange={(e) =>
                                  updateModulePrice(
                                    module.module_code,
                                    'prix_mensuel',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 text-xs mb-1">Prix annuel (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={planModule?.prix_annuel || 0}
                                onChange={(e) =>
                                  updateModulePrice(
                                    module.module_code,
                                    'prix_annuel',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Prix de base:</span>
                  <span className="text-white font-semibold">{formData.prix_mensuel.toFixed(2)}€/mois</span>
                </div>
                {formData.modules.filter(m => m.inclus).length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">
                      Modules ({formData.modules.filter(m => m.inclus).length}):
                    </span>
                    <span className="text-white font-semibold">
                      +{formData.modules
                        .filter(m => m.inclus)
                        .reduce((sum, m) => sum + (m.prix_mensuel || 0), 0)
                        .toFixed(2)}€/mois
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-white font-bold text-lg">Total mensuel:</span>
                  <span className="text-green-400 font-bold text-xl">{calculateTotal().toFixed(2)}€</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingPlan ? 'Modifier le plan' : 'Créer le plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

