/**
 * Composant Administration Super Admin
 * 
 * Gestion des rôles super admin pour les clients
 */

import { useState, useEffect } from 'react';
import { Crown, Shield, ShieldOff, Mail, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client } from './types';
import { useAuth } from '../../hooks/useAuth';

interface ClientSuperAdminProps {
  clients: Client[];
  entreprises: Array<{ id: string; nom: string }>;
  selectedEntreprise: string;
  onEntrepriseChange: (entrepriseId: string) => void;
}

export function ClientSuperAdmin({
  clients,
  entreprises,
  selectedEntreprise,
  onEntrepriseChange,
}: ClientSuperAdminProps) {
  const { user } = useAuth();
  const [clientSuperAdminStatus, setClientSuperAdminStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clients.length > 0 && user) {
      loadClientSuperAdminStatus();
    }
  }, [clients, selectedEntreprise, user]);

  const loadClientSuperAdminStatus = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Récupérer les entreprises de l'utilisateur
      const { data: userEntreprises, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('id')
        .eq('user_id', user.id);

      if (entrepriseError) {
        console.error('Erreur chargement entreprises pour statut super_admin:', entrepriseError);
        setClientSuperAdminStatus({});
        return;
      }

      if (!userEntreprises || userEntreprises.length === 0) {
        setClientSuperAdminStatus({});
        return;
      }

      const entrepriseIds = userEntreprises.map(e => e.id);
      const statusMap: Record<string, boolean> = {};
      
      // Utiliser la fonction RPC pour chaque entreprise
      for (const entrepriseId of entrepriseIds) {
        try {
          const { data: statusData, error: rpcError } = await supabase.rpc(
            'get_client_super_admin_status',
            { p_entreprise_id: entrepriseId }
          );

          if (rpcError) {
            // Si erreur de permission (P0001), c'est normal si l'utilisateur n'est pas super_admin
            if (rpcError.code === 'P0001' || rpcError.message?.includes('non autorisé')) {
              console.log(`ℹ️ Accès refusé pour entreprise ${entrepriseId} (utilisateur non super_admin)`);
            } else {
              console.error(`Erreur RPC pour entreprise ${entrepriseId}:`, rpcError);
            }
            continue;
          }

          if (statusData && Array.isArray(statusData)) {
            statusData.forEach((row: { client_id: string; is_super_admin: boolean }) => {
              if (row.client_id) {
                statusMap[row.client_id] = row.is_super_admin === true;
              }
            });
          }
        } catch (error) {
          console.error(`Erreur lors du chargement du statut pour entreprise ${entrepriseId}:`, error);
        }
      }
      
      setClientSuperAdminStatus(statusMap);
    } catch (error) {
      console.error('Erreur chargement statut super_admin:', error);
      setClientSuperAdminStatus({});
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClientSuperAdmin = async (client: Client, isSuperAdmin: boolean) => {
    if (!client.email) {
      alert('❌ Le client doit avoir un email pour définir le statut super admin.');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('toggle_client_super_admin', {
        p_client_id: client.id,
        p_is_super_admin: isSuperAdmin,
      });

      if (error) {
        console.error('Erreur toggle super admin:', error);
        alert('❌ Erreur: ' + error.message);
        return;
      }

      if (data?.success) {
        // Recharger le statut
        await loadClientSuperAdminStatus();
        
        alert(
          isSuperAdmin
            ? '✅ Client défini comme super admin de son espace.\n💡 Le client doit se déconnecter et se reconnecter pour voir le badge Super Admin.'
            : '✅ Statut super admin retiré du client.'
        );
      } else {
        alert('❌ Erreur: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: any) {
      console.error('Erreur toggle super admin:', error);
      alert('❌ Erreur: ' + (error.message || 'Erreur inconnue'));
    }
  };

  // Filtrer les clients selon l'entreprise sélectionnée
  const filteredClients = selectedEntreprise
    ? clients.filter((c) => c.entreprise_id === selectedEntreprise)
    : clients;

  return (
    <div className="space-y-6">
      {/* Message explicatif */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Crown className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-yellow-300 mb-2">
              Administration Super Admin Client
            </h3>
            <p className="text-yellow-200/80 text-sm">
              Définissez un client comme <strong>super_admin de son espace</strong>. 
              Ce rôle lui donne des droits d'administration dans son espace client, mais 
              <strong> sans accès à la gestion des modules</strong> de la plateforme.
            </p>
          </div>
        </div>
      </div>

      {/* Sélection Entreprise */}
      {entreprises.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Filtrer par entreprise
          </label>
          <select
            value={selectedEntreprise}
            onChange={(e) => onEntrepriseChange(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            {entreprises.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Liste des clients avec statut super admin */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement des statuts...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Crown className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Aucun client trouvé pour cette entreprise.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border transition-all ${
                clientSuperAdminStatus[client.id]
                  ? 'border-yellow-500/50 bg-yellow-500/5'
                  : 'border-white/20 hover:bg-white/15'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    clientSuperAdminStatus[client.id]
                      ? 'bg-yellow-500/20'
                      : 'bg-gray-500/20'
                  }`}>
                    {clientSuperAdminStatus[client.id] ? (
                      <Crown className="w-6 h-6 text-yellow-400" />
                    ) : (
                      <Users className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
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
                {clientSuperAdminStatus[client.id] && (
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium border border-yellow-500/30">
                    Super Admin
                  </span>
                )}
              </div>

              {client.email && (
                <p className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {client.email}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-white/10">
                {client.email ? (
                  <div>
                    <button
                      onClick={() => handleToggleClientSuperAdmin(client, !clientSuperAdminStatus[client.id])}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-semibold ${
                        clientSuperAdminStatus[client.id]
                          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                          : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30'
                      }`}
                    >
                      {clientSuperAdminStatus[client.id] ? (
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
                    {clientSuperAdminStatus[client.id] && (
                      <p className="text-xs text-yellow-400/70 mt-2 text-center">
                        💡 Le client doit se reconnecter pour voir le badge dans son espace
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2 px-4 bg-gray-500/20 text-gray-400 rounded-lg text-sm">
                    Email requis pour créer un espace membre
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

