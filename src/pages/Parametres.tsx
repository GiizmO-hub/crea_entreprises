import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Settings, Building2, Mail, Shield, Trash2, Play, Pause, Plus, Search, AlertCircle, Send, User, Building, FileText, Bell, Lock, CreditCard, Database, Users, ShieldOff, Crown } from 'lucide-react';
import CredentialsModal from '../components/CredentialsModal';
import { sendClientCredentialsEmail } from '../services/emailService';
import type { ClientCredentialsEmailData } from '../services/emailService';
import { EspaceMembreModal } from '../pages/clients/EspaceMembreModal';
import type { Client, EspaceMembreData, Plan, Option } from '../pages/clients/types';

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

type TabType = 'profil' | 'entreprise' | 'facturation' | 'notifications' | 'securite' | 'abonnement' | 'donnees' | 'clients';

export default function Parametres() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profil');
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [clientCredentials, setClientCredentials] = useState<{
    email: string;
    password: string;
    clientName: string;
    entrepriseNom: string;
    clientPrenom?: string;
  } | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [showEspaceModal, setShowEspaceModal] = useState(false);
  const [selectedClientForEspace, setSelectedClientForEspace] = useState<ClientInfo | null>(null);
  const [espaceMembreData, setEspaceMembreData] = useState<EspaceMembreData>({
    password: '',
    plan_id: '',
    options_ids: [],
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [entrepriseConfig, setEntrepriseConfig] = useState<{
    entreprise: { id: string; nom: string } | null;
    clients: number;
    espaces: number;
    abonnements: number;
    superAdmins: number;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    if (user) {
      checkSuperAdmin();
    }
  }, [user]);

  useEffect(() => {
    if (user && isSuperAdmin && activeTab === 'clients') {
      loadAllClients();
      loadPlans();
      loadOptions();
    }
  }, [user, isSuperAdmin, activeTab]);

  useEffect(() => {
    if (user && activeTab === 'entreprise') {
      loadEntrepriseConfig();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && activeTab === 'entreprise') {
      loadEntrepriseConfig();
    }
  }, [user, activeTab]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans_abonnement')
        .select('id, nom, description, prix_mensuel, prix_annuel')
        .eq('actif', true)
        .order('ordre');

      if (error) throw error;
      setPlans(data || []);
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

  const loadEntrepriseConfig = async () => {
    if (!user) return;
    
    setLoadingConfig(true);
    try {
      // Récupérer l'entreprise de l'utilisateur connecté
      const { data: entreprisesData, error: entreprisesError } = await supabase
        .from('entreprises')
        .select('id, nom')
        .eq('user_id', user.id)
        .maybeSingle();

      if (entreprisesError) {
        console.error('Erreur chargement entreprise:', entreprisesError);
        setEntrepriseConfig(null);
        setLoadingConfig(false);
        return;
      }

      if (!entreprisesData) {
        setEntrepriseConfig(null);
        setLoadingConfig(false);
        return;
      }

      const entrepriseId = entreprisesData.id;

      // Compter les clients
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId);

      // Récupérer les IDs des clients pour compter les espaces
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, email')
        .eq('entreprise_id', entrepriseId);

      const clientIds = clientsData?.map((c: { id: string }) => c.id) || [];

      // Compter les espaces membres
      let espacesCount = 0;
      if (clientIds.length > 0) {
        const { count } = await supabase
          .from('espaces_membres_clients')
          .select('*', { count: 'exact', head: true })
          .in('client_id', clientIds);
        espacesCount = count || 0;
      }

      // Compter les abonnements actifs (ou avec statut 'actif')
      const { data: abonnementsData, error: abonnementsError } = await supabase
        .from('abonnements')
        .select('id, statut, actif')
        .eq('entreprise_id', entrepriseId);
      
      let abonnementsCount = 0;
      if (!abonnementsError && abonnementsData) {
        // Compter les abonnements actifs (soit actif=true, soit statut='actif')
        abonnementsCount = abonnementsData.filter((ab: { actif?: boolean; statut?: string }) => 
          ab.actif === true || ab.statut === 'actif'
        ).length;
      }

      // Compter les clients super admins
      let superAdminsCount = 0;
      if (clientsData && clientsData.length > 0) {
        const clientEmails = clientsData.map((c: { email?: string }) => c.email).filter(Boolean) as string[];
        if (clientEmails.length > 0) {
          const { data: usersData } = await supabase
            .from('utilisateurs')
            .select('email, role')
            .in('email', clientEmails)
            .eq('role', 'client_super_admin');

          superAdminsCount = usersData?.length || 0;
        }
      }

      setEntrepriseConfig({
        entreprise: entreprisesData,
        clients: clientsCount || 0,
        espaces: espacesCount,
        abonnements: abonnementsCount || 0,
        superAdmins: superAdminsCount,
      });
    } catch (error) {
      console.error('Erreur chargement config entreprise:', error);
      setEntrepriseConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadAllClients = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Requête plus simple qui fonctionne mieux avec RLS
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          entreprise_id,
          nom,
          prenom,
          email,
          created_at,
          entreprises(nom),
          espaces_membres_clients(
            id,
            actif,
            user_id
          )
        `);

      if (error) {
        console.error('Erreur chargement clients:', error);
        return;
      }

      if (!data || data.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const clientIds = data.map((c: { id: string }) => c.id);
      console.log('📦 Clients chargés:', clientIds.length);

      // Récupérer TOUS les espaces membres pour ces clients (requête séparée - plus fiable)
      const { data: espacesData, error: espacesError } = await supabase
        .from('espaces_membres_clients')
        .select('id, client_id, actif, user_id')
        .in('client_id', clientIds);

      if (espacesError) {
        console.warn('⚠️ Erreur chargement espaces:', espacesError);
      }

      // Créer une map des espaces par client_id
      const espacesMap: Record<string, { id: string; actif: boolean; user_id: string | null }> = {};
      if (espacesData) {
        espacesData.forEach((espace: { id: string; client_id: string; actif: boolean; user_id: string | null }) => {
          espacesMap[espace.client_id] = {
            id: espace.id,
            actif: espace.actif,
            user_id: espace.user_id,
          };
        });
      }
      console.log('📦 Espaces chargés:', Object.keys(espacesMap).length, 'espaces pour', clientIds.length, 'clients');

      // Récupérer les rôles depuis utilisateurs via espaces_membres_clients
      let rolesMap: Record<string, string> = {};
      
      if (espacesData && espacesData.length > 0) {
        const userIds = espacesData
          .map((e: { user_id: string | null }) => e.user_id)
          .filter((uid: string | null): uid is string => uid !== null);

        if (userIds.length > 0) {
          try {
            const { data: usersData } = await supabase
              .from('utilisateurs')
              .select('id, role')
              .in('id', userIds);

            if (usersData) {
              const userIdToRole: Record<string, string> = {};
              usersData.forEach((u: { id: string; role: string }) => {
                userIdToRole[u.id] = u.role || 'client';
              });

              // Mapper les rôles par client_id
              espacesData.forEach((espace: { client_id: string; user_id: string | null }) => {
                if (espace.user_id && userIdToRole[espace.user_id]) {
                  rolesMap[espace.client_id] = userIdToRole[espace.user_id];
                }
              });
            }
          } catch (roleError) {
            console.warn('⚠️ Erreur récupération rôles via espaces:', roleError);
          }
        }
      }
      
      // Récupérer les rôles pour TOUS les clients via email (y compris ceux sans espace)
      try {
        const clientEmails = data
          .map((c: { email?: string }) => c.email)
          .filter((email: string | undefined): email is string => !!email);

        if (clientEmails.length > 0) {
          const { data: usersByEmailData } = await supabase
            .from('utilisateurs')
            .select('email, role')
            .in('email', clientEmails);

          if (usersByEmailData) {
            const emailToRole: Record<string, string> = {};
            usersByEmailData.forEach((u: { email: string; role: string }) => {
              emailToRole[u.email] = u.role || 'client';
            });

            // Mapper les rôles par email de client (remplace si le rôle via espace n'est pas client_super_admin)
            data.forEach((c: { id: string; email?: string }) => {
              if (c.email && emailToRole[c.email]) {
                // Toujours utiliser le rôle depuis utilisateurs (source de vérité)
                // Cela garantit que les changements récents sont pris en compte
                rolesMap[c.id] = emailToRole[c.email];
                console.log(`📌 Rôle récupéré via email pour client ${c.id} (${c.email}): ${emailToRole[c.email]}`);
              }
            });
          }
        }
      } catch (emailRoleError) {
        console.warn('⚠️ Erreur récupération rôles via email:', emailRoleError);
      }

      // Transformer les données pour correspondre à ClientInfo
      const transformedClients: ClientInfo[] = data.map((client: unknown) => {
        const c = client as {
          id: string;
          entreprise_id: string;
          nom?: string;
          prenom?: string;
          email: string;
          created_at: string;
          entreprises?: { nom: string } | null | Array<{ nom: string }>;
          espaces_membres_clients?: Array<{ id: string; actif: boolean; user_id: string | null }> | null;
        };
        
        // Récupérer l'espace depuis la map (plus fiable que le JOIN)
        const espace = espacesMap[c.id] || null;
        
        // Gérer le nom de l'entreprise (peut être array ou object)
        let entrepriseNom = 'N/A';
        if (Array.isArray(c.entreprises) && c.entreprises.length > 0) {
          entrepriseNom = c.entreprises[0]?.nom || 'N/A';
        } else if (c.entreprises && typeof c.entreprises === 'object' && 'nom' in c.entreprises) {
          entrepriseNom = (c.entreprises as { nom: string }).nom || 'N/A';
        }
        
        // Toujours récupérer le rôle depuis rolesMap (qui est maintenant toujours mis à jour via email)
        let clientRole = rolesMap[c.id] || 'client';
        
        // Si le rôle n'a pas été trouvé via email, essayer via l'espace si disponible
        if (clientRole === 'client' && espace?.user_id) {
          // Le rôle devrait déjà être dans rolesMap, mais double vérification
          const { data: userRoleData } = await supabase
            .from('utilisateurs')
            .select('role')
            .eq('id', espace.user_id)
            .maybeSingle();
          
          if (userRoleData?.role) {
            clientRole = userRoleData.role;
          }
        }
        
        const clientInfo: ClientInfo = {
          id: c.id,
          entreprise_id: c.entreprise_id,
          entreprise_nom: entrepriseNom,
          client_nom: c.nom || 'N/A',
          client_prenom: c.prenom || '',
          email: c.email || '',
          role: clientRole,
          espace_actif: espace?.actif ?? false,
          espace_id: espace?.id || null,
          user_id: espace?.user_id || null,
          created_at: c.created_at,
        };
        
        // Log pour déboguer
        if (espace) {
          console.log(`✅ Client ${c.id} (${c.email}): Espace trouvé - ID: ${espace.id}, Actif: ${espace.actif}, Rôle: ${clientRole}`);
        } else {
          console.log(`⚠️ Client ${c.id} (${c.email}): Aucun espace trouvé, Rôle: ${clientRole}`);
        }
        
        // Log spécifique pour client_super_admin
        if (clientRole === 'client_super_admin') {
          console.log(`⭐⭐ Client Super Admin détecté: ${c.email} - Rôle: ${clientRole}`);
        }
        
        return clientInfo;
      });

      setClients(transformedClients);
      console.log('✅ Clients chargés:', transformedClients.length);
      console.log('📊 Détail des clients:', transformedClients.map(c => ({
        id: c.id,
        email: c.email,
        role: c.role,
        espace_id: c.espace_id,
        espace_actif: c.espace_actif
      })));
      console.log('🔍 Rôles détectés:', rolesMap);
      console.log('🔍 Espaces chargés:', Object.keys(espacesMap).length);
    } catch (error) {
      console.error('❌ Erreur chargement clients:', error);
      alert('Erreur lors du chargement des clients. Vérifiez la console pour plus de détails.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEspaceClick = (client: ClientInfo) => {
    if (!client.email) {
      alert('❌ Le client doit avoir un email pour créer un espace membre');
      return;
    }

    // Convertir ClientInfo en Client pour le modal
    const clientForModal: Client = {
      id: client.id,
      entreprise_id: client.entreprise_id,
      entreprise_nom: client.entreprise_nom,
      nom: client.client_nom,
      prenom: client.client_prenom,
      email: client.email,
    };

    setSelectedClientForEspace(clientForModal);
    setEspaceMembreData({
      password: '',
      plan_id: plans.length > 0 ? plans[0].id : '',
      options_ids: [],
    });
    setShowEspaceModal(true);
  };

  const handleCreateEspace = async () => {
    if (!selectedClientForEspace) return;
    if (!espaceMembreData.plan_id) {
      alert('❌ Veuillez sélectionner un plan d\'abonnement');
      return;
    }

    try {
      // Générer un mot de passe temporaire si non fourni
      const password = espaceMembreData.password.trim() || Math.random().toString(36).slice(-12) + 'A1!';
      
      // Utiliser la fonction RPC unifiée
      const { data: result, error } = await supabase.rpc(
        'create_espace_membre_from_client_unified',
        {
          p_client_id: selectedClientForEspace.id,
          p_entreprise_id: selectedClientForEspace.entreprise_id,
          p_password: password,
          p_plan_id: espaceMembreData.plan_id || null,
          p_options_ids: espaceMembreData.options_ids.length > 0 ? espaceMembreData.options_ids : null,
        }
      );

      if (error) {
        console.error('❌ Erreur RPC création espace membre:', error);
        throw new Error(error.message || error.details || 'Erreur lors de l\'appel à la fonction RPC');
      }

      if (!result) {
        throw new Error('Aucune réponse de la fonction RPC');
      }

      if (result.success) {
        if (result.already_exists) {
          alert('✅ Un espace membre existe déjà pour ce client.\n\n' + (result.message || ''));
        } else {
          const finalPassword = result.password || password;
          const finalEmail = result.email || selectedClientForEspace.email;
          
          setClientCredentials({
            email: finalEmail,
            password: finalPassword,
            clientName: selectedClientForEspace.nom || '',
            clientPrenom: selectedClientForEspace.prenom || undefined,
            entrepriseNom: selectedClientForEspace.entreprise_nom || '',
          });
          
          // Fermer le modal espace
          setShowEspaceModal(false);
          setSelectedClientForEspace(null);
          
          // Ouvrir le modal credentials qui permettra d'envoyer l'email
          setShowCredentialsModal(true);
        }
        
        // Recharger immédiatement les clients
        await loadAllClients();
      } else {
        const errorMsg = result.error || result.message || 'Erreur inconnue lors de la création';
        throw new Error(errorMsg);
      }
    } catch (error: unknown) {
      console.error('❌ Erreur complète création espace membre:', error);
      let errorMessage = 'Erreur inconnue';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const errObj = error as { message?: string; error?: string; details?: string; code?: string };
        errorMessage = errObj.message || errObj.error || errObj.details || errorMessage;
        if (errObj.code) {
          errorMessage += ` (Code: ${errObj.code})`;
        }
      }
      
      alert(`❌ Erreur lors de la création de l'espace membre: ${errorMessage}`);
    }
  };

  const handleToggleSuperAdmin = async (client: ClientInfo) => {
    if (!client.email) {
      alert('❌ Le client doit avoir un email pour définir le statut super admin');
      return;
    }

    const isCurrentlySuperAdmin = client.role === 'client_super_admin';
    const newStatus = !isCurrentlySuperAdmin;

    try {
      const { data, error } = await supabase.rpc('toggle_client_super_admin', {
        p_client_id: client.id,
        p_is_super_admin: newStatus,
      });

      if (error) {
        console.error('Erreur toggle super admin:', error);
        alert('❌ Erreur: ' + error.message);
        return;
      }

      if (data?.success) {
        alert(
          newStatus
            ? '✅ Client défini comme super admin de son espace.\n💡 Le client doit se déconnecter et se reconnecter pour voir le badge Super Admin.'
            : '✅ Statut super admin retiré du client.'
        );
        // Attendre un peu pour que la base de données se mette à jour
        await new Promise(resolve => setTimeout(resolve, 500));
        // Recharger les clients avec force pour obtenir le nouveau rôle
        await loadAllClients();
        // Forcer un deuxième rechargement après un court délai pour garantir la synchronisation
        setTimeout(async () => {
          await loadAllClients();
        }, 1000);
      } else {
        alert('❌ Erreur: ' + (data?.error || 'Erreur inconnue'));
      }
    } catch (error: unknown) {
      console.error('Erreur toggle super admin:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur: ' + errorMessage);
    }
  };

  const handleSuspendreEspace = async (client: ClientInfo) => {
    if (!client.espace_id) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir ${client.espace_actif ? 'suspendre' : 'activer'} l'espace membre de ${client.client_prenom} ${client.client_nom} ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('espaces_membres_clients')
        .update({ actif: !client.espace_actif })
        .eq('id', client.espace_id);

      if (error) {
        console.error('Erreur suspension espace:', error);
        alert('❌ Erreur lors de la modification de l\'espace membre');
        return;
      }

      await loadAllClients();
    } catch (error) {
      console.error('Erreur suspension espace:', error);
      alert('❌ Erreur lors de la modification de l\'espace membre');
    }
  };

  const handleResendCredentials = async (client: ClientInfo) => {
    if (!client.espace_id) {
      alert('❌ Aucun espace membre trouvé pour ce client');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir renvoyer les identifiants à ${client.email} ?\n\nUn nouveau mot de passe temporaire sera généré.`)) {
      return;
    }

    try {
      setResendingEmail(client.id);

      const { data: credentialsResult, error: credentialsError } = await supabase.rpc(
        'get_or_regenerate_client_credentials',
        {
          p_client_id: client.id,
        }
      );

      if (credentialsError) {
        console.error('❌ Erreur récupération identifiants:', credentialsError);
        throw new Error(credentialsError.message || 'Erreur lors de la récupération des identifiants');
      }

      if (!credentialsResult || !credentialsResult.success) {
        const errorMsg = credentialsResult?.error || 'Erreur inconnue';
        throw new Error(errorMsg);
      }

      const emailData: ClientCredentialsEmailData = {
        clientEmail: credentialsResult.email,
        clientName: credentialsResult.client_nom || client.client_nom,
        clientPrenom: credentialsResult.client_prenom || client.client_prenom,
        entrepriseNom: credentialsResult.entreprise_nom || client.entreprise_nom,
        email: credentialsResult.email,
        password: credentialsResult.password,
      };

      const emailResult = await sendClientCredentialsEmail(emailData);

      if (emailResult.success) {
        alert(`✅ Identifiants renvoyés avec succès à ${credentialsResult.email}\n\n📧 Un nouveau mot de passe temporaire a été généré et envoyé.`);
        await loadAllClients();
      } else {
        alert(`❌ Erreur lors de l'envoi de l'email: ${emailResult.error || 'Erreur inconnue'}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Erreur renvoi identifiants:', errorMessage);
      alert(`❌ Erreur lors du renvoi des identifiants: ${errorMessage}`);
    } finally {
      setResendingEmail(null);
    }
  };

  const handleDeleteClient = async (client: ClientInfo) => {
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer définitivement le client "${client.client_prenom} ${client.client_nom}" ?\n\nCette action supprimera également:\n- L'espace membre client\n- Tous les abonnements\n- Tous les données liées\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const { data: result, error } = await supabase.rpc('delete_client_complete_unified', {
        p_client_id: client.id,
      });

      if (error) {
        console.error('Erreur suppression client:', error);
        alert('❌ Erreur lors de la suppression du client: ' + error.message);
        return;
      }

      if (result && !result.success) {
        alert('❌ Erreur: ' + (result.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Client supprimé avec succès');
      await loadAllClients();
    } catch (error) {
      console.error('Erreur suppression client:', error);
      alert('❌ Erreur lors de la suppression du client');
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.entreprise_nom.toLowerCase().includes(searchLower) ||
      client.client_nom.toLowerCase().includes(searchLower) ||
      (client.client_prenom && client.client_prenom.toLowerCase().includes(searchLower)) ||
      (client.email && client.email.toLowerCase().includes(searchLower))
    );
  });

  const tabs = [
    { id: 'profil' as TabType, label: 'Profil', icon: User },
    { id: 'entreprise' as TabType, label: 'Entreprise', icon: Building },
    { id: 'facturation' as TabType, label: 'Facturation', icon: FileText },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell },
    { id: 'securite' as TabType, label: 'Sécurité', icon: Lock },
    { id: 'abonnement' as TabType, label: 'Abonnement', icon: CreditCard },
    { id: 'donnees' as TabType, label: 'Données', icon: Database },
    ...(isSuperAdmin ? [{ id: 'clients' as TabType, label: 'Gestion Clients', icon: Users }] : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profil':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Profil Utilisateur</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Gestion de votre profil utilisateur (à implémenter)</p>
            </div>
          </div>
        );

      case 'entreprise':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Paramètres Entreprise</h2>
            
            {loadingConfig ? (
              <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                <div className="text-center text-gray-400">Chargement...</div>
              </div>
            ) : entrepriseConfig?.entreprise ? (
              <div className="space-y-4">
                {/* Statut de l'entreprise */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">{entrepriseConfig.entreprise.nom}</h3>
                  </div>
                  
                  {/* Statut de configuration */}
                  <div className="space-y-3 mt-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Statut de configuration</h4>
                    
                    {/* Entreprise créée */}
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs">✅</span>
                        </div>
                        <span className="text-white font-medium">Entreprise créée</span>
                      </div>
                    </div>

                    {/* Clients */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${
                      entrepriseConfig.clients > 0 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-orange-500/10 border-orange-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          entrepriseConfig.clients > 0 ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                          {entrepriseConfig.clients > 0 ? (
                            <span className="text-white text-xs">✅</span>
                          ) : (
                            <span className="text-white text-xs">⏳</span>
                          )}
                        </div>
                        <span className="text-white font-medium">Client{entrepriseConfig.clients > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {entrepriseConfig.clients > 0 ? `${entrepriseConfig.clients} créé(s)` : 'En attente de création'}
                      </span>
                    </div>

                    {/* Espaces membres */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${
                      entrepriseConfig.espaces > 0 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-orange-500/10 border-orange-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          entrepriseConfig.espaces > 0 ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                          {entrepriseConfig.espaces > 0 ? (
                            <span className="text-white text-xs">✅</span>
                          ) : (
                            <span className="text-white text-xs">⏳</span>
                          )}
                        </div>
                        <span className="text-white font-medium">Espace{entrepriseConfig.espaces > 1 ? 's' : ''} client{entrepriseConfig.espaces > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {entrepriseConfig.espaces > 0 ? `${entrepriseConfig.espaces} créé(s)` : 'En attente de création'}
                      </span>
                    </div>

                    {/* Abonnements */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${
                      entrepriseConfig.abonnements > 0 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-orange-500/10 border-orange-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          entrepriseConfig.abonnements > 0 ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                          {entrepriseConfig.abonnements > 0 ? (
                            <span className="text-white text-xs">✅</span>
                          ) : (
                            <span className="text-white text-xs">⏳</span>
                          )}
                        </div>
                        <span className="text-white font-medium">Abonnement{entrepriseConfig.abonnements > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {entrepriseConfig.abonnements > 0 ? `${entrepriseConfig.abonnements} actif(s)` : 'En attente de configuration'}
                      </span>
                    </div>

                    {/* Super Admins */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${
                      entrepriseConfig.superAdmins > 0 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-orange-500/10 border-orange-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          entrepriseConfig.superAdmins > 0 ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                          {entrepriseConfig.superAdmins > 0 ? (
                            <Crown className="w-3 h-3 text-white" />
                          ) : (
                            <span className="text-white text-xs">⏳</span>
                          )}
                        </div>
                        <span className="text-white font-medium">Client{entrepriseConfig.superAdmins > 1 ? 's' : ''} Administrateur{entrepriseConfig.superAdmins > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {entrepriseConfig.superAdmins > 0 ? `${entrepriseConfig.superAdmins} actif(s)` : 'En attente d\'activation'}
                      </span>
                    </div>
                  </div>

                  {/* Message d'action */}
                  {entrepriseConfig.clients === 0 || entrepriseConfig.espaces === 0 || entrepriseConfig.abonnements === 0 ? (
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Prochaine étape :</strong> Configurez vos clients, espaces membres et abonnements depuis l'onglet <strong>"Gestion des clients"</strong> ci-dessus.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-300 text-sm">
                        ✅ <strong>Configuration complète :</strong> Votre entreprise est entièrement configurée !
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                <div className="text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-orange-400 mx-auto" />
                  <p className="text-gray-400">
                    Aucune entreprise n'a été créée pour votre compte.
                  </p>
                  <p className="text-sm text-gray-500">
                    Créez votre entreprise depuis l'onglet <strong>"Mon Entreprise"</strong> dans le menu principal.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'facturation':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Facturation</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Gestion de la facturation et des mentions légales (à implémenter)</p>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Notifications</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Configuration des notifications (à implémenter)</p>
            </div>
          </div>
        );

      case 'securite':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Sécurité</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Gestion de la sécurité et authentification 2FA (à implémenter)</p>
            </div>
          </div>
        );

      case 'abonnement':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Abonnement</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Gestion de votre abonnement (à implémenter)</p>
            </div>
          </div>
        );

      case 'donnees':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Données</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Export et gestion des données RGPD (à implémenter)</p>
            </div>
          </div>
        );

      case 'clients':
        if (!isSuperAdmin) {
          return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Accès refusé</h2>
              <p className="text-gray-400">Vous devez être super administrateur pour accéder à cette section.</p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Gestion Complète des Clients</h2>
            </div>

            {/* Barre de recherche */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher par entreprise, nom, prénom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
                <div className="text-gray-400 text-sm mb-1">Nombre total de clients</div>
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
                  {clients.filter((c) => c.espace_actif && c.espace_id).length}
                </div>
              </div>
            </div>

            {/* Table des clients */}
            {loading ? (
              <div className="text-center text-gray-400 py-8">Chargement...</div>
            ) : (
              <div className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Entreprise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        E-mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Rôle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Espace Client
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                            {(() => {
                              const isSuperAdmin = client.role === 'client_super_admin';
                              // Log pour déboguer
                              console.log(`🔍 Client ${client.email} - Rôle actuel: "${client.role}", isSuperAdmin: ${isSuperAdmin}`);
                              if (isSuperAdmin) {
                                console.log(`🎯 Affichage badge Client Administrateur pour ${client.email}, rôle détecté: "${client.role}"`);
                              }
                              return isSuperAdmin ? (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 inline-flex items-center gap-1.5">
                                  <Crown className="w-3 h-3 text-yellow-400" />
                                  <span className="font-semibold">Client Administrateur</span>
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                                  Client
                                </span>
                              );
                            })()}
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
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {client.espace_id ? (
                                <>
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
                                  <button
                                    onClick={() => handleResendCredentials(client)}
                                    disabled={resendingEmail === client.id}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    title="Renvoyer les identifiants par email"
                                  >
                                    {resendingEmail === client.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                        Envoi...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3" />
                                        Renvoyer
                                      </>
                                    )}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleCreateEspaceClick(client)}
                                  disabled={!client.email}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  title={!client.email ? 'Le client doit avoir un email' : 'Créer l\'espace membre avec abonnement'}
                                >
                                  <Plus className="w-3 h-3" />
                                  Créer
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleSuperAdmin(client)}
                                disabled={!client.espace_id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                                  client.role === 'client_super_admin'
                                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                                    : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={!client.espace_id ? 'L\'espace membre doit être créé d\'abord' : client.role === 'client_super_admin' ? 'Retirer le statut super admin' : 'Définir comme super admin'}
                              >
                                {client.role === 'client_super_admin' ? (
                                  <>
                                    <ShieldOff className="w-3 h-3" />
                                    Retirer SA
                                  </>
                                ) : (
                                  <>
                                    <Crown className="w-3 h-3" />
                                    Super Admin
                                  </>
                                )}
                              </button>
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
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Paramètres</h1>
        </div>
        <p className="text-gray-400">Configurez tous les paramètres de votre compte et de votre entreprise</p>
      </div>

      {/* Onglets */}
      <div className="border-b border-white/10 mb-6">
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-purple-400 text-purple-400'
                    : 'text-gray-400 hover:text-white hover:border-b-2 hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu de l'onglet actif */}
      <div>{renderTabContent()}</div>

      {/* Modal identifiants */}
      {showCredentialsModal && clientCredentials && (
        <CredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false);
            setClientCredentials(null);
          }}
          credentials={clientCredentials}
        />
      )}

      {/* Modal création espace membre */}
      {showEspaceModal && selectedClientForEspace && (
        <EspaceMembreModal
          show={showEspaceModal}
          client={selectedClientForEspace}
          plans={plans}
          options={options}
          data={espaceMembreData}
          onClose={() => {
            setShowEspaceModal(false);
            setSelectedClientForEspace(null);
            setEspaceMembreData({
              password: '',
              plan_id: '',
              options_ids: [],
            });
          }}
          onSubmit={handleCreateEspace}
          onChange={(newData) => {
            setEspaceMembreData({
              ...espaceMembreData,
              ...newData,
            });
          }}
        />
      )}
    </div>
  );
}
