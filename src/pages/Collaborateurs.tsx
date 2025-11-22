import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Shield, Plus, X, Building2, Mail, Trash2, Crown } from 'lucide-react';

interface CollaborateursProps {
  onNavigate: (page: string) => void;
}

interface User {
  id: string;
  email: string;
  role: string;
  entreprise_id?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  statut: string;
  created_at: string;
  entreprise_nom?: string;
}

export default function Collaborateurs({ onNavigate: _onNavigate }: CollaborateursProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'collaborateur' as 'collaborateur' | 'admin',
    entreprise_id: '',
  });

  useEffect(() => {
    checkSuperAdmin();
    if (isSuperAdmin) {
      loadEntreprises();
      loadUsers();
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (entreprises.length > 0 && !formData.entreprise_id) {
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
  }, [entreprises]);

  const checkSuperAdmin = async () => {
    if (!user) return;

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

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(`
          *,
          entreprise:entreprises(id, nom)
        `)
        .in('role', ['collaborateur', 'admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrichir avec le nom de l'entreprise
      const usersEnriched = (data || []).map((u: any) => ({
        ...u,
        entreprise_nom: u.entreprise?.nom,
      }));

      setUsers(usersEnriched);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCollaborateur = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Créer l'utilisateur dans auth.users via Supabase Admin API
      // Note: Cela nécessite l'API Admin qui doit être appelée côté serveur
      // Pour l'instant, on utilise une fonction RPC si elle existe

      const { error } = await supabase.rpc('create_collaborateur', {
        p_email: formData.email,
        p_password: formData.password,
        p_nom: formData.nom || null,
        p_prenom: formData.prenom || null,
        p_telephone: formData.telephone || null,
        p_role: formData.role,
        p_entreprise_id: formData.entreprise_id || null,
      });

      if (error) {
        if (error.message.includes('does not exist')) {
          alert(
            '⚠️ Création de collaborateur nécessite l\'API Supabase Admin\n\n' +
              'Pour créer un collaborateur:\n' +
              '1. Utilisez la page Administration\n' +
              '2. Ou créez une fonction RPC create_collaborateur dans Supabase'
          );
          return;
        }
        throw error;
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
      });
      loadUsers();
    } catch (error: any) {
      console.error('Erreur création collaborateur:', error);
      alert('❌ Erreur lors de la création: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
      const { error } = await supabase.from('utilisateurs').delete().eq('id', userId);

      if (error) throw error;

      alert('✅ Utilisateur supprimé avec succès');
      loadUsers();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'));
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

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Collaborateurs</h1>
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

      {/* Liste des collaborateurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {u.prenom} {u.nom}
                  </h3>
                  <p className="text-sm text-gray-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.role === 'admin' && <Crown className="w-5 h-5 text-yellow-400" />}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    u.role === 'admin'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {u.role === 'admin' ? 'Admin' : 'Collaborateur'}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {u.telephone && (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Mail className="w-4 h-4" />
                  {u.telephone}
                </div>
              )}
              {u.entreprise_nom && (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Building2 className="w-4 h-4" />
                  {u.entreprise_nom}
                </div>
              )}
              <div
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  u.statut === 'active'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {u.statut === 'active' ? 'Actif' : 'Suspendu'}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={() => handleDelete(u.id)}
                className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun collaborateur trouvé</p>
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'collaborateur' | 'admin' })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                </select>
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

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-xs text-yellow-300">
                  ⚠️ La création de collaborateur nécessite l'API Supabase Admin. 
                  Si cette fonctionnalité n'est pas disponible, utilisez la page Administration pour créer des collaborateurs manuellement.
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
    </div>
  );
}

