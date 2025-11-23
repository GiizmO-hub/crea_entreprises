import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Users, Edit, Trash2, Search, Building2, X, Key, Mail, UserPlus, Copy, Check, Shield, ShieldOff } from 'lucide-react';

interface Client {
  id: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  statut: string;
  created_at: string;
}

interface ClientsProps {
  onNavigate: (page: string) => void;
}

export default function Clients({ onNavigate: _onNavigate }: ClientsProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [plans, setPlans] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [options, setOptions] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [showEspaceMembreModal, setShowEspaceMembreModal] = useState(false);
  const [showIdentifiantsModal, setShowIdentifiantsModal] = useState(false);
  const [selectedClientForEspace, setSelectedClientForEspace] = useState<Client | null>(null);
  const [clientCredentials, setClientCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [clientSuperAdminStatus, setClientSuperAdminStatus] = useState<Record<string, boolean>>({});
  const [espaceMembreData, setEspaceMembreData] = useState({
    password: '',
    plan_id: '',
    options_ids: [] as string[],
  });
  const [formData, setFormData] = useState({
    entreprise_id: '',
    nom: '',
    prenom: '',
    entreprise_nom: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    siret: '',
  });

  useEffect(() => {
    if (user) {
      loadEntreprises();
      loadClients();
      loadPlans();
      loadOptions();
      loadClientSuperAdminStatus();
    }
  }, [user]);

  // Recharger le statut super_admin quand les clients changent
  useEffect(() => {
    if (clients.length > 0) {
      loadClientSuperAdminStatus();
    }
  }, [clients.length, selectedEntreprise]);

  const loadClientSuperAdminStatus = async () => {
    if (!user) return;
    
    try {
      // Récupérer les entreprises de l'utilisateur pour filtrer les clients
      const { data: userEntreprises, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('id')
        .eq('user_id', user.id);

      if (entrepriseError) {
        console.error('Erreur chargement entreprises pour statut super_admin:', entrepriseError);
        return;
      }

      if (!userEntreprises || userEntreprises.length === 0) {
        setClientSuperAdminStatus({});
        return;
      }

      const entrepriseIds = userEntreprises.map(e => e.id);

      // Charger le statut super_admin de tous les clients qui ont un espace membre
      const { data: espaces, error } = await supabase
        .from('espaces_membres_clients')
        .select(`
          client_id,
          user_id,
          entreprise_id,
          clients!inner(id)
        `)
        .in('entreprise_id', entrepriseIds);

      if (error) {
        console.error('Erreur chargement statut super_admin:', error);
        return;
      }

      console.log('🔍 Espaces membres trouvés:', espaces?.length || 0);

      if (espaces && espaces.length > 0) {
        const userIds = espaces.map(e => e.user_id).filter(Boolean) as string[];
        
        if (userIds.length > 0) {
          const { data: utilisateurs, error: utilisateursError } = await supabase
            .from('utilisateurs')
            .select('id, role')
            .in('id', userIds);

          if (utilisateursError) {
            console.error('Erreur chargement utilisateurs:', utilisateursError);
            return;
          }

          console.log('👥 Utilisateurs trouvés:', utilisateurs?.length || 0);

          const statusMap: Record<string, boolean> = {};
          espaces.forEach(espace => {
            if (espace.client_id && espace.user_id) {
              const utilisateur = utilisateurs?.find(u => u.id === espace.user_id);
              const isSuperAdmin = utilisateur?.role === 'super_admin' || false;
              statusMap[espace.client_id] = isSuperAdmin;
              console.log(`📋 Client ${espace.client_id}: super_admin = ${isSuperAdmin}`);
            }
          });
          
          console.log('✅ Statut super_admin chargé:', statusMap);
          setClientSuperAdminStatus(statusMap);
        } else {
          setClientSuperAdminStatus({});
        }
      } else {
        setClientSuperAdminStatus({});
      }
    } catch (error) {
      console.error('Erreur chargement statut super_admin:', error);
    }
  };

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      setSelectedEntreprise(entreprises[0].id);
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
  }, [entreprises]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('entreprises')
        .select('id, nom')
        .eq('user_id', user.id)
        .order('nom');

      setEntreprises(data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans_abonnement')
        .select('id, nom, prix_mensuel')
        .eq('actif', true)
        .order('ordre');

      if (error) throw error;
      setPlans(data || []);
      if (data && data.length > 0 && !espaceMembreData.plan_id) {
        setEspaceMembreData((prev) => ({ ...prev, plan_id: data[0].id }));
      }
    } catch (error) {
      console.error('Erreur chargement plans:', error);
    }
  };

  const loadOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('options_supplementaires')
        .select('id, nom, prix_mensuel')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Erreur chargement options:', error);
    }
  };

  const loadClients = async () => {
    if (!user) return;

    try {
      // Récupérer d'abord les entreprises de l'utilisateur pour filtrer les clients
      const { data: userEntreprises, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('id')
        .eq('user_id', user.id);

      if (entrepriseError) throw entrepriseError;

      if (!userEntreprises || userEntreprises.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const entrepriseIds = userEntreprises.map(e => e.id);
      
      let query = supabase
        .from('clients')
        .select('*')
        .in('entreprise_id', entrepriseIds)
        .order('created_at', { ascending: false });

      // Filtrer par entreprise sélectionnée si spécifiée
      if (selectedEntreprise && entrepriseIds.includes(selectedEntreprise)) {
        query = query.eq('entreprise_id', selectedEntreprise);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEntreprise) {
      loadClients();
    }
  }, [selectedEntreprise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        nom: formData.nom || null,
        prenom: formData.prenom || null,
        entreprise_nom: formData.entreprise_nom || null,
        email: formData.email || null,
        telephone: formData.telephone || null,
        adresse: formData.adresse || null,
        code_postal: formData.code_postal || null,
        ville: formData.ville || null,
        siret: formData.siret || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        alert('Client modifié avec succès!');
      } else {
        const { error } = await supabase.from('clients').insert([dataToSave]);
        if (error) throw error;
        alert('Client créé avec succès!');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadClients();
    } catch (error: any) {
      console.error('Erreur sauvegarde client:', error);
      const errorMessage = error?.message || 'Erreur lors de la sauvegarde';
      alert(`Erreur: ${errorMessage}`);
    }
  };

  const handleCreateEspaceMembre = async () => {
    if (!selectedClientForEspace || !selectedEntreprise) return;

    // Validation
    if (!selectedClientForEspace.email) {
      alert('Le client doit avoir un email pour créer un espace membre');
      return;
    }
    // Le mot de passe est optionnel - sera généré automatiquement si vide
    if (espaceMembreData.password && espaceMembreData.password.length > 0 && espaceMembreData.password.length < 8) {
      alert('Le mot de passe doit contenir au moins 8 caractères s\'il est fourni');
      return;
    }
    if (!espaceMembreData.plan_id) {
      alert('Veuillez sélectionner un plan d\'abonnement');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_espace_membre_from_client', {
        p_client_id: selectedClientForEspace.id,
        p_entreprise_id: selectedEntreprise,
        p_password: espaceMembreData.password || null, // null si vide pour génération auto
        p_plan_id: espaceMembreData.plan_id,
        p_options_ids: espaceMembreData.options_ids.length > 0 ? espaceMembreData.options_ids : [],
      });

      if (error) throw error;

      if (data?.success) {
        // Recharger les clients pour afficher les mises à jour
        loadClients();
        
        // Debug: afficher les données retournées
        console.log('📧 Données retournées par create_espace_membre_from_client:', data);
        
        // Vérifier que le mot de passe est bien retourné
        if (!data.password) {
          console.error('❌ ERREUR: Le mot de passe n\'est pas retourné par la fonction SQL');
          console.log('Données complètes:', JSON.stringify(data, null, 2));
        }
        
        // Afficher les identifiants (le mot de passe est maintenant TOUJOURS retourné)
        setClientCredentials({
          email: data.email || selectedClientForEspace.email,
          password: data.password || '⚠️ ERREUR: Mot de passe non retourné - Veuillez réessayer ou contacter le support',
        });
        setShowEspaceMembreModal(false);
        setShowIdentifiantsModal(true);
        setEspaceMembreData({ password: '', plan_id: plans.length > 0 ? plans[0].id : '', options_ids: [] });
        setSelectedClientForEspace(null);
      } else {
        alert('Erreur: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: any) {
      console.error('Erreur création espace membre:', error);
      
      // Détecter automatiquement l'erreur et suggérer la solution
      const errorMessage = error?.message || error?.toString() || '';
      
      if (errorMessage.includes('mode_paiement') || errorMessage.includes('abonnements') && errorMessage.includes('does not exist')) {
        const sqlFix = `-- Correction rapide
ALTER TABLE abonnements 
ADD COLUMN IF NOT EXISTS mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));`;
        
        alert(
          `🔧 Erreur détectée: Table ou colonne "abonnements.mode_paiement" manquante\n\n` +
          `📋 SOLUTION:\n` +
          `1. Ouvrez Supabase SQL Editor\n` +
          `2. Exécutez la migration:\n` +
          `   supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql\n\n` +
          `💡 Correction rapide (copiez dans SQL Editor):\n\n` +
          sqlFix
        );
      } else if (errorMessage.includes('date_activation')) {
        const sqlFix = `-- Correction rapide: Ajouter date_activation
ALTER TABLE abonnement_options 
ADD COLUMN IF NOT EXISTS date_activation date DEFAULT CURRENT_DATE;`;
        
        alert(
          `🔧 Erreur détectée: Colonne "date_activation" manquante dans "abonnement_options"\n\n` +
          `📋 SOLUTION:\n` +
          `1. Ouvrez Supabase SQL Editor\n` +
          `2. Exécutez la migration:\n` +
          `   supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql\n\n` +
          `💡 Correction rapide (copiez dans SQL Editor):\n\n` +
          sqlFix
        );
      } else if (errorMessage.includes('gen_salt')) {
        alert(
          `🔧 Erreur détectée: Extension pgcrypto non activée\n\n` +
          `📋 SOLUTION:\n` +
          `Exécutez dans Supabase SQL Editor:\n\n` +
          `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
        );
      } else {
        alert(`Erreur: ${error.message || 'Erreur lors de la création de l\'espace membre'}\n\n` +
              `💡 Vérifiez que toutes les migrations sont appliquées dans Supabase SQL Editor.`);
      }
    }
  };

  const handleGetCredentials = async (client: Client) => {
    try {
      const { data, error } = await supabase.rpc('get_client_credentials', {
        p_client_id: client.id,
      });

      if (error) throw error;

      if (data?.success) {
        // Pour l'instant, on affiche seulement l'email
        // Le mot de passe ne peut pas être récupéré pour des raisons de sécurité
        // Il faudra le régénérer ou le demander à l'utilisateur
        alert(`Email: ${data.email}\n\nLe mot de passe ne peut pas être récupéré pour des raisons de sécurité. Utilisez la fonction de réinitialisation de mot de passe si nécessaire.`);
      } else {
        alert('Erreur: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: any) {
      console.error('Erreur récupération identifiants:', error);
      alert(`Erreur: ${error.message || 'Erreur lors de la récupération des identifiants'}`);
    }
  };

  const handleToggleClientSuperAdmin = async (client: Client, isSuperAdmin: boolean) => {
    try {
      console.log(`🔄 Toggle super_admin pour client ${client.id}: ${isSuperAdmin ? 'activer' : 'désactiver'}`);
      
      const { data, error } = await supabase.rpc('toggle_client_super_admin', {
        p_client_id: client.id,
        p_is_super_admin: isSuperAdmin,
      });

      if (error) {
        console.error('❌ Erreur RPC toggle_client_super_admin:', error);
        throw error;
      }

      console.log('📦 Réponse RPC:', data);

      if (data?.success) {
        // Mettre à jour le statut local immédiatement
        setClientSuperAdminStatus(prev => {
          const updated = {
            ...prev,
            [client.id]: data.is_super_admin === true,
          };
          console.log('✅ Statut local mis à jour:', updated);
          return updated;
        });
        
        // Attendre un peu pour laisser la base de données se mettre à jour
        setTimeout(async () => {
          console.log('🔄 Rechargement du statut super_admin...');
          await loadClientSuperAdminStatus();
        }, 500);
        
        alert(`✅ ${data.message}`);
      } else {
        console.error('❌ Erreur dans la réponse:', data?.error);
        alert('Erreur: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: any) {
      console.error('❌ Erreur toggle super_admin:', error);
      alert(`Erreur: ${error.message || 'Erreur lors de la modification du statut super_admin'}`);
    }
  };

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (error) {
      console.error('Erreur copie:', error);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setFormData({
      entreprise_id: selectedEntreprise,
      nom: client.nom || '',
      prenom: client.prenom || '',
      entreprise_nom: client.entreprise_nom || '',
      email: client.email || '',
      telephone: client.telephone || '',
      adresse: '',
      code_postal: '',
      ville: client.ville || '',
      siret: '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client et TOUTES ses données (abonnement, espace membre, utilisateur) ?\n\n⚠️ Cette action est irréversible et libérera l\'email pour une réutilisation.')) return;

    try {
      // Utiliser la fonction RPC pour supprimer complètement le client
      const { data, error } = await supabase.rpc('delete_client_complete', {
        p_client_id: id,
        p_entreprise_id: selectedEntreprise,
      });

      if (error) {
        // Si la fonction RPC n'existe pas encore, utiliser la suppression classique
        if (error.message.includes('Could not find the function')) {
          console.warn('Fonction delete_client_complete non disponible, suppression classique...');
          const { error: deleteError } = await supabase.from('clients').delete().eq('id', id);
          if (deleteError) throw deleteError;
          alert('⚠️ Client supprimé, mais certaines données peuvent rester (abonnement, utilisateur).\n\nExécutez la migration 20250122000010_delete_client_complete.sql pour une suppression complète.');
        } else {
          throw error;
        }
      } else if (data?.success) {
        alert('✅ Client et toutes ses données supprimées avec succès !\n\nL\'email est maintenant libre pour être réutilisé.');
      } else {
        alert('⚠️ Erreur: ' + (data?.error || 'Erreur lors de la suppression'));
        return;
      }

      loadClients();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      entreprise_id: selectedEntreprise,
      nom: '',
      prenom: '',
      entreprise_nom: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      siret: '',
    });
    setEditingId(null);
  };

  const filteredClients = clients.filter((client) => {
    const search = searchTerm.toLowerCase();
    const fullName = `${client.nom || ''} ${client.prenom || ''} ${client.entreprise_nom || ''}`.toLowerCase();
    return fullName.includes(search) || client.email?.toLowerCase().includes(search);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  if (entreprises.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant d'ajouter des clients</p>
          <button
            onClick={() => _onNavigate('entreprises')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Créer une entreprise
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Clients</h1>
          <p className="text-gray-300">Gérez vos clients et prospects</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Ajouter un client
        </button>
      </div>

      {/* Sélection Entreprise */}
      {entreprises.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedEntreprise}
            onChange={(e) => {
              setSelectedEntreprise(e.target.value);
              setFormData((prev) => ({ ...prev, entreprise_id: e.target.value }));
            }}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {entreprises.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Recherche */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Liste des clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client'}
                  </h3>
                  {client.prenom && client.nom && (
                    <p className="text-sm text-gray-400">
                      {client.prenom} {client.nom}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  client.statut === 'actif'
                    ? 'bg-green-500/20 text-green-400'
                    : client.statut === 'prospect'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {client.statut}
              </span>
            </div>

            {client.email && (
              <p className="text-sm text-gray-300 mb-2">{client.email}</p>
            )}
            {client.telephone && (
              <p className="text-sm text-gray-300 mb-2">{client.telephone}</p>
            )}
            {client.ville && (
              <p className="text-sm text-gray-300 mb-2">{client.ville}</p>
            )}

            <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(client)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {client.email && (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedClientForEspace(client);
                        setEspaceMembreData({
                          password: '',
                          plan_id: plans.length > 0 ? plans[0].id : '',
                          options_ids: [],
                        });
                        setShowEspaceMembreModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      Créer espace membre
                    </button>
                    <button
                      onClick={() => handleGetCredentials(client)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                      title="Récupérer les identifiants"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Bouton Super Admin - Afficher pour tous les clients avec email */}
                  <button
                    onClick={() => {
                      const currentStatus = clientSuperAdminStatus[client.id] || false;
                      handleToggleClientSuperAdmin(client, !currentStatus);
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      clientSuperAdminStatus[client.id] === true
                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/30'
                    }`}
                    title={clientSuperAdminStatus[client.id] === true ? 'Désactiver super_admin' : 'Activer super_admin'}
                  >
                    {clientSuperAdminStatus[client.id] === true ? (
                      <>
                        <ShieldOff className="w-4 h-4" />
                        Retirer Super Admin
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Définir Super Admin
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">
            {searchTerm ? 'Aucun client trouvé' : 'Aucun client créé'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Ajouter votre premier client
            </button>
          )}
        </div>
      )}

      {/* Formulaire Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Modifier le client' : 'Nouveau client'}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom (particulier)
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dupont"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prénom (particulier)
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jean"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Entreprise (professionnel)
                </label>
                <input
                  type="text"
                  value={formData.entreprise_nom}
                  onChange={(e) => setFormData({ ...formData, entreprise_nom: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'entreprise"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="client@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="01 23 45 67 89"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Rue Example"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Code postal</label>
                  <input
                    type="text"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
                  <input
                    type="text"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">SIRET (optionnel)</label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12345678901234"
                />
              </div>


              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingId ? 'Modifier' : 'Créer'}
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

      {/* Modal Création Espace Membre */}
      {showEspaceMembreModal && selectedClientForEspace && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Créer un espace membre pour {selectedClientForEspace.entreprise_nom || `${selectedClientForEspace.prenom} ${selectedClientForEspace.nom}`.trim() || 'ce client'}
              </h2>
              <button
                onClick={() => {
                  setShowEspaceMembreModal(false);
                  setSelectedClientForEspace(null);
                  setEspaceMembreData({ password: '', plan_id: plans.length > 0 ? plans[0].id : '', options_ids: [] });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe pour l'espace membre
                  <span className="text-xs text-gray-400 ml-2">(optionnel - généré automatiquement si vide)</span>
                </label>
                <input
                  type="password"
                  value={espaceMembreData.password}
                  onChange={(e) => setEspaceMembreData({ ...espaceMembreData, password: e.target.value })}
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Laissez vide pour génération automatique (12 caractères aléatoires)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {espaceMembreData.password 
                    ? 'Le mot de passe sera affiché une seule fois après la création'
                    : 'Un mot de passe sécurisé sera généré automatiquement et affiché une seule fois'}
                </p>
              </div>

              {plans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Plan d'abonnement *
                  </label>
                  <select
                    value={espaceMembreData.plan_id}
                    onChange={(e) => setEspaceMembreData({ ...espaceMembreData, plan_id: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nom} - {plan.prix_mensuel}€/mois
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {options.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Options/Modules supplémentaires
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto bg-white/5 rounded-lg p-3 border border-white/10">
                    {options.map((option) => (
                      <div key={option.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`espace-option-${option.id}`}
                          checked={espaceMembreData.options_ids.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEspaceMembreData({
                                ...espaceMembreData,
                                options_ids: [...espaceMembreData.options_ids, option.id],
                              });
                            } else {
                              setEspaceMembreData({
                                ...espaceMembreData,
                                options_ids: espaceMembreData.options_ids.filter((id) => id !== option.id),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <label htmlFor={`espace-option-${option.id}`} className="text-sm text-gray-300 cursor-pointer flex-1">
                          <span className="font-medium">{option.nom}</span>
                          {option.prix_mensuel > 0 && (
                            <span className="text-gray-400 ml-2">(+{option.prix_mensuel}€/mois)</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleCreateEspaceMembre}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  Créer l'espace membre
                </button>
                <button
                  onClick={() => {
                    setShowEspaceMembreModal(false);
                    setSelectedClientForEspace(null);
                    setEspaceMembreData({ password: '', plan_id: plans.length > 0 ? plans[0].id : '', options_ids: [] });
                  }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Identifiants */}
      {showIdentifiantsModal && clientCredentials && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Identifiants Espace Membre</h2>
              <button
                onClick={() => {
                  setShowIdentifiantsModal(false);
                  setClientCredentials(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-sm">
                  ⚠️ Important : Ces identifiants sont affichés une seule fois. Copiez-les avant de fermer cette fenêtre.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={clientCredentials.email}
                    readOnly
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(clientCredentials.email, 'email')}
                    className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                    title="Copier"
                  >
                    {copiedEmail ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={clientCredentials.password}
                    readOnly
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(clientCredentials.password, 'password')}
                    className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                    title="Copier"
                  >
                    {copiedPassword ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  // TODO: Implémenter l'envoi par email
                  alert('Fonctionnalité d\'envoi par email à implémenter');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                <Mail className="w-5 h-5" />
                Envoyer par email
              </button>
              <button
                onClick={() => {
                  setShowIdentifiantsModal(false);
                  setClientCredentials(null);
                }}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

