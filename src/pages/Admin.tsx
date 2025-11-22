import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Shield, Plus, Trash2, Edit } from 'lucide-react';

interface AdminProps {
  onNavigate: (page: string) => void;
}

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function Admin({ onNavigate: _onNavigate }: AdminProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: 'meddecyril@icloud.com',
    password: '21052024_Aa!',
    role: 'super_admin',
  });

  useEffect(() => {
    checkSuperAdmin();
    if (isSuperAdmin) {
      loadUsers();
    }
  }, [user, isSuperAdmin]);

  const checkSuperAdmin = async () => {
    if (!user) return;

    try {
      // Vérifier le rôle dans les métadonnées
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      
      setIsSuperAdmin(role === 'super_admin' || role === 'admin');
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Appeler une fonction Supabase Edge Function ou utiliser SQL
      // Pour l'instant, on va créer directement via l'interface admin
      setUsers([]);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Créer l'utilisateur via Supabase Auth Admin API
      // Note: Cela nécessite une Edge Function ou l'utilisation de l'API d'administration
      // Pour l'instant, on va afficher les instructions

      alert(`
        Pour créer un Super Admin:
        
        1. L'utilisateur doit d'abord créer un compte normal dans l'application
        2. Ensuite, exécutez le script SQL dans Supabase:
        
        SELECT create_super_admin('${formData.email}');
        
        Le script est dans: supabase/migrations/20250122000002_create_super_admin.sql
      `);

      setShowForm(false);
    } catch (error) {
      console.error('Erreur création super admin:', error);
      alert('Erreur lors de la création. Voir la console pour plus de détails.');
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
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Créer Super Admin
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">📋 Instructions de création</h3>
        <div className="text-gray-300 space-y-2 text-sm">
          <p><strong>Email :</strong> meddecyril@icloud.com</p>
          <p><strong>Mot de passe :</strong> 21052024_Aa!</p>
          <ol className="list-decimal list-inside space-y-1 ml-2 mt-4">
            <li>L'utilisateur doit d'abord créer un compte normal via l'interface d'inscription</li>
            <li>Ensuite, allez dans Supabase → SQL Editor</li>
            <li>Exécutez le script : <code className="bg-white/10 px-2 py-1 rounded">supabase/migrations/20250122000002_create_super_admin.sql</code></li>
            <li>Ou exécutez directement : <code className="bg-white/10 px-2 py-1 rounded">SELECT create_super_admin('meddecyril@icloud.com');</code></li>
          </ol>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">Utilisateurs</h2>
        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            users.map((userItem) => (
              <div
                key={userItem.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{userItem.email}</p>
                    <p className="text-sm text-gray-400">
                      Rôle: <span className="text-blue-400">{userItem.role || 'client'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userItem.role !== 'super_admin' && (
                    <button
                      onClick={() => {}}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-sm"
                    >
                      Promouvoir
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Formulaire Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Créer Super Admin</h2>
            
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm">
                ⚠️ Pour créer un Super Admin, l'utilisateur doit d'abord créer un compte normal, 
                puis exécuter le script SQL dans Supabase.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-white font-medium mb-2">Script SQL à exécuter dans Supabase:</p>
                <code className="block bg-black/30 p-3 rounded text-sm text-green-400 break-all">
                  SELECT create_super_admin('{formData.email}');
                </code>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={createSuperAdmin}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Afficher Instructions
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

