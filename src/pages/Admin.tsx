import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Shield, Plus, X, Building2, Mail } from 'lucide-react';

interface AdminProps {
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

export default function Admin({ onNavigate: _onNavigate }: AdminProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'super_admin' | 'collaborateur'>('collaborateur');
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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      
      setIsSuperAdmin(role === 'super_admin' || role === 'admin');
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
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
      const { data, error } = await supabase
        .from('utilisateurs')
        .select(`
          *,
          entreprise:entreprises(id, nom)
        `)
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
    if (!user || !formData.email || !formData.password) {
      alert('Veuillez remplir tous les champs obligatoires (email et mot de passe)');
      return;
    }

    if (formData.password.length < 8) {
      alert('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      // Note: La création d'utilisateurs dans auth.users nécessite l'API Supabase Admin
      // Pour l'instant, on va afficher les instructions pour utiliser une Edge Function
      // ou créer l'utilisateur directement via Supabase Admin API
      
      alert(`
        ⚠️ Création de collaborateur nécessite l'API Supabase Admin
        
        Pour créer un collaborateur:
        
        1. Utilisez l'API Supabase Admin (service_role key)
        2. Ou créez une Edge Function pour créer l'utilisateur
        3. L'utilisateur sera ensuite synchronisé dans la table utilisateurs
        
        Email: ${formData.email}
        Rôle: ${formData.role}
        Entreprise: ${formData.entreprise_id ? entreprises.find(e => e.id === formData.entreprise_id)?.nom : 'N/A'}
      `);

      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Erreur création collaborateur:', error);
      alert('Erreur lors de la création. Voir la console pour plus de détails.');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      nom: '',
      prenom: '',
      telephone: '',
      role: 'collaborateur',
      entreprise_id: entreprises.length > 0 ? entreprises[0].id : '',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-500/20 text-purple-400';
      case 'admin':
        return 'bg-blue-500/20 text-blue-400';
      case 'collaborateur':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!user) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-white">Vous devez être connecté pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Accès Refusé</h2>
          <p className="text-gray-300 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <p className="text-gray-400 text-sm">
            Cette page est réservée aux Super Administrateurs.
          </p>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Administration</h1>
          <p className="text-gray-300">Gestion des utilisateurs et des rôles</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setFormType('collaborateur');
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Créer Collaborateur
          </button>
        </div>
      </div>

      {/* Instructions pour Super Admin */}
      <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">👑 Super Admin</h3>
        <div className="text-gray-300 space-y-2 text-sm">
          <p>Pour créer un Super Admin:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>L'utilisateur crée un compte normal via l'interface d'inscription</li>
            <li>Exécutez dans Supabase SQL Editor: <code className="bg-white/10 px-2 py-1 rounded">SELECT create_super_admin('email@example.com');</code></li>
          </ol>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">Utilisateurs ({users.length})</h2>
        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            users.map((userItem) => (
              <div
                key={userItem.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-white font-medium">
                        {userItem.prenom && userItem.nom
                          ? `${userItem.prenom} ${userItem.nom}`
                          : userItem.email}
                      </p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(userItem.role)}`}>
                        {userItem.role}
                      </span>
                      {userItem.statut !== 'active' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          {userItem.statut}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {userItem.email}
                      </span>
                      {userItem.entreprise_nom && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {userItem.entreprise_nom}
                        </span>
                      )}
                      {userItem.telephone && (
                        <span>{userItem.telephone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Formulaire Modal - Créer Collaborateur */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Créer un Collaborateur
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createCollaborateur} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jean"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="collaborateur@entreprise.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 8 caractères"
                />
                <p className="text-xs text-gray-400 mt-1">Le mot de passe sera envoyé par email au collaborateur</p>
              </div>

              {entreprises.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Entreprise *
                  </label>
                  <select
                    value={formData.entreprise_id}
                    onChange={(e) => setFormData({ ...formData, entreprise_id: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rôle *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'collaborateur' | 'admin' })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Admin Entreprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mt-6">
                <p className="text-yellow-200 text-sm">
                  ⚠️ La création de collaborateur nécessite l'API Supabase Admin. 
                  Pour l'instant, cette fonctionnalité affichera les instructions de création.
                  Une Edge Function ou l'utilisation directe de l'API Admin sera nécessaire.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
                >
                  Créer le Collaborateur
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
