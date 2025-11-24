import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  Briefcase, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Building2, 
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Link2,
  Target,
  DollarSign,
  TrendingUp,
  User,
  Shield,
} from 'lucide-react';
import { getModuleDependencies, canReuseModule, navigateToReusableModule, getModuleLabel } from '../lib/moduleReuse';

interface Projet {
  id: string;
  nom: string;
  description?: string;
  client_id?: string;
  responsable_id?: string;
  equipe_id?: string;
  date_debut?: string;
  date_fin_prevue?: string;
  date_fin_reelle?: string;
  budget_previstoire: number;
  budget_reel: number;
  statut: string;
  priorite: string;
  couleur?: string;
  notes?: string;
  entreprise_id: string;
  created_at: string;
  updated_at: string;
  // Données jointes
  client?: {
    id: string;
    nom?: string;
    prenom?: string;
    entreprise_nom?: string;
  };
  responsable?: {
    id: string;
    nom?: string;
    prenom?: string;
    email: string;
  };
  equipe?: {
    id: string;
    nom: string;
  };
  stats?: {
    total_taches: number;
    taches_terminees: number;
    taches_en_cours: number;
    taches_a_faire: number;
    avancement_pct: number;
    total_jalons: number;
    jalons_termines: number;
  };
}

interface Jalon {
  id: string;
  projet_id: string;
  nom: string;
  description?: string;
  date_prevue: string;
  date_reelle?: string;
  statut: string;
  ordre: number;
}

interface Tache {
  id: string;
  projet_id: string;
  jalon_id?: string;
  nom: string;
  description?: string;
  collaborateur_id?: string;
  equipe_id?: string;
  date_debut_prevue?: string;
  date_fin_prevue: string;
  date_debut_reelle?: string;
  date_fin_reelle?: string;
  duree_estimee_heures: number;
  duree_reelle_heures: number;
  statut: string;
  priorite: string;
  ordre: number;
  notes?: string;
  // Données jointes
  collaborateur?: {
    id: string;
    nom?: string;
    prenom?: string;
    email: string;
  };
  equipe?: {
    id: string;
    nom: string;
  };
}

interface GestionProjetsProps {
  onNavigate: (page: string) => void;
}

const STATUTS_PROJET = [
  { value: 'planifie', label: 'Planifié', color: 'blue', icon: Calendar },
  { value: 'en_cours', label: 'En cours', color: 'green', icon: TrendingUp },
  { value: 'en_pause', label: 'En pause', color: 'yellow', icon: Clock },
  { value: 'termine', label: 'Terminé', color: 'purple', icon: CheckCircle2 },
  { value: 'annule', label: 'Annulé', color: 'red', icon: X },
];

const PRIORITES = [
  { value: 'basse', label: 'Basse', color: 'gray' },
  { value: 'moyenne', label: 'Moyenne', color: 'blue' },
  { value: 'haute', label: 'Haute', color: 'orange' },
  { value: 'urgente', label: 'Urgente', color: 'red' },
];

