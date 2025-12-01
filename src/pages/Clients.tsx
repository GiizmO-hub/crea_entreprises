/**
 * Page Clients - Orchestrateur
 * 
 * Cette page orchestre tous les composants de gestion des clients
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Plus, Users, Building2 } from 'lucide-react';

// Composants
import { ClientsList } from './clients/ClientsList';
import { ClientForm } from './clients/ClientForm';
import { EspaceMembreModal } from './clients/EspaceMembreModal';
import { IdentifiantsModal } from './clients/IdentifiantsModal';
import { ClientDetailsModal } from '../components/ClientDetailsModal';

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


export default function Clients() {
  const { user } = useAuth();
  
  // États principaux
  const [clients, setClients] = useState<Client[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false); // Vérifier si c'est un client de l'espace client

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

  // États modal détails client
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientDetailsModal, setShowClientDetailsModal] = useState(false);

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

  // Vérifier si l'utilisateur est un client de l'espace client
  const checkIfClient = async () => {
    if (!user) {
      setIsClient(false);
      return;
    }

    try {
      const { data: espaceClient } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('actif', true)
        .maybeSingle();

      setIsClient(!!espaceClient);
      console.log('👤 [Clients] isClient:', !!espaceClient);
    } catch (error) {
      console.error('❌ [Clients] Erreur vérification client:', error);
      setIsClient(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkIfClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Charger les entreprises une fois qu'on sait si c'est un client
  useEffect(() => {
    if (user && isClient !== null) {
      loadEntreprises();
      if (!isClient) {
        // Les plans et options ne sont nécessaires que pour les propriétaires
        loadPlans();
        loadOptions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isClient]);

  // ✅ CORRECTION : Un seul useEffect pour gérer la sélection d'entreprise et le chargement
  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      const firstEntrepriseId = entreprises[0].id;
      console.log('🏢 [Clients] Sélection automatique de la première entreprise:', firstEntrepriseId);
      setSelectedEntreprise(firstEntrepriseId);
      setFormData((prev) => ({ ...prev, entreprise_id: firstEntrepriseId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprises]);

  // ✅ CORRECTION : Un seul useEffect pour charger les clients (évite les doubles appels)
  useEffect(() => {
    // Ne charger que si on a toutes les conditions nécessaires
    if (!user) return;
    
    // Si c'est un client, charger immédiatement (pas besoin d'entreprise sélectionnée)
    if (isClient) {
      console.log('🔄 [Clients] Chargement clients (mode client)');
      loadClients();
      return;
    }
    
    // Si c'est un propriétaire, attendre qu'une entreprise soit sélectionnée
    if (selectedEntreprise) {
      console.log('🔄 [Clients] Chargement clients pour entreprise:', selectedEntreprise);
      loadClients();
    } else {
      // Si pas d'entreprise sélectionnée, vider la liste
      console.log('⚠️ [Clients] Aucune entreprise sélectionnée, vidage de la liste');
      setClients([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntreprise, isClient, user]);

  // Chargement des données
  const loadEntreprises = async () => {
    if (!user) return;

    try {
      // ✅ Si c'est un client, charger UNIQUEMENT l'entreprise de son espace membre
      if (isClient) {
        console.log('👤 [Clients] Client détecté - Chargement de son entreprise uniquement');
        
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('entreprise_id')
          .eq('user_id', user.id)
          .eq('actif', true)
          .maybeSingle();

        if (espaceClient?.entreprise_id) {
          const { data: entreprise, error } = await supabase
            .from('entreprises')
            .select('id, nom')
            .eq('id', espaceClient.entreprise_id)
            .maybeSingle();

          if (error) throw error;
          setEntreprises(entreprise ? [entreprise] : []);
          console.log('✅ [Clients] Entreprise du client chargée:', entreprise?.nom);
        } else {
          console.warn('⚠️ [Clients] Aucune entreprise trouvée pour ce client');
          setEntreprises([]);
        }
      } else {
        // ✅ Si c'est un propriétaire ou super_admin, charger toutes les entreprises (RLS filtrera)
        console.log('👑 [Clients] Propriétaire/Super Admin - Chargement entreprises (RLS filtrera)');
        
        const { data, error } = await supabase
          .from('entreprises')
          .select('id, nom')
          .order('nom');

        if (error) {
          console.error('❌ [Clients] Erreur chargement entreprises:', error);
          throw error;
        }
        
        console.log(`✅ [Clients] Entreprises chargées: ${data?.length || 0}`);
        setEntreprises(data || []);
      }
    } catch (error) {
      console.error('❌ [Clients] Erreur chargement entreprises:', error);
      setEntreprises([]);
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
    if (!user) {
      console.warn('⚠️ [Clients] Pas d\'utilisateur, arrêt du chargement');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 [Clients] DÉBUT chargement clients - isClient:', isClient, 'selectedEntreprise:', selectedEntreprise);
      
      // ✅ Si c'est un client de l'espace client, charger SES CONTACTS (client_contacts)
      if (isClient) {
        console.log('👤 [Clients] Client détecté - Chargement de ses contacts (client_contacts)');
        
        // Récupérer le client_id et entreprise_id de l'utilisateur
        const { data: espaceClient, error: espaceError } = await supabase
          .from('espaces_membres_clients')
          .select('client_id, entreprise_id')
          .eq('user_id', user.id)
          .eq('actif', true)
          .maybeSingle();

        if (espaceError) {
          console.error('❌ [Clients] Erreur récupération espace client:', espaceError);
          throw espaceError;
        }

        if (espaceClient?.client_id && espaceClient?.entreprise_id) {
          // ✅ CORRECTION : Charger d'abord le client lui-même depuis clients
          const { data: clientSelf, error: clientSelfError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', espaceClient.client_id)
            .maybeSingle();

          if (clientSelfError) {
            console.error('❌ [Clients] Erreur chargement client lui-même:', clientSelfError);
          }

          // Charger les contacts du client (client_contacts)
          const { data, error } = await supabase
            .from('client_contacts')
            .select('*')
            .eq('client_id', espaceClient.client_id)
            .eq('entreprise_id', espaceClient.entreprise_id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ [Clients] Erreur chargement contacts:', error);
            throw error;
          }
          
          // ✅ CORRECTION : Inclure le client lui-même dans la liste
          const clientsData: Client[] = [];
          
          // Ajouter le client lui-même en premier s'il existe
          if (clientSelf) {
            clientsData.push({
              id: clientSelf.id,
              entreprise_id: clientSelf.entreprise_id,
              nom: clientSelf.nom,
              prenom: clientSelf.prenom,
              entreprise_nom: clientSelf.entreprise_nom,
              email: clientSelf.email,
              telephone: clientSelf.telephone,
              adresse: clientSelf.adresse,
              code_postal: clientSelf.code_postal,
              ville: clientSelf.ville,
              siret: clientSelf.siret,
              statut: clientSelf.statut,
              created_at: clientSelf.created_at,
            });
            console.log('✅ [Clients] Client lui-même ajouté à la liste');
          }
          
          // Ajouter les contacts
          const contactsData = (data || []).map(contact => ({
            id: contact.id,
            entreprise_id: contact.entreprise_id,
            nom: contact.nom,
            prenom: contact.prenom,
            entreprise_nom: contact.entreprise_nom,
            email: contact.email,
            telephone: contact.telephone,
            adresse: contact.adresse,
            code_postal: contact.code_postal,
            ville: contact.ville,
            siret: contact.siret,
            statut: contact.statut,
            created_at: contact.created_at,
          }));
          
          clientsData.push(...contactsData);
          
          console.log(`✅ [Clients] ${clientsData.length} éléments chargés (1 client + ${contactsData.length} contacts)`);
          setClients(clientsData);
        } else {
          console.warn('⚠️ [Clients] Aucun client_id ou entreprise_id trouvé pour cet utilisateur');
          setClients([]);
        }
      } else {
        // ✅ Si c'est un propriétaire ou super_admin, charger les CLIENTS DE LA PLATEFORME (clients)
        if (!selectedEntreprise) {
          console.warn('⚠️ [Clients] Aucune entreprise sélectionnée pour charger les clients');
          setClients([]);
          setLoading(false);
          return;
        }

        console.log('👑 [Clients] Propriétaire/Super Admin - Chargement clients de la plateforme');
        console.log('   Entreprise sélectionnée:', selectedEntreprise);
        
        // ✅ CORRECTION : Ne PAS filtrer par statut pour voir TOUS les clients (y compris en_attente)
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('entreprise_id', selectedEntreprise)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [Clients] Erreur chargement clients:', error);
          console.error('   Code:', error.code);
          console.error('   Message:', error.message);
          console.error('   Details:', error.details);
          throw error;
        }
        
        console.log(`✅ [Clients] ${data?.length || 0} clients de la plateforme chargés pour l'entreprise`);
        if (data && data.length > 0) {
          console.log('   Détails des clients:', data.map(c => ({ 
            id: c.id, 
            nom: c.nom, 
            prenom: c.prenom, 
            email: c.email,
            statut: c.statut 
          })));
        }
        setClients(data || []);
      }
    } catch (error) {
      console.error('❌ [Clients] Erreur chargement clients:', error);
      // ✅ CORRECTION : Ne pas vider la liste en cas d'erreur, garder les clients précédents
      // setClients([]); // Commenté pour éviter de vider la liste
    } finally {
      setLoading(false);
      console.log('✅ [Clients] FIN chargement clients');
    }
  };

  // Gestion du formulaire client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Si c'est un client, utiliser client_contacts
    if (isClient) {
      try {
        setLoading(true);
        
        // Récupérer le client_id et entreprise_id de l'utilisateur
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('client_id, entreprise_id')
          .eq('user_id', user?.id)
          .eq('actif', true)
          .maybeSingle();

        if (!espaceClient?.client_id || !espaceClient?.entreprise_id) {
          alert('Erreur: Impossible de trouver votre espace client');
          return;
        }

        const contactData = {
          client_id: espaceClient.client_id,
          entreprise_id: espaceClient.entreprise_id,
          nom: formData.nom,
          prenom: formData.prenom || null,
          email: formData.email || null,
          telephone: formData.telephone || null,
          adresse: formData.adresse || null,
          code_postal: formData.code_postal || null,
          ville: formData.ville || null,
          entreprise_nom: formData.entreprise_nom || null,
          siret: formData.siret || null,
          statut: 'actif' as const,
          created_by: user?.id,
        };

        if (editingId) {
          // Mise à jour d'un contact existant
          const { error } = await supabase
            .from('client_contacts')
            .update(contactData)
            .eq('id', editingId);

          if (error) throw error;
          alert('Contact modifié avec succès !');
        } else {
          // Création d'un nouveau contact
          const { error } = await supabase
            .from('client_contacts')
            .insert(contactData);

          if (error) throw error;
          alert('Contact créé avec succès !');
        }

        // Réinitialiser le formulaire et recharger
        setFormData({
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
        setEditingId(null);
        setShowForm(false);
        loadClients();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Erreur création/modification contact:', error);
        alert(`Erreur: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // ✅ Si c'est un propriétaire, utiliser clients (clients de la plateforme)
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      // Validation des champs requis
      if (!formData.email || !formData.email.trim()) {
        alert('⚠️ L\'email est requis');
        return;
      }

      const dataToSave = {
        entreprise_id: selectedEntreprise,
        nom: formData.nom?.trim() || null,
        prenom: formData.prenom?.trim() || null,
        entreprise_nom: formData.entreprise_nom?.trim() || null,
        email: formData.email.trim(),
        telephone: formData.telephone?.trim() || null,
        adresse: formData.adresse?.trim() || null,
        code_postal: formData.code_postal?.trim() || null,
        ville: formData.ville?.trim() || null,
        siret: formData.siret?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      console.log('💾 Tentative de sauvegarde client:', { editingId, dataToSave });

      if (editingId) {
        const { data, error } = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', editingId)
          .select();

        if (error) {
          console.error('❌ Erreur UPDATE client:', error);
          throw error;
        }
        console.log('✅ Client modifié:', data);
        alert('✅ Client modifié avec succès!');
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert([dataToSave])
          .select();

        if (error) {
          console.error('❌ Erreur INSERT client:', error);
          console.error('   Code:', error.code);
          console.error('   Message:', error.message);
          console.error('   Details:', error.details);
          console.error('   Hint:', error.hint);
          throw error;
        }
        console.log('✅ Client créé:', data);
        alert('✅ Client créé avec succès!');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadClients();
    } catch (error: unknown) {
      console.error('❌ Erreur complète sauvegarde client:', error);
      
      let errorMessage = 'Erreur lors de la sauvegarde';
      let errorDetails = '';
      
      if (error && typeof error === 'object') {
        const err = error as { message?: string; code?: string; details?: string; hint?: string };
        
        if (err.message) {
          errorMessage = err.message;
        }
        
        if (err.code) {
          errorDetails += `\nCode: ${err.code}`;
        }
        
        if (err.details) {
          errorDetails += `\nDétails: ${err.details}`;
        }
        
        if (err.hint) {
          errorDetails += `\nIndication: ${err.hint}`;
        }
        
        // Messages d'erreur spécifiques
        if (err.code === '23505') {
          errorMessage = 'Un client avec cet email existe déjà';
        } else if (err.code === '23503') {
          errorMessage = 'L\'entreprise sélectionnée n\'existe pas ou vous n\'avez pas les permissions';
        } else if (err.code === '42501') {
          errorMessage = 'Permission refusée. Vérifiez vos droits d\'accès.';
        } else if (err.message?.includes('RLS') || err.message?.includes('policy')) {
          errorMessage = 'Permission refusée par les règles de sécurité (RLS)';
          errorDetails += '\n\nVérifiez que vous avez les droits pour créer des clients pour cette entreprise.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(`❌ Erreur: ${errorMessage}${errorDetails}\n\nConsultez la console (F12) pour plus de détails.`);
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
    // ✅ Si c'est un client, supprimer depuis client_contacts
    if (isClient) {
      if (!confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) return;

      try {
        const { error: deleteError } = await supabase
          .from('client_contacts')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;
        alert('✅ Contact supprimé avec succès !');
        loadClients();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Erreur suppression contact:', error);
        alert(`Erreur: ${errorMessage}`);
      }
      return;
    }

    // ✅ Si c'est un propriétaire, supprimer depuis clients (clients de la plateforme)
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression:', error);
      alert(`Erreur lors de la suppression: ${errorMessage}`);
    }
  };

  const resetForm = () => {
    // Si c'est un client, ne pas réinitialiser entreprise_id (sera défini automatiquement dans handleSubmit)
    setFormData({
      entreprise_id: isClient ? '' : selectedEntreprise,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de l\'espace membre';
      console.error('Erreur création espace membre:', error);
      alert(`Erreur: ${errorMessage}`);
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
            onClick={() => window.location.reload()}
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
          <p className="text-gray-300">
            {isClient ? 'Vos informations client' : 'Gérez vos clients et prospects'}
          </p>
        </div>
        {/* Bouton "Ajouter un client/contact" - visible pour tous */}
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          {isClient ? 'Ajouter un contact' : 'Ajouter un client'}
        </button>
      </div>


      {/* Liste des clients */}
      <ClientsList
          clients={clients}
          entreprises={isClient ? [] : entreprises} // Masquer le sélecteur d'entreprise pour les clients
          selectedEntreprise={isClient ? '' : selectedEntreprise} // Pas d'entreprise sélectionnée pour les clients
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onEntrepriseChange={(id) => {
            if (!isClient) {
              setSelectedEntreprise(id);
              setFormData((prev) => ({ ...prev, entreprise_id: id }));
            }
          }}
          onEditClient={handleEdit}
          onDeleteClient={handleDelete}
          onCreateEspaceMembre={isClient ? undefined : handleOpenEspaceMembreModal}
          onViewClientDetails={(clientId) => {
            setSelectedClientId(clientId);
            setShowClientDetailsModal(true);
          }}
        />

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

      {/* Modal Détails Client */}
      <ClientDetailsModal
        clientId={selectedClientId}
        isOpen={showClientDetailsModal}
        onClose={() => {
          setShowClientDetailsModal(false);
          setSelectedClientId(null);
        }}
        onUpdate={() => {
          loadClients();
        }}
      />
    </div>
  );
}
