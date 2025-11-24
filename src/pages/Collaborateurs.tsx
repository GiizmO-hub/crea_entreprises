import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Shield, Plus, X, Building2, Mail, Trash2, Crown, Search, Filter, Grid, List, Edit, Ban, CheckCircle } from 'lucide-react';

interface CollaborateursProps {
  onNavigate: (page: string) => void;
}

interface Collaborateur {
  id: string;
  user_id: string;
  email: string;
  role: string;
  entreprise_id?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  departement?: string;
  poste?: string;
  statut: string;
  date_embauche?: string;
  salaire?: number;
  created_at: string;
  entreprise_nom?: string;
}

export default function Collaborateurs() {
  const { user } = useAuth();
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCollaborateur, setEditingCollaborateur] = useState<Collaborateur | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'collaborateur' as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial' | 'super_admin',
    entreprise_id: '',
    departement: '',
    poste: '',
    date_embauche: '',
    salaire: '',
  });

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    if (isSuperAdmin && user) {
      loadEntreprises();
      loadCollaborateurs();
    }
  }, [isSuperAdmin, user]);

  useEffect(() => {
    if (entreprises.length > 0 && !formData.entreprise_id) {
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
  }, [entreprises]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      // Vérifier le rôle dans la table utilisateurs (source de vérité)
      const { data: utilisateur, error } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        console.log('✅ Rôle vérifié dans utilisateurs:', utilisateur.role, '-> isSuperAdmin:', isAdmin);
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Fallback: vérifier dans user_metadata si la table utilisateurs n'est pas accessible
      console.warn('⚠️ Impossible de lire utilisateurs, fallback sur user_metadata:', error);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      console.log('✅ Rôle vérifié dans user_metadata:', role, '-> isSuperAdmin:', isAdmin);
      setIsSuperAdmin(isAdmin);
    } catch (error) {
      console.error('❌ Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
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

  const loadCollaborateurs = async () => {
    try {
      setLoading(true);
      console.log('🔄 Chargement des collaborateurs...');
      
      const { data, error } = await supabase
        .from('collaborateurs')
        .select(`
          *,
          entreprise:entreprises(id, nom)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        
        // Gestion spécifique des erreurs
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          console.warn('⚠️ Table collaborateurs n\'existe pas encore. Appliquez la migration SQL.');
          setCollaborateurs([]);
          return;
        }
        
        if (error.message?.includes('permission denied') || error.code === '42501') {
          console.error('❌ Erreur de permissions RLS. Appliquez la migration de correction.');
          alert('Erreur de permissions. Veuillez appliquer la migration SQL de correction des permissions RLS.');
          setCollaborateurs([]);
          return;
        }
        
        throw error;
      }

      console.log('✅ Collaborateurs chargés:', data?.length || 0);

      interface CollaborateurData {
        id: string;
        email: string;
        entreprise?: { nom: string };
        [key: string]: unknown;
      }
      
      // Enrichir avec le nom de l'entreprise
      const collaborateursEnriched = (data || []).map((c: CollaborateurData) => ({
        ...c,
        entreprise_nom: c.entreprise?.nom,
      }));

      setCollaborateurs(collaborateursEnriched || []);
    } catch (error: unknown) {
      console.error('❌ Erreur chargement collaborateurs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('Erreur lors du chargement des collaborateurs: ' + errorMessage);
      setCollaborateurs([]);
    } finally {
      setLoading(false);
    }
  };

  const createCollaborateur = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Appeler la fonction RPC qui crée automatiquement dans auth.users, utilisateurs et collaborateurs
      const { data, error } = await supabase.rpc('create_collaborateur', {
        p_email: formData.email,
        p_password: formData.password,
        p_nom: formData.nom || null,
        p_prenom: formData.prenom || null,
        p_telephone: formData.telephone || null,
        p_role: formData.role,
        p_entreprise_id: formData.entreprise_id || null,
        p_departement: formData.departement || null,
        p_poste: formData.poste || null,
        p_date_embauche: formData.date_embauche || null,
        p_salaire: formData.salaire ? parseFloat(formData.salaire) : null,
      });

      if (error) {
        throw error;
      }

      // Vérifier le résultat
      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur créé avec succès!');
      setShowForm(false);
      setFormData({
        email: '',
        password: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'collaborateur',
        entreprise_id: formData.entreprise_id,
        departement: '',
        poste: '',
        date_embauche: '',
        salaire: '',
      });
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur création collaborateur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la création: ' + errorMessage);
    }
  };

  const handleEdit = (collaborateur: Collaborateur) => {
    setEditingCollaborateur(collaborateur);
    setFormData({
      email: collaborateur.email,
      password: '', // Ne pas afficher le mot de passe
      nom: collaborateur.nom || '',
      prenom: collaborateur.prenom || '',
      telephone: collaborateur.telephone || '',
      role: collaborateur.role,
      entreprise_id: collaborateur.entreprise_id || '',
      departement: collaborateur.departement || '',
      poste: collaborateur.poste || '',
      date_embauche: collaborateur.date_embauche || '',
      salaire: collaborateur.salaire?.toString() || '',
    });
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollaborateur) return;

    try {
      const { data, error } = await supabase.rpc('update_collaborateur', {
        p_collaborateur_id: editingCollaborateur.id,
        p_nom: formData.nom || null,
        p_prenom: formData.prenom || null,
        p_telephone: formData.telephone || null,
        p_role: formData.role || null,
        p_entreprise_id: formData.entreprise_id || null,
        p_departement: formData.departement || null,
        p_poste: formData.poste || null,
        p_date_embauche: formData.date_embauche || null,
        p_salaire: formData.salaire ? parseFloat(formData.salaire) : null,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur modifié avec succès!');
      setShowEditForm(false);
      setEditingCollaborateur(null);
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur modification:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la modification: ' + errorMessage);
    }
  };

  const handleSuspend = async (collaborateurId: string, collaborateurNom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir suspendre ${collaborateurNom} ? Il ne pourra plus accéder à l'application.`)) return;

    try {
      const { data, error } = await supabase.rpc('suspendre_collaborateur', {
        p_collaborateur_id: collaborateurId,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur suspendu avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur suspension:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la suspension: ' + errorMessage);
    }
  };

  const handleActivate = async (collaborateurId: string, collaborateurNom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir activer ${collaborateurNom} ? Il pourra à nouveau accéder à l'application.`)) return;

    try {
      const { data, error } = await supabase.rpc('activer_collaborateur', {
        p_collaborateur_id: collaborateurId,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur activé avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur activation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de l\'activation: ' + errorMessage);
    }
  };

  const handleDelete = async (collaborateurId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce collaborateur ? Cette action supprimera également son compte utilisateur.')) return;

    try {
      const { data, error } = await supabase.rpc('delete_collaborateur_complete', {
        p_collaborateur_id: collaborateurId,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur supprimé avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur suppression:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la suppression: ' + errorMessage);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-gray-300">Vous devez être super administrateur pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  // Filtrer les collaborateurs
  const filteredCollaborateurs = collaborateurs.filter((c) => {
    const matchesSearch = searchTerm === '' || 
      `${c.prenom} ${c.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.poste?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.departement?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || c.role === filterRole;
    const matchesStatut = filterStatut === 'all' || c.statut === filterStatut;
    
    return matchesSearch && matchesRole && matchesStatut;
  });

  // Statistiques
  const stats = {
    total: collaborateurs.length,
    actifs: collaborateurs.filter(c => c.statut === 'active').length,
    parRole: {
      collaborateur: collaborateurs.filter(c => c.role === 'collaborateur').length,
      admin: collaborateurs.filter(c => c.role === 'admin' || c.role === 'super_admin').length,
      manager: collaborateurs.filter(c => c.role === 'manager').length,
      comptable: collaborateurs.filter(c => c.role === 'comptable').length,
      commercial: collaborateurs.filter(c => c.role === 'commercial').length,
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'collaborateur': 'Collaborateur',
      'manager': 'Manager',
      'comptable': 'Comptable',
      'commercial': 'Commercial'
    };
    return labels[role] || role;
  };

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Modules</h1>
          <p className="text-gray-300">Gestion des collaborateurs et administrateurs</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Créer Collaborateur
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total</p>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Actifs</p>
              <p className="text-3xl font-bold text-green-400">{stats.actifs}</p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Admins</p>
              <p className="text-3xl font-bold text-yellow-400">{stats.parRole.admin}</p>
            </div>
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Collaborateurs</p>
              <p className="text-3xl font-bold text-blue-400">{stats.parRole.collaborateur}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, poste, département..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          
          {/* Filtre Rôle */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="collaborateur">Collaborateur</option>
              <option value="manager">Manager</option>
              <option value="comptable">Comptable</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {/* Filtre Statut */}
          <div className="relative">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="pl-4 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="suspendue">Suspendu</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>

          {/* Mode d'affichage */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Résultats de recherche */}
        {searchTerm && (
          <div className="mt-3 text-sm text-gray-400">
            {filteredCollaborateurs.length} résultat(s) trouvé(s) pour "{searchTerm}"
          </div>
        )}
      </div>

      {/* Liste des collaborateurs - Vue Grille */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollaborateurs.map((c) => (
          <div
            key={c.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {c.prenom} {c.nom}
                  </h3>
                  <p className="text-sm text-gray-400">{c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(c.role === 'admin' || c.role === 'super_admin') && <Crown className="w-5 h-5 text-yellow-400" />}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    c.role === 'admin' || c.role === 'super_admin'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : c.role === 'manager'
                      ? 'bg-purple-500/20 text-purple-300'
                      : c.role === 'comptable'
                      ? 'bg-green-500/20 text-green-300'
                      : c.role === 'commercial'
                      ? 'bg-orange-500/20 text-orange-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {getRoleLabel(c.role)}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {c.poste && (
                <div className="text-gray-300 text-sm font-medium">
                  {c.poste}
                </div>
              )}
              {c.departement && (
                <div className="text-gray-400 text-xs">
                  Département: {c.departement}
                </div>
              )}
              {c.telephone && (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Mail className="w-4 h-4" />
                  {c.telephone}
                </div>
              )}
              {c.entreprise_nom && (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Building2 className="w-4 h-4" />
                  {c.entreprise_nom}
                </div>
              )}
              {c.salaire && (
                <div className="text-gray-300 text-sm">
                  Salaire: {c.salaire.toFixed(2)}€
                </div>
              )}
              <div
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  c.statut === 'active'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {c.statut === 'active' ? 'Actif' : c.statut === 'suspendue' ? 'Suspendu' : 'Inactif'}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={() => handleEdit(c)}
                className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center justify-center gap-2"
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              {c.statut === 'active' ? (
                <button
                  onClick={() => handleSuspend(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                  className="flex-1 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-all flex items-center justify-center gap-2"
                  title="Suspendre"
                >
                  <Ban className="w-4 h-4" />
                  Suspendre
                </button>
              ) : (
                <button
                  onClick={() => handleActivate(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                  className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex items-center justify-center gap-2"
                  title="Activer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Activer
                </button>
              )}
              <button
                onClick={() => handleDelete(c.id)}
                className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center justify-center gap-2"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      {/* Liste des collaborateurs - Vue Liste */}
      {viewMode === 'list' && (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Collaborateur</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Poste</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Entreprise</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredCollaborateurs.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {c.prenom} {c.nom}
                          </div>
                          <div className="text-sm text-gray-400">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {(c.role === 'admin' || c.role === 'super_admin') && <Crown className="w-4 h-4 text-yellow-400" />}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            c.role === 'admin' || c.role === 'super_admin'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : c.role === 'manager'
                              ? 'bg-purple-500/20 text-purple-300'
                              : c.role === 'comptable'
                              ? 'bg-green-500/20 text-green-300'
                              : c.role === 'commercial'
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {getRoleLabel(c.role)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{c.poste || '-'}</div>
                      {c.departement && (
                        <div className="text-xs text-gray-400">{c.departement}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {c.entreprise_nom ? (
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {c.entreprise_nom}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {c.telephone ? (
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {c.telephone}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          c.statut === 'active'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {c.statut === 'active' ? 'Actif' : c.statut === 'suspendue' ? 'Suspendu' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(c)}
                          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {c.statut === 'active' ? (
                          <button
                            onClick={() => handleSuspend(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                            className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                            title="Suspendre"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                            className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                            title="Activer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && collaborateurs.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">Aucun collaborateur trouvé</p>
          <p className="text-gray-500 text-sm mb-4">
            {isSuperAdmin 
              ? 'Créez votre premier collaborateur en cliquant sur le bouton "Créer Collaborateur" ci-dessus.'
              : 'La table collaborateurs n\'existe peut-être pas encore. Vérifiez que la migration SQL a été appliquée.'}
          </p>
          {isSuperAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
            >
              Créer un Collaborateur
            </button>
          )}
        </div>
      )}

      {/* Formulaire Modal - Créer Collaborateur */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Créer un Collaborateur</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createCollaborateur} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="collaborateur@entreprise.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-400 mt-1">Le mot de passe sera envoyé par email au collaborateur</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rôle *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                  <option value="manager">Manager</option>
                  <option value="comptable">Comptable</option>
                  <option value="commercial">Commercial</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Département</label>
                <input
                  type="text"
                  value={formData.departement}
                  onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: IT, Finance, Ventes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Poste</label>
                <input
                  type="text"
                  value={formData.poste}
                  onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: Développeur, Comptable, Commercial..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date d'embauche</label>
                  <input
                    type="date"
                    value={formData.date_embauche}
                    onChange={(e) => setFormData({ ...formData, date_embauche: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Salaire (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salaire}
                    onChange={(e) => setFormData({ ...formData, salaire: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                <select
                  value={formData.entreprise_id}
                  onChange={(e) => setFormData({ ...formData, entreprise_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Aucune entreprise</option>
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-300">
                  ✅ La création est automatique : compte auth.users, utilisateurs et collaborateurs seront créés en une seule opération.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  Créer le Collaborateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire Modal - Modifier Collaborateur */}
      {showEditForm && editingCollaborateur && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Modifier un Collaborateur</h2>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingCollaborateur(null);
                }}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">L'email ne peut pas être modifié</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rôle *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                  <option value="manager">Manager</option>
                  <option value="comptable">Comptable</option>
                  <option value="commercial">Commercial</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Département</label>
                <input
                  type="text"
                  value={formData.departement}
                  onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: IT, Finance, Ventes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Poste</label>
                <input
                  type="text"
                  value={formData.poste}
                  onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: Développeur, Comptable, Commercial..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                <select
                  value={formData.entreprise_id}
                  onChange={(e) => setFormData({ ...formData, entreprise_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Aucune entreprise</option>
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date d'embauche</label>
                  <input
                    type="date"
                    value={formData.date_embauche}
                    onChange={(e) => setFormData({ ...formData, date_embauche: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Salaire (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salaire}
                    onChange={(e) => setFormData({ ...formData, salaire: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingCollaborateur(null);
                  }}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

