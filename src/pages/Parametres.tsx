import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Settings, Building2, Mail, Shield, Trash2, Play, Pause, Plus, Search, AlertCircle } from 'lucide-react';

interface ClientInfo {
  id: string;
  entreprise_id: string;
  entreprise_nom: string;
  client_nom: string;
  client_prenom: string;
  email: string;
  role: string; // 'client' ou 'client_super_admin'
  espace_actif: boolean;
  espace_id: string | null;
  user_id: string | null;
  created_at: string;
}

export default function Parametres() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkSuperAdmin();
      loadAllClients();
    }
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('is_platform_super_admin');
      if (!error && data === true) {
        setIsSuperAdmin(true);
      }
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
    }
  };

  const loadAllClients = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Récupérer tous les clients avec leurs entreprises et espaces membres
      // Utiliser une requête avec jointure pour être plus efficace
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          entreprise_id,
          nom,
          prenom,
          email,
          created_at,
          entreprises!inner (
            id,
            nom
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Récupérer tous les utilisateurs en une seule requête
      interface ClientData {
        id: string;
        entreprise_id: string;
        nom?: string;
        prenom?: string;
        email?: string;
        created_at: string;
        entreprises?: { nom: string };
      }
      
      const clientIds = (clientsData || []).map((c: ClientData) => c.id);
      const { data: utilisateursData } = await supabase
        .from('utilisateurs')
        .select('id, role')
        .in('id', clientIds);

      interface UtilisateurData {
        id: string;
        role?: string;
      }
      
      interface EspaceData {
        id: string;
        client_id: string;
        user_id: string | null;
        actif: boolean;
      }
      
      const rolesMap = new Map((utilisateursData || []).map((u: UtilisateurData) => [u.id, u.role || 'client']));
      
      // Récupérer tous les espaces membres en une seule requête
      const { data: espacesData } = await supabase
        .from('espaces_membres_clients')
        .select('id, client_id, user_id, actif')
        .in('client_id', clientIds);

      const espacesMap = new Map<string, EspaceData>();
      (espacesData || []).forEach((e: EspaceData) => {
        espacesMap.set(e.client_id, e);
      });

      // Construire la liste finale
      const clientsWithDetails = (clientsData || []).map((client: ClientData) => {
        const espace = espacesMap.get(client.id);
        const role = rolesMap.get(client.id) || 'client';
        
        return {
          id: client.id,
          entreprise_id: client.entreprise_id,
          entreprise_nom: client.entreprises?.nom || 'N/A',
          client_nom: client.nom || '',
          client_prenom: client.prenom || '',
          email: client.email || '',
          role: role,
          espace_actif: espace?.actif ?? false,
          espace_id: espace?.id || null,
          user_id: espace?.user_id || null,
          created_at: client.created_at,
        } as ClientInfo;
      });

      setClients(clientsWithDetails);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      alert('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEspace = async (client: ClientInfo) => {
    if (!client.email) {
      alert('Le client doit avoir un email pour créer un espace membre');
      return;
    }

    try {
      // Utiliser la fonction RPC pour créer l'espace membre
      // Essayer différentes fonctions selon ce qui est disponible
      let result;
      let error;
      
      // Essayer create_espace_membre_from_client (la fonction standard)
      ({ data: result, error } = await supabase.rpc('create_espace_membre_from_client', {
        p_client_id: client.id,
        p_entreprise_id: client.entreprise_id,
        p_password: null, // Généré automatiquement
        p_plan_id: null, // Pas de plan spécifique pour l'instant
        p_options_ids: []
      }));

      // Si erreur, essayer avec create_complete_client_space
      if (error || !result?.success) {
        ({ data: result, error } = await supabase.rpc('create_complete_client_space', {
          p_client_id: client.id
        }));
      }

      if (error) throw error;

      if (result?.success) {
        const password = result.password || result.password_temporaire || 'Généré automatiquement';
        alert(`✅ Espace membre créé avec succès!\n\nEmail: ${result.email || client.email}\nMot de passe temporaire: ${password}`);
        await loadAllClients();
      } else {
        throw new Error(result?.error || 'Erreur inconnue');
      }
    } catch (error: unknown) {
      console.error('Erreur création espace membre:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la création de l\'espace membre: ' + errorMessage);
    }
  };

  const handleSuspendreEspace = async (client: ClientInfo) => {
    if (!client.espace_id) return;

    try {
      const { error } = await supabase
        .from('espaces_membres_clients')
        .update({ actif: !client.espace_actif })
        .eq('id', client.espace_id);

      if (error) throw error;

      alert(`✅ Espace membre ${!client.espace_actif ? 'activé' : 'suspendu'} avec succès`);
      await loadAllClients();
    } catch (error: unknown) {
      console.error('Erreur suspension espace:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur: ' + errorMessage);
    }
  };

  const handleDeleteClient = async (client: ClientInfo) => {
    const confirmMessage = `⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce client ?\n\nCela supprimera:\n- Le client\n- L'espace membre client (si existant)\n- L'utilisateur auth associé\n- Toutes les données liées\n\nCette action est irréversible.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      // Utiliser la fonction RPC pour supprimer complètement le client
        interface DeleteClientResult {
          success: boolean;
          message?: string;
          error?: string;
        }
        
        const { data, error } = await supabase.rpc<DeleteClientResult>('delete_client_complete_unified', {
        p_client_id: client.id
      });

      if (error) {
        // Si la fonction n'existe pas, supprimer manuellement
        if (error.message?.includes('Could not find') || error.code === 'P0001') {
          // D'abord supprimer l'espace membre (cascade supprimera l'auth user via trigger)
          if (client.espace_id) {
            const { error: espaceError } = await supabase
              .from('espaces_membres_clients')
              .delete()
              .eq('id', client.espace_id);
            
            if (espaceError) throw espaceError;
          }

          // Supprimer le client (cascade supprimera les autres éléments liés)
          const { error: clientError } = await supabase
            .from('clients')
            .delete()
            .eq('id', client.id);

          if (clientError) throw clientError;

          alert('✅ Client supprimé définitivement avec succès');
        } else {
          throw error;
        }
      } else if (data?.success) {
        alert(`✅ ${data.message || 'Client supprimé définitivement avec succès'}`);
      } else {
        throw new Error(data?.error || 'Erreur lors de la suppression');
      }

      await loadAllClients();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression client:', error);
      alert('❌ Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const filteredClients = clients.filter(client =>
    client.entreprise_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
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
          <p className="text-gray-300">Seul le super administrateur de la plateforme peut accéder à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Paramètres
        </h1>
        <p className="text-gray-300">Gestion complète de tous les clients de la plateforme</p>
      </div>

      {/* Recherche */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par entreprise, nom, prénom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tableau des clients */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/20">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Entreprise
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Espace Client
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-medium">{client.entreprise_nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white">
                        {client.client_prenom} {client.client_nom}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">{client.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          client.role === 'client_super_admin'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {client.role === 'client_super_admin' ? (
                          <>
                            <Shield className="w-3 h-3 inline mr-1" />
                            Client Super Admin
                          </>
                        ) : (
                          'Client'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {client.espace_id ? (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            client.espace_actif
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {client.espace_actif ? '✅ Actif' : '⏸️ Suspendu'}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                          Non créé
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {client.espace_id ? (
                          <button
                            onClick={() => handleSuspendreEspace(client)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              client.espace_actif
                                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                            }`}
                            title={client.espace_actif ? 'Suspendre' : 'Activer'}
                          >
                            {client.espace_actif ? (
                              <>
                                <Pause className="w-3 h-3 inline mr-1" />
                                Suspendre
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 inline mr-1" />
                                Activer
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCreateEspace(client)}
                            disabled={!client.email}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!client.email ? 'Le client doit avoir un email' : 'Créer l\'espace membre'}
                          >
                            <Plus className="w-3 h-3" />
                            Créer
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClient(client)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all flex items-center gap-1"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-3 h-3" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistiques */}
      {clients.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Total Clients</div>
            <div className="text-2xl font-bold text-white">{clients.length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Espaces Créés</div>
            <div className="text-2xl font-bold text-green-400">
              {clients.filter((c) => c.espace_id).length}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Super Admins</div>
            <div className="text-2xl font-bold text-yellow-400">
              {clients.filter((c) => c.role === 'client_super_admin').length}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Espaces Actifs</div>
            <div className="text-2xl font-bold text-blue-400">
              {clients.filter((c) => c.espace_actif).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

