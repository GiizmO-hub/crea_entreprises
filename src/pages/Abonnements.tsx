import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CreditCard, Plus, X, DollarSign, Package, CheckCircle, AlertCircle, Edit, Search, Filter, ExternalLink, Copy, Check, Mail, Trash2 } from 'lucide-react';

interface AbonnementsProps {
  onNavigate: (page: string) => void;
}

interface Plan {
  id: string;
  nom: string;
  description: string;
  prix_mensuel: number;
  prix_annuel: number;
  fonctionnalites: Record<string, boolean>;
  max_entreprises: number;
  max_utilisateurs: number;
  max_factures_mois: number;
  actif: boolean;
  ordre: number;
}

interface Option {
  id: string;
  nom: string;
  description: string;
  prix_mensuel: number;
  type: string;
  actif: boolean;
  code?: string;
}

interface Abonnement {
  id: string;
  client_id?: string;
  user_id?: string;
  entreprise_id?: string;
  plan_id: string;
  plan_nom?: string;
  statut: string;
  date_debut: string;
  date_fin?: string;
  date_prochain_paiement?: string;
  montant_mensuel: number;
  mode_paiement: string;
  created_at: string;
  client_email?: string;
  client_nom?: string;
  options?: Array<{
    id: string;
    nom: string;
    prix_mensuel: number;
    actif: boolean;
  }>;
}

interface Client {
  id: string;
  email: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
}