export default function GestionProjets() {
  const { user } = useAuth();
  const [projets, setProjets] = useState<Projet[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; nom?: string; prenom?: string; entreprise_nom?: string }>>([]);
  const [collaborateurs, setCollaborateurs] = useState<Array<{ id: string; user_id: string; nom?: string; prenom?: string; email: string; poste?: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nom: string; entreprise_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const [showJalons, setShowJalons] = useState(false);
  const [showTaches, setShowTaches] = useState(false);
  const [jalons, setJalons] = useState<Jalon[]>([]);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [dependencies, setDependencies] = useState<Array<{ module: string; feature: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    client_id: '',
    responsable_id: '',
    equipe_id: '',
    date_debut: '',
    date_fin_prevue: '',
    budget_previstoire: 0,
    statut: 'planifie',
    priorite: 'moyenne',
    couleur: '#3B82F6',
    notes: '',
    entreprise_id: '',
  });

  useEffect(() => {
    if (user) {
      loadDependencies();
      loadEntreprises();
    }
  }, [user]);

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      const firstEntreprise = entreprises[0].id;
      setSelectedEntreprise(firstEntreprise);
      setFormData((prev) => ({ ...prev, entreprise_id: firstEntreprise }));
      loadClients(firstEntreprise);
      loadCollaborateurs(firstEntreprise);
      loadEquipes(firstEntreprise);
      loadProjets(firstEntreprise);
    }
  }, [entreprises]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadProjets(selectedEntreprise);
    }
  }, [selectedEntreprise, filterStatut, searchTerm]);

  // Charger les dépendances du module (modules réutilisables)
  const loadDependencies = async () => {
    try {
      const deps = await getModuleDependencies('gestion-projets');
      setDependencies(deps);
      console.log('📦 Dépendances Gestion de Projets:', deps);
    } catch (error) {
      console.error('Erreur chargement dépendances:', error);
    }
  };

  const loadEntreprises = async () => {
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom')
        .order('nom');

      if (error) throw error;
      setEntreprises(data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const loadClients = async (entrepriseId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, prenom, entreprise_nom')
        .eq('entreprise_id', entrepriseId)
        .order('nom');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  // Charger les collaborateurs (réutilise le module collaborateurs)
  const loadCollaborateurs = async (entrepriseId: string) => {
    try {
      const canReuse = await canReuseModule('gestion-projets', 'collaborateurs');
      if (!canReuse) {
        console.warn('⚠️ Module Collaborateurs non disponible pour réutilisation');
        return;
      }

      const { data, error } = await supabase
        .from('collaborateurs')
        .select('id, user_id, nom, prenom, email, poste')
        .eq('entreprise_id', entrepriseId)
        .eq('statut', 'active')
        .order('nom');

      if (error) throw error;
      setCollaborateurs(data || []);
    } catch (error) {
      console.error('Erreur chargement collaborateurs:', error);
    }
  };

  // Charger les équipes (réutilise le module gestion-equipe)
  const loadEquipes = async (entrepriseId: string) => {
    try {
      const canReuse = await canReuseModule('gestion-projets', 'gestion-equipe');
      if (!canReuse) {
        console.warn('⚠️ Module Gestion d\'Équipe non disponible pour réutilisation');
        return;
      }

      const { data, error } = await supabase
        .from('equipes')
        .select('id, nom, entreprise_id')
        .eq('entreprise_id', entrepriseId)
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setEquipes(data || []);
    } catch (error) {
      console.error('Erreur chargement équipes:', error);
    }
  };

  const loadProjets = async (entrepriseId: string) => {
    try {
      setLoading(true);
      let query = supabase
        .from('projets')
        .select(`
          *,
          client:clients(id, nom, prenom, entreprise_nom),
          responsable:collaborateurs!projets_responsable_id_fkey(id, nom, prenom, email),
          equipe:equipes!projets_equipe_id_fkey(id, nom)
        `)
        .eq('entreprise_id', entrepriseId)
        .order('created_at', { ascending: false });

      if (filterStatut !== 'all') {
        query = query.eq('statut', filterStatut);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Charger les stats pour chaque projet
      const projetsWithStats = await Promise.all(
        (data || []).map(async (projet) => {
          try {
            const { data: statsData } = await supabase.rpc('get_projet_stats', {
              p_projet_id: projet.id
            });
            interface StatsData {
              total_taches?: number;
              taches_completees?: number;
              taches_en_cours?: number;
              [key: string]: unknown;
            }
            
            return {
              ...projet,
              stats: (statsData as StatsData | null) || null
            };
          } catch (err) {
            console.error('Erreur chargement stats projet:', err);
            return projet;
          }
        })
      );

      // Filtrer par recherche
      let filtered = projetsWithStats;
      if (searchTerm) {
        filtered = projetsWithStats.filter(p => 
          p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.client?.entreprise_nom?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setProjets(filtered);
    } catch (error) {
      console.error('Erreur chargement projets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Mise à jour
        const { error } = await supabase
          .from('projets')
          .update({
            ...formData,
            budget_previstoire: parseFloat(formData.budget_previstoire.toString()),
          })
          .eq('id', editingId);

        if (error) throw error;
        alert('✅ Projet modifié avec succès!');
      } else {
        // Création
        const { error } = await supabase
          .from('projets')
          .insert({
            ...formData,
            budget_previstoire: parseFloat(formData.budget_previstoire.toString()),
            budget_reel: 0,
          });

        if (error) throw error;
        alert('✅ Projet créé avec succès!');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        nom: '',
        description: '',
        client_id: '',
        responsable_id: '',
        equipe_id: '',
        date_debut: '',
        date_fin_prevue: '',
        budget_previstoire: 0,
        statut: 'planifie',
        priorite: 'moyenne',
        couleur: '#3B82F6',
        notes: '',
        entreprise_id: selectedEntreprise,
      });
      loadProjets(selectedEntreprise);
    } catch (error: any) {
      console.error('Erreur sauvegarde projet:', error);
      alert('❌ Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleEdit = (projet: Projet) => {
    setEditingId(projet.id);
    setFormData({
      nom: projet.nom,
      description: projet.description || '',
      client_id: projet.client_id || '',
      responsable_id: projet.responsable_id || '',
      equipe_id: projet.equipe_id || '',
      date_debut: projet.date_debut || '',
      date_fin_prevue: projet.date_fin_prevue || '',
      budget_previstoire: projet.budget_previstoire || 0,
      statut: projet.statut,
      priorite: projet.priorite || 'moyenne',
      couleur: projet.couleur || '#3B82F6',
      notes: projet.notes || '',
      entreprise_id: projet.entreprise_id,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
      const { error } = await supabase
        .from('projets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('✅ Projet supprimé avec succès!');
      loadProjets(selectedEntreprise);
    } catch (error: any) {
      console.error('Erreur suppression projet:', error);
      alert('❌ Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleViewDetails = async (projet: Projet) => {
    setSelectedProjet(projet);
    // Charger les jalons et tâches du projet
    await loadJalons(projet.id);
    await loadTaches(projet.id);
  };

  const loadJalons = async (projetId: string) => {
    try {
      const { data, error } = await supabase
        .from('projets_jalons')
        .select('*')
        .eq('projet_id', projetId)
        .order('ordre', { ascending: true })
        .order('date_prevue', { ascending: true });

      if (error) throw error;
      setJalons(data || []);
    } catch (error) {
      console.error('Erreur chargement jalons:', error);
    }
  };

  const loadTaches = async (projetId: string) => {
    try {
      const { data, error } = await supabase
        .from('projets_taches')
        .select(`
          *,
          collaborateur:collaborateurs!projets_taches_collaborateur_id_fkey(id, nom, prenom, email),
          equipe:equipes!projets_taches_equipe_id_fkey(id, nom)
        `)
        .eq('projet_id', projetId)
        .order('ordre', { ascending: true });

      if (error) throw error;
      setTaches(data || []);
    } catch (error) {
      console.error('Erreur chargement tâches:', error);
    }
  };

  // Fonction pour ouvrir un module réutilisable
  const handleOpenReusableModule = async (moduleCode: string) => {
    const canReuse = await canReuseModule('gestion-projets', moduleCode);
    if (canReuse) {
      navigateToReusableModule(moduleCode, onNavigate);
    } else {
      alert(`Le module ${getModuleLabel(moduleCode)} doit être activé pour utiliser cette fonctionnalité`);
    }
  };

  if (loading && projets.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Chargement des projets...</p>
          </div>
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
            <Briefcase className="w-8 h-8" />
            Gestion de Projets
          </h1>
          <p className="text-gray-300">
            Créez et gérez vos projets avec jalons, tâches et suivi budgétaire
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              nom: '',
              description: '',
              client_id: '',
              responsable_id: '',
              equipe_id: '',
              date_debut: '',
              date_fin_prevue: '',
              budget_previstoire: 0,
              statut: 'planifie',
              priorite: 'moyenne',
              couleur: '#3B82F6',
              notes: '',
              entreprise_id: selectedEntreprise,
            });
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau Projet
        </button>
      </div>

      {/* Bannière de réutilisation des modules */}
      {dependencies.length > 0 && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-blue-300 font-semibold mb-2">Modules Réutilisés</h3>
              <p className="text-gray-300 text-sm mb-3">
                Ce module réutilise les fonctionnalités suivantes :
              </p>
              <div className="flex flex-wrap gap-2">
                {dependencies.map((dep) => {
                  if (!dep.actif || !dep.est_cree) return null;
                  return (
                    <button
                      key={dep.module_depend_de}
                      onClick={() => handleOpenReusableModule(dep.module_depend_de)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all border border-blue-500/30"
                    >
                      <Shield className="w-4 h-4" />
                      {getModuleLabel(dep.module_depend_de)}
                      {dep.type_dependance === 'requis' && (
                        <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Requis</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un projet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <select
          value={selectedEntreprise}
          onChange={(e) => {
            setSelectedEntreprise(e.target.value);
            setFormData((prev) => ({ ...prev, entreprise_id: e.target.value }));
            loadClients(e.target.value);
            loadCollaborateurs(e.target.value);
            loadEquipes(e.target.value);
          }}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {entreprises.map((ent) => (
            <option key={ent.id} value={ent.id} className="bg-gray-800">
              {ent.nom}
            </option>
          ))}
        </select>

        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all" className="bg-gray-800">Tous les statuts</option>
          {STATUTS_PROJET.map((statut) => (
            <option key={statut.value} value={statut.value} className="bg-gray-800">
              {statut.label}
            </option>
          ))}
        </select>
      </div>

      {/* Formulaire de création/édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Modifier le projet' : 'Nouveau projet'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white mb-2">Nom du projet *</label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Site web e-commerce"
                />
              </div>

              <div>
                <label className="block text-white mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Description du projet..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Client (réutilise Clients)</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="" className="bg-gray-800">Aucun client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id} className="bg-gray-800">
                        {client.entreprise_nom || `${client.prenom} ${client.nom}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenReusableModule('clients')}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Ouvrir {getModuleLabel('clients')}
                  </button>
                </div>

                <div>
                  <label className="block text-white mb-2">Responsable (réutilise Collaborateurs)</label>
                  <select
                    value={formData.responsable_id}
                    onChange={(e) => setFormData({ ...formData, responsable_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="" className="bg-gray-800">Aucun responsable</option>
                    {collaborateurs.map((collab) => (
                      <option key={collab.id} value={collab.id} className="bg-gray-800">
                        {collab.prenom} {collab.nom} ({collab.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleOpenReusableModule('collaborateurs')}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Ouvrir {getModuleLabel('collaborateurs')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white mb-2">Équipe (réutilise Gestion d'Équipe)</label>
                <select
                  value={formData.equipe_id}
                  onChange={(e) => setFormData({ ...formData, equipe_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="" className="bg-gray-800">Aucune équipe</option>
                  {equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id} className="bg-gray-800">
                      {equipe.nom}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleOpenReusableModule('gestion-equipe')}
                  className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  Ouvrir {getModuleLabel('gestion-equipe')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Date de début</label>
                  <input
                    type="date"
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Date de fin prévue</label>
                  <input
                    type="date"
                    value={formData.date_fin_prevue}
                    onChange={(e) => setFormData({ ...formData, date_fin_prevue: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Budget prévisionnel (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.budget_previstoire}
                    onChange={(e) => setFormData({ ...formData, budget_previstoire: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Statut</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    {STATUTS_PROJET.map((statut) => (
                      <option key={statut.value} value={statut.value} className="bg-gray-800">
                        {statut.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2">Priorité</label>
                  <select
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    {PRIORITES.map((prio) => (
                      <option key={prio.value} value={prio.value} className="bg-gray-800">
                        {prio.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white mb-2">Couleur</label>
                  <input
                    type="color"
                    value={formData.couleur}
                    onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                    className="w-full h-10 bg-white/10 border border-white/20 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Notes internes..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingId ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des projets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projets.map((projet) => {
          const statutInfo = STATUTS_PROJET.find(s => s.value === projet.statut) || STATUTS_PROJET[0];
          const StatutIcon = statutInfo.icon;
          
          return (
            <div
              key={projet.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:border-blue-500/50 transition-all cursor-pointer"
              onClick={() => handleViewDetails(projet)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{projet.nom}</h3>
                  {projet.description && (
                    <p className="text-gray-400 text-sm line-clamp-2">{projet.description}</p>
                  )}
                </div>
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: projet.couleur || '#3B82F6' }}
                />
              </div>

              {/* Informations projet */}
              <div className="space-y-2 mb-4">
                {projet.client && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Building2 className="w-4 h-4" />
                    <span>{projet.client.entreprise_nom || `${projet.client.prenom} ${projet.client.nom}`}</span>
                  </div>
                )}
                {projet.responsable && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <User className="w-4 h-4" />
                    <span>{projet.responsable.prenom} {projet.responsable.nom}</span>
                  </div>
                )}
                {projet.equipe && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Shield className="w-4 h-4" />
                    <span>{projet.equipe.nom}</span>
                  </div>
                )}
                {projet.date_debut && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="w-4 h-4" />
                    <span>Début: {new Date(projet.date_debut).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {projet.budget_previstoire > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <DollarSign className="w-4 h-4" />
                    <span>{projet.budget_previstoire.toFixed(2)} €</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              {projet.stats && (
                <div className="mb-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Avancement</span>
                    <span className="text-white font-semibold">{Math.round(projet.stats.avancement_pct || 0)}%</span>
                  </div>
                  <div className="mt-2 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${projet.stats.avancement_pct || 0}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>{projet.stats.taches_terminees || 0}/{projet.stats.total_taches || 0} tâches</span>
                    <span>{projet.stats.jalons_termines || 0}/{projet.stats.total_jalons || 0} jalons</span>
                  </div>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    statutInfo.color === 'blue' ? 'bg-blue-500/20 text-blue-300' :
                    statutInfo.color === 'green' ? 'bg-green-500/20 text-green-300' :
                    statutInfo.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300' :
                    statutInfo.color === 'purple' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-red-500/20 text-red-300'
                  }`}
                >
                  <StatutIcon className="w-3 h-3" />
                  {statutInfo.label}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    projet.priorite === 'urgente' ? 'bg-red-500/20 text-red-300' :
                    projet.priorite === 'haute' ? 'bg-orange-500/20 text-orange-300' :
                    projet.priorite === 'moyenne' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {PRIORITES.find(p => p.value === projet.priorite)?.label || 'Moyenne'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEdit(projet)}
                  className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold"
                >
                  <Edit className="w-4 h-4 inline mr-2" />
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(projet.id)}
                  className="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {projets.length === 0 && !loading && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Briefcase className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun projet trouvé</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Créer votre premier projet
          </button>
        </div>
      )}

      {/* Modal détails projet */}
      {selectedProjet && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">{selectedProjet.nom}</h2>
              <button
                onClick={() => {
                  setSelectedProjet(null);
                  setShowJalons(false);
                  setShowTaches(false);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Onglets */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              <button
                onClick={() => {
                  setShowJalons(false);
                  setShowTaches(false);
                }}
                className={`px-4 py-2 border-b-2 transition-all ${
                  !showJalons && !showTaches
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Informations
              </button>
              <button
                onClick={async () => {
                  setShowJalons(true);
                  setShowTaches(false);
                  await loadJalons(selectedProjet.id);
                }}
                className={`px-4 py-2 border-b-2 transition-all flex items-center gap-2 ${
                  showJalons
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Target className="w-4 h-4" />
                Jalons ({jalons.length})
              </button>
              <button
                onClick={async () => {
                  setShowTaches(true);
                  setShowJalons(false);
                  await loadTaches(selectedProjet.id);
                }}
                className={`px-4 py-2 border-b-2 transition-all flex items-center gap-2 ${
                  showTaches
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Tâches ({taches.length})
              </button>
            </div>

            {/* Contenu selon l'onglet */}
            {!showJalons && !showTaches && (
              <div className="space-y-6">
                {/* Informations générales */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm">Statut</label>
                    <p className="text-white font-semibold">
                      {STATUTS_PROJET.find(s => s.value === selectedProjet.statut)?.label}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Priorité</label>
                    <p className="text-white font-semibold">
                      {PRIORITES.find(p => p.value === selectedProjet.priorite)?.label}
                    </p>
                  </div>
                  {selectedProjet.date_debut && (
                    <div>
                      <label className="text-gray-400 text-sm">Date de début</label>
                      <p className="text-white">{new Date(selectedProjet.date_debut).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  {selectedProjet.date_fin_prevue && (
                    <div>
                      <label className="text-gray-400 text-sm">Date de fin prévue</label>
                      <p className="text-white">{new Date(selectedProjet.date_fin_prevue).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-gray-400 text-sm">Budget prévisionnel</label>
                    <p className="text-white font-semibold">{selectedProjet.budget_previstoire.toFixed(2)} €</p>
                  </div>
                  {selectedProjet.budget_reel > 0 && (
                    <div>
                      <label className="text-gray-400 text-sm">Budget réel</label>
                      <p className="text-white font-semibold">{selectedProjet.budget_reel.toFixed(2)} €</p>
                    </div>
                  )}
                </div>

                {/* Stats */}
                {selectedProjet.stats && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-3">Statistiques</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm">Avancement</p>
                        <p className="text-white text-2xl font-bold">{Math.round(selectedProjet.stats.avancement_pct || 0)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Tâches terminées</p>
                        <p className="text-white text-2xl font-bold">
                          {selectedProjet.stats.taches_terminees || 0}/{selectedProjet.stats.total_taches || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Jalons terminés</p>
                        <p className="text-white text-2xl font-bold">
                          {selectedProjet.stats.jalons_termines || 0}/{selectedProjet.stats.total_jalons || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Heures estimées</p>
                        <p className="text-white text-2xl font-bold">{(selectedProjet.stats as any).total_heures_estimees || 0}h</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedProjet.notes && (
                  <div>
                    <label className="text-gray-400 text-sm">Notes</label>
                    <p className="text-white mt-1">{selectedProjet.notes}</p>
                  </div>
                )}
              </div>
            )}

            {showJalons && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Jalons</h3>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                    <Plus className="w-4 h-4 inline mr-2" />
                    Ajouter un jalon
                  </button>
                </div>
                {jalons.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucun jalon défini</p>
                ) : (
                  <div className="space-y-3">
                    {jalons.map((jalon) => (
                      <div key={jalon.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-semibold">{jalon.nom}</h4>
                            {jalon.description && (
                              <p className="text-gray-400 text-sm mt-1">{jalon.description}</p>
                            )}
                            <p className="text-gray-400 text-xs mt-2">
                              Date prévue: {new Date(jalon.date_prevue).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              jalon.statut === 'termine' ? 'bg-green-500/20 text-green-300' :
                              jalon.statut === 'en_cours' ? 'bg-blue-500/20 text-blue-300' :
                              jalon.statut === 'retarde' ? 'bg-red-500/20 text-red-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {jalon.statut === 'termine' ? 'Terminé' :
                             jalon.statut === 'en_cours' ? 'En cours' :
                             jalon.statut === 'retarde' ? 'Retardé' :
                             'À venir'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showTaches && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Tâches</h3>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                    <Plus className="w-4 h-4 inline mr-2" />
                    Ajouter une tâche
                  </button>
                </div>
                {taches.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucune tâche définie</p>
                ) : (
                  <div className="space-y-3">
                    {taches.map((tache) => (
                      <div key={tache.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-semibold">{tache.nom}</h4>
                            {tache.description && (
                              <p className="text-gray-400 text-sm mt-1">{tache.description}</p>
                            )}
                            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
                              {tache.collaborateur && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {tache.collaborateur.prenom} {tache.collaborateur.nom}
                                </span>
                              )}
                              {tache.equipe && (
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  {tache.equipe.nom}
                                </span>
                              )}
                              {tache.date_fin_prevue && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(tache.date_fin_prevue).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                              {tache.duree_estimee_heures > 0 && (
                                <span>{tache.duree_estimee_heures}h estimées</span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              tache.statut === 'termine' ? 'bg-green-500/20 text-green-300' :
                              tache.statut === 'en_cours' ? 'bg-blue-500/20 text-blue-300' :
                              tache.statut === 'bloque' ? 'bg-red-500/20 text-red-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {tache.statut === 'termine' ? 'Terminé' :
                             tache.statut === 'en_cours' ? 'En cours' :
                             tache.statut === 'bloque' ? 'Bloqué' :
                             'À faire'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

