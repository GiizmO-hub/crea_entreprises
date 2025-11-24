/**
 * Page Clients - Orchestrateur
 * 
 * Cette page orchestre tous les composants de gestion des clients
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Users, Crown, Building2 } from 'lucide-react';

// Composants
import { ClientsList } from './clients/ClientsList';
import { ClientForm } from './clients/ClientForm';
import { ClientSuperAdmin } from './clients/ClientSuperAdmin';
import { EspaceMembreModal } from './clients/EspaceMembreModal';
import { IdentifiantsModal } from './clients/IdentifiantsModal';

// Types
import type {
  Client,
  Entreprise,
  Plan,
  Option,
  ClientFormData,
  EspaceMembreData,
  ClientCredentials,
} from './clients/types';

interface ClientsProps {
  onNavigate: (page: string) => void;
}

type TabType = 'liste' | 'super-admin';

export default function Clients({ onNavigate }: ClientsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('liste');
  
  // États principaux
  const [clients, setClients] = useState<Client[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // États formulaires
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
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

  // États espace membre
  const [showEspaceMembreModal, setShowEspaceMembreModal] = useState(false);
  const [selectedClientForEspace, setSelectedClientForEspace] = useState<Client | null>(null);
  const [espaceMembreData, setEspaceMembreData] = useState<EspaceMembreData>({
    password: '',
    plan_id: '',
    options_ids: [],
  });

  // États identifiants
  const [showIdentifiantsModal, setShowIdentifiantsModal] = useState(false);
  const [clientCredentials, setClientCredentials] = useState<ClientCredentials | null>(null);

  // États plans et options
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);

  // Charger les données initiales
  useEffect(() => {
    if (user) {
      loadEntreprises();
      loadPlans();
      loadOptions();
    }
  }, [user]);

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      setSelectedEntreprise(entreprises[0].id);
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
  }, [entreprises]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadClients();
    }
  }, [selectedEntreprise]);

  // Chargement des données
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
    if (!user || !selectedEntreprise) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gestion du formulaire client
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
      alert(`Erreur: ${error?.message || 'Erreur lors de la sauvegarde'}`);
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
    if (
      !confirm(
        'Supprimer ce client et TOUTES ses données (abonnement, espace membre, utilisateur) ?\n\n⚠️ Cette action est irréversible et libérera l\'email pour une réutilisation.'
      )
    )
      return;

    try {
      const { data, error } = await supabase.rpc('delete_client_complete', {
        p_client_id: id,
        p_entreprise_id: selectedEntreprise,
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          const { error: deleteError } = await supabase.from('clients').delete().eq('id', id);
          if (deleteError) throw deleteError;
          alert(
            '⚠️ Client supprimé, mais certaines données peuvent rester.\n\nExécutez la migration delete_client_complete.sql pour une suppression complète.'
          );
        } else {
          throw error;
        }
      } else if (data?.success) {
        alert('✅ Client et toutes ses données supprimées avec succès !');
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

  // Gestion espace membre
  const handleCreateEspaceMembre = async () => {
    if (!selectedClientForEspace || !selectedEntreprise) return;

    if (!selectedClientForEspace.email) {
      alert('Le client doit avoir un email pour créer un espace membre');
      return;
    }
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
        p_password: espaceMembreData.password || null,
        p_plan_id: espaceMembreData.plan_id,
        p_options_ids: espaceMembreData.options_ids.length > 0 ? espaceMembreData.options_ids : [],
      });

      if (error) throw error;

      if (data?.success) {
        loadClients();

        setClientCredentials({
          email: data.email || selectedClientForEspace.email,
          password: data.password || '⚠️ ERREUR: Mot de passe non retourné',
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
      alert(`Erreur: ${error.message || 'Erreur lors de la création de l\'espace membre'}`);
    }
  };

  const handleOpenEspaceMembreModal = (client: Client) => {
    setSelectedClientForEspace(client);
    setEspaceMembreData({
      password: '',
      plan_id: plans.length > 0 ? plans[0].id : '',
      options_ids: [],
    });
    setShowEspaceMembreModal(true);
  };

  // État de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  // Pas d'entreprises
  if (entreprises.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant d'ajouter des clients</p>
          <button
            onClick={() => onNavigate('entreprises')}
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Clients</h1>
          <p className="text-gray-300">Gérez vos clients et prospects</p>
        </div>
        {activeTab === 'liste' && (
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
        )}
      </div>

      {/* Onglets */}
      <div className="mb-8">
        <div className="inline-flex rounded-lg bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('liste')}
            className={`px-6 py-3 font-semibold transition-all rounded-md flex items-center gap-2 ${
              activeTab === 'liste'
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Users className="w-5 h-5" />
            Liste des Clients
          </button>
          <button
            onClick={() => setActiveTab('super-admin')}
            className={`px-6 py-3 font-semibold transition-all rounded-md flex items-center gap-2 ${
              activeTab === 'super-admin'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Crown className="w-5 h-5" />
            Administration Super Admin
          </button>
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === 'liste' && (
        <ClientsList
          clients={clients}
          entreprises={entreprises}
          selectedEntreprise={selectedEntreprise}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onEntrepriseChange={(id) => {
            setSelectedEntreprise(id);
            setFormData((prev) => ({ ...prev, entreprise_id: id }));
          }}
          onEditClient={handleEdit}
          onDeleteClient={handleDelete}
          onCreateEspaceMembre={handleOpenEspaceMembreModal}
        />
      )}

      {activeTab === 'super-admin' && (
        <ClientSuperAdmin
          clients={clients}
          entreprises={entreprises}
          selectedEntreprise={selectedEntreprise}
          onEntrepriseChange={(id) => {
            setSelectedEntreprise(id);
            setFormData((prev) => ({ ...prev, entreprise_id: id }));
          }}
        />
      )}

      {/* Modales */}
      <ClientForm
        show={showForm}
        editingId={editingId}
        formData={formData}
        entreprises={entreprises}
        onSubmit={handleSubmit}
        onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
      />

      <EspaceMembreModal
        show={showEspaceMembreModal}
        client={selectedClientForEspace}
        plans={plans}
        options={options}
        data={espaceMembreData}
        onClose={() => {
          setShowEspaceMembreModal(false);
          setSelectedClientForEspace(null);
          setEspaceMembreData({ password: '', plan_id: plans.length > 0 ? plans[0].id : '', options_ids: [] });
        }}
        onSubmit={handleCreateEspaceMembre}
        onChange={(updates) => setEspaceMembreData((prev) => ({ ...prev, ...updates }))}
      />

      <IdentifiantsModal
        show={showIdentifiantsModal}
        credentials={clientCredentials}
        onClose={() => {
          setShowIdentifiantsModal(false);
          setClientCredentials(null);
        }}
      />
    </div>
  );
}