export default function Abonnements({ onNavigate: _onNavigate }: AbonnementsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAbonnement, setEditingAbonnement] = useState<Abonnement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedAbonnementForLink, setSelectedAbonnementForLink] = useState<Abonnement | null>(null);
  const [clientAccessLink, setClientAccessLink] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [formData, setFormData] = useState({
    client_id: '',
    plan_id: '',
    mode_paiement: 'mensuel' as 'mensuel' | 'annuel',
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: '',
    montant_mensuel: 0,
    options_selected: [] as string[],
    prix_sur_mesure: false,
    prix_personnalise: 0,
  });

  useEffect(() => {
    checkSuperAdmin();
    loadData();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      const { data: utilisateur, error } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        setIsSuperAdmin(isAdmin);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      setIsSuperAdmin(isAdmin);
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, email, nom, prenom, entreprise_nom')
        .order('created_at', { ascending: false });

      if (clientsData) {
        setClients(clientsData);
      }

      // Charger les plans
      const { data: plansData } = await supabase
        .from('plans_abonnement')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true });

      if (plansData) {
        setPlans(plansData);
      }

      // Charger les modules créés (remplace les anciennes options)
      // On affiche uniquement les modules créés qui peuvent être ajoutés comme options
      const { data: modulesData } = await supabase
        .from('modules_activation')
        .select('id, module_code, module_nom, module_description, prix_optionnel, categorie, secteur_activite, est_cree, icone')
        .eq('est_cree', true)
        .in('categorie', ['option', 'premium']) // Uniquement les modules optionnels ou premium
        .order('module_nom', { ascending: true });

      if (modulesData) {
        // Transformer les modules en format Option pour la compatibilité
        const modulesAsOptions = modulesData.map(mod => ({
          id: mod.id,
          nom: mod.module_nom,
          description: mod.module_description || '',
          prix_mensuel: mod.prix_optionnel || 0,
          type: mod.secteur_activite || 'module',
          actif: true,
          code: mod.module_code,
        }));
        setOptions(modulesAsOptions);
        console.log('✅ Modules chargés comme options:', modulesAsOptions.length);
      } else {
        setOptions([]);
        console.log('⚠️ Aucun module disponible comme option');
      }

      // Charger les abonnements après un court délai pour s'assurer que la création est terminée
      setTimeout(async () => {
        await loadAbonnements();
      }, 500);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAbonnements = async () => {
    try {
      let query = supabase
        .from('abonnements')
        .select(`
          id,
          entreprise_id,
          plan_id,
          statut,
          date_debut,
          date_fin,
          date_prochain_paiement,
          montant_mensuel,
          mode_paiement,
          created_at,
          plans_abonnement (
            nom
          )
        `)
        .order('created_at', { ascending: false });

      if (!isSuperAdmin) {
        // Utilisateurs normaux ne voient que leurs abonnements
        // Via entreprise
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id')
          .eq('user_id', user?.id);

        if (entreprises && entreprises.length > 0) {
          query = query.in('entreprise_id', entreprises.map(e => e.id));
        } else {
          setAbonnements([]);
          return;
        }
      }

      const { data: abonnementsData, error } = await query;

      if (error) {
        console.error('Erreur chargement abonnements:', error);
        throw error;
      }

      console.log('Abonnements chargés:', abonnementsData?.length || 0, 'abonnement(s)');

      // Enrichir avec les informations client et options
      const enrichedAbonnements = await Promise.all(
        (abonnementsData || []).map(async (ab: any) => {
          // Récupérer les informations client via entreprise_id
          let clientEmail = '';
          let clientNom = '';
          let clientId: string | null = null;
          
          // La table abonnements n'a pas de client_id, on cherche via entreprise_id
          if (ab.entreprise_id) {
            // Chercher le premier client de cette entreprise
            const { data: clientsData } = await supabase
              .from('clients')
              .select('id, email, nom, prenom, entreprise_nom')
              .eq('entreprise_id', ab.entreprise_id)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (clientsData && clientsData.length > 0) {
              const clientData = clientsData[0];
              clientId = clientData.id;
              clientEmail = clientData.email || '';
              clientNom = clientData.nom || clientData.prenom || clientData.entreprise_nom || '';
            }
          }

          // Récupérer les options souscrites
          const { data: optionsData } = await supabase
            .from('abonnement_options')
            .select(`
              id,
              actif,
              options_supplementaires (
                id,
                nom,
                prix_mensuel
              )
            `)
            .eq('abonnement_id', ab.id)
            .eq('actif', true);

          const optionsActives = (optionsData || [])
            .map((opt: any) => opt.options_supplementaires)
            .filter((opt: any) => opt && opt.actif !== false);

          return {
            ...ab,
            plan_nom: ab.plans_abonnement?.nom || 'Inconnu',
            client_id: clientId || undefined,
            client_email: clientEmail,
            client_nom: clientNom,
            options: optionsActives,
          };
        })
      );

      console.log('Abonnements enrichis:', enrichedAbonnements?.length || 0, 'abonnement(s)');
      setAbonnements(enrichedAbonnements);
    } catch (error) {
      console.error('Erreur chargement abonnements:', error);
    }
  };

  const handleCreateAbonnement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si on est en mode édition, utiliser handleUpdateAbonnement
    if (editingAbonnement) {
      await handleUpdateAbonnement(e);
      return;
    }

    if (!formData.client_id || !formData.plan_id) {
      alert('❌ Veuillez sélectionner un client et un plan');
      return;
    }

    try {
      // Récupérer le plan sélectionné
      const plan = plans.find(p => p.id === formData.plan_id);
      if (!plan) {
        alert('❌ Plan non trouvé');
        return;
      }

      // Récupérer le client et son entreprise
      const client = clients.find(c => c.id === formData.client_id);
      if (!client) {
        alert('❌ Client non trouvé');
        return;
      }

      // Récupérer l'entreprise du client ou celle de l'utilisateur connecté
      const { data: clientData } = await supabase
        .from('clients')
        .select('entreprise_id')
        .eq('id', formData.client_id)
        .single();

      // Si le client n'a pas d'entreprise, récupérer celle de l'utilisateur
      let entrepriseId = clientData?.entreprise_id;
      
      if (!entrepriseId) {
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id')
          .eq('user_id', user?.id)
          .limit(1)
          .single();

        entrepriseId = entreprises?.id || null;
      }

      // Utiliser la fonction RPC pour créer l'abonnement complet
      // Le calcul du montant est fait côté serveur dans la fonction RPC
      const { data: result, error: rpcError } = await supabase
        .rpc('create_abonnement_complete', {
          p_client_id: formData.client_id,
          p_plan_id: formData.plan_id,
          p_entreprise_id: entrepriseId,
          p_mode_paiement: formData.mode_paiement,
          p_date_debut: formData.date_debut,
          p_date_fin: formData.date_fin || null,
          p_montant_mensuel: formData.prix_sur_mesure ? formData.prix_personnalise : null,
          p_options_ids: formData.options_selected.length > 0 ? formData.options_selected : null,
          p_statut: 'actif'
        });

      if (rpcError || !result?.success) {
        throw new Error(result?.error || rpcError?.message || 'Erreur lors de la création');
      }

      alert('✅ Abonnement créé avec succès!');
      setShowForm(false);
      resetForm();
      await loadAbonnements();
    } catch (error: any) {
      console.error('Erreur création abonnement:', error);
      alert('❌ Erreur lors de la création: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleUpdateAbonnement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbonnement || !user) return;

    try {
      // Calculer le montant total
      const plan = plans.find(p => p.id === formData.plan_id);
      if (!plan) {
        throw new Error('Plan non trouvé');
      }

      const montantPlan = formData.prix_sur_mesure 
        ? formData.prix_personnalise 
        : (formData.mode_paiement === 'mensuel' ? plan.prix_mensuel : plan.prix_annuel / 12);

      const montantOptions = formData.options_selected
        .map(optId => {
          const opt = options.find(o => o.id === optId);
          return opt ? opt.prix_mensuel : 0;
        })
        .reduce((sum, prix) => sum + prix, 0);

      const montantTotal = montantPlan + montantOptions;

      // Mettre à jour l'abonnement
      const { error: updateError } = await supabase
        .from('abonnements')
        .update({
          plan_id: formData.plan_id,
          mode_paiement: formData.mode_paiement,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin || null,
          montant_mensuel: montantTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAbonnement.id);

      if (updateError) {
        throw updateError;
      }

      // Mettre à jour les options de l'abonnement
      // Supprimer les anciennes options
      const { error: deleteOptionsError } = await supabase
        .from('abonnement_options')
        .delete()
        .eq('abonnement_id', editingAbonnement.id);

      if (deleteOptionsError) {
        console.error('Erreur suppression options:', deleteOptionsError);
      }

      // Ajouter les nouvelles options
      if (formData.options_selected.length > 0) {
        const optionsToInsert = formData.options_selected.map(optionId => ({
          abonnement_id: editingAbonnement.id,
          option_id: optionId,
          actif: true,
          date_activation: new Date().toISOString().split('T')[0],
        }));

        const { error: insertOptionsError } = await supabase
          .from('abonnement_options')
          .insert(optionsToInsert);

        if (insertOptionsError) {
          console.error('Erreur insertion options:', insertOptionsError);
        }
      }

      alert('✅ Abonnement modifié avec succès!');
      setShowForm(false);
      resetForm();
      await loadAbonnements();
    } catch (error: any) {
      console.error('Erreur modification abonnement:', error);
      alert('❌ Erreur lors de la modification: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleDeleteAbonnement = async (abonnementId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet abonnement ? Cette action est irréversible.')) {
      return;
    }

    try {
      // Supprimer d'abord les options de l'abonnement
      const { error: deleteOptionsError } = await supabase
        .from('abonnement_options')
        .delete()
        .eq('abonnement_id', abonnementId);

      if (deleteOptionsError) {
        console.error('Erreur suppression options:', deleteOptionsError);
      }

      // Supprimer l'abonnement
      const { error: deleteError } = await supabase
        .from('abonnements')
        .delete()
        .eq('id', abonnementId);

      if (deleteError) {
        throw deleteError;
      }

      alert('✅ Abonnement supprimé avec succès!');
      await loadAbonnements();
    } catch (error: any) {
      console.error('Erreur suppression abonnement:', error);
      alert('❌ Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleEdit = async (abonnement: Abonnement) => {
    // Récupérer le client_id via entreprise_id pour l'édition
    let clientIdForEdit = '';
    if (abonnement.entreprise_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('entreprise_id', abonnement.entreprise_id)
        .limit(1)
        .maybeSingle();
      
      if (clientData) {
        clientIdForEdit = clientData.id;
      }
    }

    setEditingAbonnement(abonnement);
    setFormData({
      client_id: clientIdForEdit || abonnement.client_id || '',
      plan_id: abonnement.plan_id,
      mode_paiement: abonnement.mode_paiement as 'mensuel' | 'annuel',
      date_debut: abonnement.date_debut,
      date_fin: abonnement.date_fin || '',
      montant_mensuel: abonnement.montant_mensuel,
      options_selected: abonnement.options?.map(opt => opt.id) || [],
      prix_sur_mesure: false,
      prix_personnalise: abonnement.montant_mensuel,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      plan_id: '',
      mode_paiement: 'mensuel',
      date_debut: new Date().toISOString().split('T')[0],
      date_fin: '',
      montant_mensuel: 0,
      options_selected: [],
      prix_sur_mesure: false,
      prix_personnalise: 0,
    });
    setEditingAbonnement(null);
  };

  const calculateTotal = () => {
    const plan = plans.find(p => p.id === formData.plan_id);
    if (!plan) return 0;

    const montantPlan = formData.prix_sur_mesure 
      ? formData.prix_personnalise 
      : (formData.mode_paiement === 'mensuel' ? plan.prix_mensuel : plan.prix_annuel / 12);

    const montantOptions = formData.options_selected
      .map(optId => {
        const opt = options.find(o => o.id === optId);
        return opt ? opt.prix_mensuel : 0;
      })
      .reduce((sum, prix) => sum + prix, 0);

    return montantPlan + montantOptions;
  };

  const handleGenerateAccessLink = async (abonnement: Abonnement) => {
    try {
      // Récupérer le client_id de l'abonnement
      let clientId: string | null = null;
      
      if (abonnement.client_id) {
        clientId = abonnement.client_id;
      } else if (abonnement.entreprise_id) {
        // Chercher le client via entreprise_id
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, email')
          .eq('entreprise_id', abonnement.entreprise_id)
          .limit(1)
          .maybeSingle();
        
        if (clientData) {
          clientId = clientData.id;
        }
      }

      if (!clientId) {
        alert('❌ Impossible de générer le lien : client non trouvé');
        return;
      }

      // Récupérer les informations du client
      const { data: clientData } = await supabase
        .from('clients')
        .select('email, nom, prenom, entreprise_nom')
        .eq('id', clientId)
        .single();

      if (!clientData || !clientData.email) {
        alert('❌ Impossible de générer le lien : client sans email');
        return;
      }

      // Chercher le user_id dans espaces_membres_clients
      let clientUserId: string | null = null;
      const { data: espaceData } = await supabase
        .from('espaces_membres_clients')
        .select('user_id')
        .eq('client_id', clientId)
        .maybeSingle();
      
      clientUserId = espaceData?.user_id || null;

      // Générer le lien d'accès
      const baseUrl = window.location.origin;
      
      if (clientUserId) {
        // Lien avec client_id pour redirection vers l'espace client
        const link = `${baseUrl}/espace-client?client_id=${clientId}&token=${encodeURIComponent(clientUserId.substring(0, 8))}`;
        setClientAccessLink(link);
      } else {
        // Lien avec email pour page de connexion pré-remplie
        const link = `${baseUrl}/auth?email=${encodeURIComponent(clientData.email)}&redirect=espace-client&client_id=${clientId}`;
        setClientAccessLink(link);
      }

      setSelectedAbonnementForLink(abonnement);
      setShowLinkModal(true);
    } catch (error: any) {
      console.error('Erreur génération lien:', error);
      alert('❌ Erreur lors de la génération du lien: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Erreur copie:', error);
      alert('❌ Erreur lors de la copie');
    }
  };

  const filteredAbonnements = abonnements.filter((ab) => {
    const matchesSearch = !searchTerm || 
      ab.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ab.client_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ab.plan_nom?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = filterStatut === 'all' || ab.statut === filterStatut;
    
    return matchesSearch && matchesStatut;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Abonnements</h1>
          <p className="text-gray-300">Gestion des abonnements clients</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Créer un Abonnement
          </button>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total</p>
              <p className="text-3xl font-bold text-white">{abonnements.length}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Actifs</p>
              <p className="text-3xl font-bold text-green-400">
                {abonnements.filter(a => a.statut === 'actif').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Suspendus</p>
              <p className="text-3xl font-bold text-orange-400">
                {abonnements.filter(a => a.statut === 'suspendu').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">CA Mensuel</p>
              <p className="text-3xl font-bold text-purple-400">
                {abonnements
                  .filter(a => a.statut === 'actif')
                  .reduce((sum, a) => sum + (a.montant_mensuel || 0), 0)
                  .toFixed(0)}€
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par client, email, plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="suspendu">Suspendus</option>
              <option value="annule">Annulés</option>
              <option value="expire">Expirés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des abonnements */}
      <div className="space-y-4">
        {filteredAbonnements.map((abonnement) => (
          <div
            key={abonnement.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-white text-lg">
                      {abonnement.client_nom || abonnement.client_email || 'Client inconnu'}
                    </h3>
                    <p className="text-sm text-gray-400">{abonnement.client_email}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Plan</p>
                    <p className="text-white font-semibold">{abonnement.plan_nom}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Montant mensuel</p>
                    <p className="text-white font-semibold">{abonnement.montant_mensuel.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Mode paiement</p>
                    <p className="text-white font-semibold capitalize">{abonnement.mode_paiement}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Date début</p>
                    <p className="text-white font-semibold">
                      {new Date(abonnement.date_debut).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                {abonnement.options && abonnement.options.length > 0 && (
                  <div className="mt-3">
                    <p className="text-gray-400 text-sm mb-2">Options souscrites:</p>
                    <div className="flex flex-wrap gap-2">
                      {abonnement.options.map((opt) => (
                        <span
                          key={opt.id}
                          className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold"
                        >
                          {opt.nom} (+{opt.prix_mensuel}€/mois)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 ml-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    abonnement.statut === 'actif'
                      ? 'bg-green-500/20 text-green-300'
                      : abonnement.statut === 'suspendu'
                      ? 'bg-orange-500/20 text-orange-300'
                      : abonnement.statut === 'annule'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {abonnement.statut.charAt(0).toUpperCase() + abonnement.statut.slice(1)}
                </span>
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => handleGenerateAccessLink(abonnement)}
                      className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
                      title="Lien d'accès espace client"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(abonnement)}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAbonnement(abonnement.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAbonnements.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <CreditCard className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Aucun abonnement trouvé</p>
        </div>
      )}

      {/* Formulaire Modal - Créer/Modifier Abonnement */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-4xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingAbonnement ? 'Modifier un Abonnement' : 'Créer un Abonnement sur Mesure'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAbonnement} className="space-y-6">
              {/* Sélection Client */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nom || client.prenom || client.entreprise_nom || client.email} ({client.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sélection Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Plan *</label>
                <select
                  required
                  value={formData.plan_id}
                  onChange={(e) => {
                    const plan = plans.find(p => p.id === e.target.value);
                    setFormData({
                      ...formData,
                      plan_id: e.target.value,
                      montant_mensuel: plan ? (formData.mode_paiement === 'mensuel' ? plan.prix_mensuel : plan.prix_annuel / 12) : 0,
                    });
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Sélectionner un plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nom} - {plan.prix_mensuel}€/mois ({plan.prix_annuel}€/an)
                    </option>
                  ))}
                </select>
                {formData.plan_id && (
                  <p className="text-xs text-gray-400 mt-1">
                    {plans.find(p => p.id === formData.plan_id)?.description}
                  </p>
                )}
              </div>

              {/* Prix sur mesure */}
              {formData.plan_id && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.prix_sur_mesure}
                      onChange={(e) => setFormData({ ...formData, prix_sur_mesure: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-yellow-300">
                      Prix personnalisé (sur mesure)
                    </span>
                  </label>
                  {formData.prix_sur_mesure && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Prix mensuel personnalisé (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.prix_personnalise}
                        onChange={(e) => setFormData({ ...formData, prix_personnalise: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Mode de paiement */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Mode de paiement *</label>
                  <select
                    required
                    value={formData.mode_paiement}
                    onChange={(e) => {
                      const plan = plans.find(p => p.id === formData.plan_id);
                      setFormData({
                        ...formData,
                        mode_paiement: e.target.value as 'mensuel' | 'annuel',
                        montant_mensuel: plan && !formData.prix_sur_mesure 
                          ? (e.target.value === 'mensuel' ? plan.prix_mensuel : plan.prix_annuel / 12)
                          : formData.montant_mensuel,
                      });
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="mensuel">Mensuel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date de début *</label>
                  <input
                    type="date"
                    required
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={formData.date_fin}
                  onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-gray-400 mt-1">Laisser vide pour un abonnement sans limite</p>
              </div>

              {/* Modules créés disponibles comme options */}
              {options.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Modules disponibles (options supplémentaires)
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Sélectionnez les modules créés que vous souhaitez ajouter à cet abonnement
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto bg-white/5 rounded-lg p-4">
                    {options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-all border border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={formData.options_selected.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                options_selected: [...formData.options_selected, option.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                options_selected: formData.options_selected.filter(id => id !== option.id),
                              });
                            }
                          }}
                          className="mt-1 w-4 h-4 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{option.nom}</span>
                            {option.prix_mensuel > 0 ? (
                              <span className="text-green-400 font-semibold">+{option.prix_mensuel}€/mois</span>
                            ) : (
                              <span className="text-blue-400 font-semibold text-xs">Inclus</span>
                            )}
                          </div>
                          {option.description && (
                            <p className="text-xs text-gray-400 mt-1">{option.description}</p>
                          )}
                          {option.code && (
                            <p className="text-xs text-gray-500 mt-1">Code: {option.code}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">
                    Aucun module créé disponible comme option. Les modules doivent être créés et avoir la catégorie "option" ou "premium" pour apparaître ici.
                  </p>
                </div>
              )}

              {/* Récapitulatif prix */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Montant du plan:</span>
                  <span className="text-white font-semibold">
                    {formData.prix_sur_mesure 
                      ? `${formData.prix_personnalise.toFixed(2)}€`
                      : formData.plan_id 
                        ? `${(plans.find(p => p.id === formData.plan_id)?.prix_mensuel || 0).toFixed(2)}€`
                        : '0.00€'}
                  </span>
                </div>
                {formData.options_selected.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Options ({formData.options_selected.length}):</span>
                    <span className="text-white font-semibold">
                      +{formData.options_selected
                        .map(id => options.find(o => o.id === id)?.prix_mensuel || 0)
                        .reduce((sum, prix) => sum + prix, 0)
                        .toFixed(2)}€/mois
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-white font-bold text-lg">Total mensuel:</span>
                  <span className="text-green-400 font-bold text-xl">{calculateTotal().toFixed(2)}€</span>
                </div>
                {formData.mode_paiement === 'annuel' && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-300">Total annuel:</span>
                    <span className="text-green-400 font-bold text-lg">{(calculateTotal() * 12).toFixed(2)}€</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  {editingAbonnement ? 'Modifier l\'Abonnement' : 'Créer l\'Abonnement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lien d'Accès Espace Client */}
      {showLinkModal && selectedAbonnementForLink && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Lien d'Accès Espace Client
                </h2>
                <p className="text-gray-400 text-sm">
                  Pour : <span className="text-white font-semibold">
                    {selectedAbonnementForLink.client_nom || selectedAbonnementForLink.client_email || 'Client'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedAbonnementForLink(null);
                  setClientAccessLink('');
                }}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Lien d'accès à l'espace client
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={clientAccessLink}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    onClick={() => copyToClipboard(clientAccessLink)}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ce lien permet d'accéder directement à l'espace client. Partagez-le par email ou messagerie.
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-300 mb-2">📋 Instructions</h3>
                <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                  <li>Copiez le lien ci-dessus</li>
                  <li>Envoyez-le au client par email ou messagerie</li>
                  <li>Le client pourra accéder à son espace membre</li>
                  <li>Si l'espace n'est pas encore créé, une page de connexion s'affichera</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setSelectedAbonnementForLink(null);
                    setClientAccessLink('');
                  }}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    const subject = encodeURIComponent('Accès à votre espace client');
                    const body = encodeURIComponent(
                      `Bonjour,\n\nVoici votre lien d'accès à votre espace client :\n\n${clientAccessLink}\n\nCordialement`
                    );
                    window.location.href = `mailto:${selectedAbonnementForLink.client_email}?subject=${subject}&body=${body}`;
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                  disabled={!selectedAbonnementForLink.client_email}
                >
                  <Mail className="w-5 h-5" />
                  Envoyer par Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

