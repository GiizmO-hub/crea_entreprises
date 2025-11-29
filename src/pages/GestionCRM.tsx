import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  Search,
  Building2,
  X,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  BarChart3,
  Users,
  Target,
  DollarSign,
  FileText,
  Sparkles,
  Bot,
  Wand2,
  Brain,
  Lightbulb,
} from 'lucide-react';

interface PipelineEtape {
  id: string;
  entreprise_id: string;
  nom: string;
  description?: string;
  couleur: string;
  ordre: number;
  probabilite: number;
  est_etape_finale: boolean;
  type_etape: 'en_cours' | 'gagne' | 'perdu';
  actif: boolean;
}

interface Opportunite {
  id: string;
  entreprise_id: string;
  client_id?: string;
  nom: string;
  description?: string;
  montant_estime: number;
  devise: string;
  etape_id?: string;
  probabilite: number;
  date_fermeture_prevue?: string;
  date_fermeture_reelle?: string;
  statut: 'ouverte' | 'gagnee' | 'perdue' | 'annulee';
  source?: string;
  responsable_id?: string;
  notes?: string;
  tags?: string[];
  client?: {
    id: string;
    nom: string;
    prenom?: string;
    entreprise_nom?: string;
  };
  etape?: PipelineEtape;
}

interface Activite {
  id: string;
  entreprise_id: string;
  opportunite_id?: string;
  client_id?: string;
  type_activite: 'appel' | 'email' | 'reunion' | 'tache' | 'note' | 'autre';
  sujet: string;
  description?: string;
  date_activite: string;
  duree_minutes?: number;
  statut: 'planifiee' | 'en_cours' | 'terminee' | 'annulee';
  priorite: 'basse' | 'normale' | 'haute' | 'urgente';
  responsable_id?: string;
  resultat?: string;
  client?: {
    id: string;
    nom: string;
    prenom?: string;
  };
}

interface CampagneEmail {
  id: string;
  entreprise_id: string;
  nom: string;
  description?: string;
  objet_email: string;
  contenu_email: string;
  type_contenu: 'html' | 'texte';
  statut: 'brouillon' | 'planifiee' | 'en_cours' | 'terminee' | 'annulee';
  date_envoi_prevue?: string;
  date_envoi_reelle?: string;
  nombre_destinataires: number;
  nombre_envoyes: number;
  nombre_ouverts: number;
  nombre_clics: number;
  taux_ouverture: number;
  taux_clic: number;
}

export default function GestionCRM() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [etapes, setEtapes] = useState<PipelineEtape[]>([]);
  const [opportunites, setOpportunites] = useState<Opportunite[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [campagnes, setCampagnes] = useState<CampagneEmail[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; nom: string; prenom?: string; entreprise_nom?: string }>>([]);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'opportunites' | 'activites' | 'campagnes' | 'stats'>('pipeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showOpportuniteForm, setShowOpportuniteForm] = useState(false);
  const [showActiviteForm, setShowActiviteForm] = useState(false);
  const [showCampagneForm, setShowCampagneForm] = useState(false);
  const [showEtapeForm, setShowEtapeForm] = useState(false);
  const [editingOpportunite, setEditingOpportunite] = useState<Opportunite | null>(null);
  const [editingActivite, setEditingActivite] = useState<Activite | null>(null);
  const [editingCampagne, setEditingCampagne] = useState<CampagneEmail | null>(null);
  const [editingEtape, setEditingEtape] = useState<PipelineEtape | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiAction, setAiAction] = useState<string>('');

  const [opportuniteFormData, setOpportuniteFormData] = useState({
    nom: '',
    description: '',
    client_id: '',
    montant_estime: 0,
    devise: 'EUR',
    etape_id: '',
    probabilite: 50,
    date_fermeture_prevue: '',
    source: '',
    notes: '',
    tags: [] as string[],
  });

  const [activiteFormData, setActiviteFormData] = useState({
    type_activite: 'appel' as const,
    sujet: '',
    description: '',
    client_id: '',
    opportunite_id: '',
    date_activite: new Date().toISOString().slice(0, 16),
    duree_minutes: 30,
    statut: 'planifiee' as const,
    priorite: 'normale' as const,
    resultat: '',
  });

  const [campagneFormData, setCampagneFormData] = useState({
    nom: '',
    description: '',
    objet_email: '',
    contenu_email: '',
    type_contenu: 'html' as const,
    date_envoi_prevue: '',
  });

  const [etapeFormData, setEtapeFormData] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6',
    ordre: 0,
    probabilite: 0,
    est_etape_finale: false,
    type_etape: 'en_cours' as const,
  });

  useEffect(() => {
    if (user) {
      loadEntreprises();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      setSelectedEntreprise(entreprises[0].id);
    }
  }, [entreprises, selectedEntreprise]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntreprise, activeTab]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data: isPlatformAdmin } = await supabase.rpc('is_platform_super_admin');
      
      if (isPlatformAdmin === true) {
        const { data, error } = await supabase
          .from('entreprises')
          .select('id, nom')
          .order('nom');
        
        if (error) throw error;
        setEntreprises(data || []);
      } else {
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('entreprise_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (espaceClient?.entreprise_id) {
          const { data: entreprise, error } = await supabase
            .from('entreprises')
            .select('id, nom')
            .eq('id', espaceClient.entreprise_id)
            .single();
          
          if (error) throw error;
          setEntreprises(entreprise ? [entreprise] : []);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement entreprises:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadData = async () => {
    if (!selectedEntreprise) return;

    try {
      setLoading(true);
      await Promise.all([
        loadEtapes(),
        loadOpportunites(),
        loadClients(),
        activeTab === 'activites' && loadActivites(),
        activeTab === 'campagnes' && loadCampagnes(),
        activeTab === 'stats' && loadStats(),
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement données:', error);
      alert('Erreur: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadEtapes = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('crm_pipeline_etapes')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .eq('actif', true)
        .order('ordre');

      if (error) throw error;
      setEtapes(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement étapes:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadOpportunites = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('crm_opportunites')
        .select(`
          *,
          client:clients(id, nom, prenom, entreprise_nom),
          etape:crm_pipeline_etapes(*)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunites(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement opportunités:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadActivites = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('crm_activites')
        .select(`
          *,
          client:clients(id, nom, prenom)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('date_activite', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivites(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement activités:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadCampagnes = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('crm_campagnes_email')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampagnes(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement campagnes:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadClients = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, prenom, entreprise_nom')
        .eq('entreprise_id', selectedEntreprise)
        .eq('statut', 'actif')
        .order('nom');

      if (error) throw error;
      setClients(data || []);
    } catch (error: unknown) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadStats = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase.rpc('get_crm_pipeline_stats', {
        p_entreprise_id: selectedEntreprise,
      });

      if (error) throw error;
      setStats(data);
    } catch (error: unknown) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleSaveOpportunite = async () => {
    if (!selectedEntreprise) return;

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        ...opportuniteFormData,
        montant_estime: parseFloat(opportuniteFormData.montant_estime.toString()),
        probabilite: parseInt(opportuniteFormData.probabilite.toString()),
        date_fermeture_prevue: opportuniteFormData.date_fermeture_prevue || null,
      };

      if (editingOpportunite) {
        const { error } = await supabase
          .from('crm_opportunites')
          .update(dataToSave)
          .eq('id', editingOpportunite.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_opportunites')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowOpportuniteForm(false);
      setEditingOpportunite(null);
      resetOpportuniteForm();
      await loadOpportunites();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde opportunité:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleSaveActivite = async () => {
    if (!selectedEntreprise) return;

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        ...activiteFormData,
        client_id: activiteFormData.client_id || null,
        opportunite_id: activiteFormData.opportunite_id || null,
        duree_minutes: activiteFormData.duree_minutes || null,
        date_activite: activiteFormData.date_activite,
      };

      if (editingActivite) {
        const { error } = await supabase
          .from('crm_activites')
          .update(dataToSave)
          .eq('id', editingActivite.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_activites')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowActiviteForm(false);
      setEditingActivite(null);
      resetActiviteForm();
      await loadActivites();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde activité:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleSaveCampagne = async () => {
    if (!selectedEntreprise) return;

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        ...campagneFormData,
        date_envoi_prevue: campagneFormData.date_envoi_prevue || null,
      };

      if (editingCampagne) {
        const { error } = await supabase
          .from('crm_campagnes_email')
          .update(dataToSave)
          .eq('id', editingCampagne.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_campagnes_email')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowCampagneForm(false);
      setEditingCampagne(null);
      resetCampagneForm();
      await loadCampagnes();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde campagne:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleSaveEtape = async () => {
    if (!selectedEntreprise) return;

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        ...etapeFormData,
        ordre: parseInt(etapeFormData.ordre.toString()),
        probabilite: parseInt(etapeFormData.probabilite.toString()),
      };

      if (editingEtape) {
        const { error } = await supabase
          .from('crm_pipeline_etapes')
          .update(dataToSave)
          .eq('id', editingEtape.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_pipeline_etapes')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowEtapeForm(false);
      setEditingEtape(null);
      resetEtapeForm();
      await loadEtapes();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde étape:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleDeleteOpportunite = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette opportunité ?')) return;

    try {
      const { error } = await supabase
        .from('crm_opportunites')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadOpportunites();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression opportunité:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleDeleteActivite = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette activité ?')) return;

    try {
      const { error } = await supabase
        .from('crm_activites')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadActivites();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression activité:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleDeleteCampagne = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;

    try {
      const { error } = await supabase
        .from('crm_campagnes_email')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCampagnes();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression campagne:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleUpdateOpportuniteEtape = async (opportuniteId: string, nouvelleEtapeId: string) => {
    try {
      const nouvelleEtape = etapes.find(e => e.id === nouvelleEtapeId);
      const probabilite = nouvelleEtape?.probabilite || 50;

      const { error } = await supabase
        .from('crm_opportunites')
        .update({ etape_id: nouvelleEtapeId, probabilite })
        .eq('id', opportuniteId);

      if (error) throw error;
      await loadOpportunites();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur mise à jour étape:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const resetOpportuniteForm = () => {
    setOpportuniteFormData({
      nom: '',
      description: '',
      client_id: '',
      montant_estime: 0,
      devise: 'EUR',
      etape_id: '',
      probabilite: 50,
      date_fermeture_prevue: '',
      source: '',
      notes: '',
      tags: [],
    });
  };

  const resetActiviteForm = () => {
    setActiviteFormData({
      type_activite: 'appel',
      sujet: '',
      description: '',
      client_id: '',
      opportunite_id: '',
      date_activite: new Date().toISOString().slice(0, 16),
      duree_minutes: 30,
      statut: 'planifiee',
      priorite: 'normale',
      resultat: '',
    });
  };

  const resetCampagneForm = () => {
    setCampagneFormData({
      nom: '',
      description: '',
      objet_email: '',
      contenu_email: '',
      type_contenu: 'html',
      date_envoi_prevue: '',
    });
  };

  const resetEtapeForm = () => {
    setEtapeFormData({
      nom: '',
      description: '',
      couleur: '#3B82F6',
      ordre: 0,
      probabilite: 0,
      est_etape_finale: false,
      type_etape: 'en_cours',
    });
  };

  const openEditOpportunite = (opp: Opportunite) => {
    setEditingOpportunite(opp);
    setOpportuniteFormData({
      nom: opp.nom,
      description: opp.description || '',
      client_id: opp.client_id || '',
      montant_estime: opp.montant_estime,
      devise: opp.devise,
      etape_id: opp.etape_id || '',
      probabilite: opp.probabilite,
      date_fermeture_prevue: opp.date_fermeture_prevue || '',
      source: opp.source || '',
      notes: opp.notes || '',
      tags: opp.tags || [],
    });
    setShowOpportuniteForm(true);
  };

  const openEditActivite = (act: Activite) => {
    setEditingActivite(act);
    setActiviteFormData({
      type_activite: act.type_activite,
      sujet: act.sujet,
      description: act.description || '',
      client_id: act.client_id || '',
      opportunite_id: act.opportunite_id || '',
      date_activite: act.date_activite,
      duree_minutes: act.duree_minutes || 30,
      statut: act.statut,
      priorite: act.priorite,
      resultat: act.resultat || '',
    });
    setShowActiviteForm(true);
  };

  const openEditCampagne = (camp: CampagneEmail) => {
    setEditingCampagne(camp);
    setCampagneFormData({
      nom: camp.nom,
      description: camp.description || '',
      objet_email: camp.objet_email,
      contenu_email: camp.contenu_email,
      type_contenu: camp.type_contenu,
      date_envoi_prevue: camp.date_envoi_prevue || '',
    });
    setShowCampagneForm(true);
  };

  const openEditEtape = (etape: PipelineEtape) => {
    setEditingEtape(etape);
    setEtapeFormData({
      nom: etape.nom,
      description: etape.description || '',
      couleur: etape.couleur,
      ordre: etape.ordre,
      probabilite: etape.probabilite,
      est_etape_finale: etape.est_etape_finale,
      type_etape: etape.type_etape,
    });
    setShowEtapeForm(true);
  };

  const filteredOpportunites = opportunites.filter(opp => {
    const matchesSearch = opp.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.client?.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatut = filterStatut === 'all' || opp.statut === filterStatut;
    return matchesSearch && matchesStatut;
  });

  const getOpportunitesByEtape = (etapeId: string) => {
    return filteredOpportunites.filter(opp => opp.etape_id === etapeId && opp.statut === 'ouverte');
  };

  // ==================== FONCTIONS IA ====================
  
  const callAIAssistant = async (action: string, data: any) => {
    if (!user) return;

    try {
      setAiLoading(true);
      setAiAction(action);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error('Non authentifié');

      console.log('🤖 Appel IA:', { action, data });
      
      const { data: result, error } = await supabase.functions.invoke('crm-ai-assistant', {
        body: { action, data },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      console.log('📥 Réponse IA:', { result, error });

      if (error) {
        console.error('❌ Erreur Supabase Functions:', error);
        console.error('   Message:', error.message);
        console.error('   Status:', (error as any)?.status);
        console.error('   Context:', (error as any)?.context);
        
        // Vérifier si c'est une erreur de fonction non trouvée
        const errorMessage = error.message || '';
        const errorStatus = (error as any)?.status;
        
        if (errorMessage.includes('not found') || errorMessage.includes('404') || errorStatus === 404) {
          throw new Error('Edge Function crm-ai-assistant non déployée. Veuillez déployer l\'Edge Function dans Supabase.');
        }
        
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          throw new Error('Impossible de contacter l\'Edge Function. Vérifiez votre connexion et que l\'Edge Function est déployée.');
        }
        
        throw error;
      }
      
      if (!result?.success) {
        console.error('❌ Erreur IA:', result);
        throw new Error(result?.error || 'Erreur IA');
      }

      console.log('✅ Résultat IA reçu:', result);
      setAiResult(result);
      setShowAiModal(true);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur appel IA:', error);
      
      // Afficher un message d'erreur détaillé sans rediriger
      const errorDetails = error instanceof Error ? error.message : String(error);
      
      if (errorDetails.includes('non déployée')) {
        alert(`⚠️ ${errorDetails}\n\nPour activer l'IA:\n1. Déployez l'Edge Function: supabase functions deploy crm-ai-assistant\n2. Configurez OPENAI_API_KEY dans Supabase Secrets`);
      } else if (errorDetails.includes('OPENAI_API_KEY')) {
        alert(`⚠️ Configuration IA manquante\n\nConfigurez OPENAI_API_KEY dans Supabase → Settings → Edge Functions → Secrets`);
      } else {
        alert(`❌ Erreur IA: ${errorDetails}\n\nVérifiez:\n- Edge Function déployée\n- OPENAI_API_KEY configuré\n- Crédits OpenAI disponibles`);
      }
      
      // Ne pas rediriger, juste afficher l'erreur
      setAiLoading(false);
      return null;
    }
  };

  const generateEmailWithAI = async (clientId?: string, type: string = 'suivi', context?: string) => {
    await callAIAssistant('generate_email', {
      client_id: clientId || opportuniteFormData.client_id,
      type,
      context,
      entreprise_id: selectedEntreprise,
    });
  };

  const analyzeOpportunityWithAI = async (opportuniteId: string) => {
    await callAIAssistant('analyze_opportunity', {
      opportunite_id: opportuniteId,
      entreprise_id: selectedEntreprise,
    });
  };

  const suggestActionsWithAI = async (opportuniteId?: string, clientId?: string) => {
    await callAIAssistant('suggest_actions', {
      opportunite_id: opportuniteId,
      client_id: clientId,
      entreprise_id: selectedEntreprise,
    });
  };

  const analyzeSentimentWithAI = async (texte: string) => {
    await callAIAssistant('analyze_sentiment', { texte });
  };

  const generateProposalWithAI = async (opportuniteId: string) => {
    await callAIAssistant('generate_proposal', {
      opportunite_id: opportuniteId,
      entreprise_id: selectedEntreprise,
    });
  };

  const applyAIEmailToCampagne = () => {
    if (aiResult?.objet && aiResult?.contenu) {
      setCampagneFormData({
        ...campagneFormData,
        objet_email: aiResult.objet,
        contenu_email: aiResult.contenu,
      });
      setShowAiModal(false);
      setAiResult(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">CRM Avancé</h1>
              <p className="text-gray-400">Pipeline commercial, opportunités et activités</p>
            </div>
          </div>
          {entreprises.length > 1 && (
            <select
              value={selectedEntreprise}
              onChange={(e) => setSelectedEntreprise(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            >
              {entreprises.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.nom}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 items-center">
          {[
            { id: 'pipeline', label: 'Pipeline', icon: BarChart3 },
            { id: 'opportunites', label: 'Opportunités', icon: Target },
            { id: 'activites', label: 'Activités', icon: Calendar },
            { id: 'campagnes', label: 'Campagnes Email', icon: Mail },
            { id: 'stats', label: 'Statistiques', icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 px-4 py-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-400 font-medium">IA Activée</span>
          </div>
        </div>
      </div>

      {/* Pipeline Kanban View */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 w-64"
                />
              </div>
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">Tous les statuts</option>
                <option value="ouverte">Ouvertes</option>
                <option value="gagnee">Gagnées</option>
                <option value="perdue">Perdues</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetEtapeForm();
                  setEditingEtape(null);
                  setShowEtapeForm(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle étape
              </button>
              <button
                onClick={() => {
                  resetOpportuniteForm();
                  setEditingOpportunite(null);
                  setShowOpportuniteForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle opportunité
              </button>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {etapes.map(etape => {
              const opps = getOpportunitesByEtape(etape.id);
              return (
                <div
                  key={etape.id}
                  className="flex-shrink-0 w-80 bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div
                    className="flex items-center justify-between mb-4 pb-2 border-b border-white/10"
                    style={{ borderBottomColor: etape.couleur }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: etape.couleur }}
                      />
                      <h3 className="font-semibold text-white">{etape.nom}</h3>
                      <span className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded">
                        {opps.length}
                      </span>
                    </div>
                    <button
                      onClick={() => openEditEtape(etape)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {opps.map(opp => (
                      <div
                        key={opp.id}
                        className="bg-white/10 rounded-lg p-3 hover:bg-white/15 transition-colors"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => openEditOpportunite(opp)}
                        >
                          <div className="font-semibold text-white mb-1">{opp.nom}</div>
                          {opp.client && (
                            <div className="text-sm text-gray-400 mb-2">
                              {opp.client.nom} {opp.client.prenom || ''} {opp.client.entreprise_nom || ''}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-green-400">
                              {opp.montant_estime.toLocaleString('fr-FR')} {opp.devise}
                            </span>
                            <span className="text-xs text-gray-400">{opp.probabilite}%</span>
                          </div>
                          {opp.date_fermeture_prevue && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(opp.date_fermeture_prevue).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 mt-2 pt-2 border-t border-white/10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              analyzeOpportunityWithAI(opp.id);
                            }}
                            className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs px-2 py-1 rounded flex items-center justify-center gap-1"
                            title="Analyser avec IA"
                          >
                            <Brain className="w-3 h-3" />
                            Analyser
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              suggestActionsWithAI(opp.id);
                            }}
                            className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs px-2 py-1 rounded flex items-center justify-center gap-1"
                            title="Suggestions IA"
                          >
                            <Lightbulb className="w-3 h-3" />
                            Actions
                          </button>
                        </div>
                      </div>
                    ))}
                    {opps.length === 0 && (
                      <div className="text-center text-gray-500 py-8 text-sm">
                        Aucune opportunité
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {etapes.length === 0 && (
              <div className="w-full text-center py-12 text-gray-400">
                <p className="mb-4">Aucune étape de pipeline configurée</p>
                <button
                  onClick={() => {
                    resetEtapeForm();
                    setShowEtapeForm(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  Créer la première étape
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Opportunités List View */}
      {activeTab === 'opportunites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 w-64"
                />
              </div>
            </div>
            <button
              onClick={() => {
                resetOpportuniteForm();
                setEditingOpportunite(null);
                setShowOpportuniteForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle opportunité
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunites.map(opp => (
              <div
                key={opp.id}
                className="bg-white/10 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white">{opp.nom}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditOpportunite(opp)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => analyzeOpportunityWithAI(opp.id)}
                      className="text-purple-400 hover:text-purple-300"
                      title="Analyser avec IA"
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => generateProposalWithAI(opp.id)}
                      className="text-green-400 hover:text-green-300"
                      title="Générer proposition avec IA"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOpportunite(opp.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {opp.client && (
                  <div className="text-sm text-gray-400 mb-2">
                    {opp.client.nom} {opp.client.prenom || ''}
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-green-400">
                    {opp.montant_estime.toLocaleString('fr-FR')} {opp.devise}
                  </span>
                  <span className="text-sm text-gray-400">{opp.probabilite}%</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded ${
                    opp.statut === 'gagnee' ? 'bg-green-500/20 text-green-400' :
                    opp.statut === 'perdue' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {opp.statut}
                  </span>
                  {opp.etape && (
                    <span className="px-2 py-1 rounded bg-white/10">
                      {opp.etape.nom}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activités */}
      {activeTab === 'activites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 w-64"
                />
              </div>
            </div>
            <button
              onClick={() => {
                resetActiviteForm();
                setEditingActivite(null);
                setShowActiviteForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle activité
            </button>
          </div>

          <div className="space-y-2">
            {activites
              .filter(act => act.sujet.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(act => {
                const Icon = act.type_activite === 'appel' ? Phone :
                  act.type_activite === 'email' ? Mail :
                  act.type_activite === 'reunion' ? Calendar :
                  FileText;
                return (
                  <div
                    key={act.id}
                    className="bg-white/10 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="w-5 h-5 text-purple-400 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">{act.sujet}</h3>
                            <span className={`text-xs px-2 py-1 rounded ${
                              act.priorite === 'urgente' ? 'bg-red-500/20 text-red-400' :
                              act.priorite === 'haute' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {act.priorite}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              act.statut === 'terminee' ? 'bg-green-500/20 text-green-400' :
                              act.statut === 'en_cours' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {act.statut}
                            </span>
                          </div>
                          {act.client && (
                            <div className="text-sm text-gray-400 mb-1">
                              {act.client.nom} {act.client.prenom || ''}
                            </div>
                          )}
                          <div className="text-sm text-gray-500">
                            {new Date(act.date_activite).toLocaleString('fr-FR')}
                            {act.duree_minutes && ` • ${act.duree_minutes} min`}
                          </div>
                          {act.description && (
                            <div className="text-sm text-gray-400 mt-2">{act.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditActivite(act)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivite(act.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Campagnes Email */}
      {activeTab === 'campagnes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Campagnes Email</h2>
              <p className="text-sm text-gray-400 mt-1">Générez des emails personnalisés avec l'IA ✨</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (clients.length > 0) {
                    generateEmailWithAI(clients[0].id, 'campagne', 'Campagne marketing générale');
                  } else {
                    alert('Ajoutez d\'abord un client pour générer un email avec IA');
                  }
                }}
                disabled={aiLoading || clients.length === 0}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                title="Générer un email avec IA"
              >
                {aiLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Générer Email IA
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  resetCampagneForm();
                  setEditingCampagne(null);
                  setShowCampagneForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle campagne
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campagnes.map(camp => (
              <div
                key={camp.id}
                className="bg-white/10 rounded-lg p-4 border border-white/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white">{camp.nom}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditCampagne(camp)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCampagne(camp.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400 mb-2">{camp.objet_email}</div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{camp.nombre_envoyes} envoyés</span>
                  <span>{camp.taux_ouverture}% ouverture</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistiques */}
      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Opportunités ouvertes</div>
            <div className="text-2xl font-bold text-white">{stats.total_opportunites || 0}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Gagnées</div>
            <div className="text-2xl font-bold text-green-400">{stats.opportunites_gagnees || 0}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Montant total</div>
            <div className="text-2xl font-bold text-white">
              {stats.montant_total_ouvert?.toLocaleString('fr-FR') || 0} €
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Taux de réussite</div>
            <div className="text-2xl font-bold text-purple-400">{stats.taux_reussite || 0}%</div>
          </div>
        </div>
      )}

      {/* Formulaires modaux */}
      {/* Formulaire Opportunité */}
      {showOpportuniteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingOpportunite ? 'Modifier' : 'Nouvelle'} opportunité
              </h2>
              <button
                onClick={() => {
                  setShowOpportuniteForm(false);
                  setEditingOpportunite(null);
                  resetOpportuniteForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                <input
                  type="text"
                  value={opportuniteFormData.nom}
                  onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, nom: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client</label>
                <select
                  value={opportuniteFormData.client_id}
                  onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, client_id: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.nom} {client.prenom || ''} {client.entreprise_nom || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Montant estimé</label>
                  <input
                    type="number"
                    step="0.01"
                    value={opportuniteFormData.montant_estime}
                    onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, montant_estime: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Probabilité (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={opportuniteFormData.probabilite}
                    onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, probabilite: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Étape</label>
                <select
                  value={opportuniteFormData.etape_id}
                  onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, etape_id: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Sélectionner une étape</option>
                  {etapes.map(etape => (
                    <option key={etape.id} value={etape.id}>{etape.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date de fermeture prévue</label>
                <input
                  type="date"
                  value={opportuniteFormData.date_fermeture_prevue}
                  onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, date_fermeture_prevue: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  {opportuniteFormData.description && (
                    <button
                      type="button"
                      onClick={() => analyzeSentimentWithAI(opportuniteFormData.description)}
                      disabled={aiLoading}
                      className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-300"></div>
                          Analyse...
                        </>
                      ) : (
                        <>
                          <Brain className="w-3 h-3" />
                          Analyser sentiment
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={opportuniteFormData.description}
                  onChange={(e) => setOpportuniteFormData({ ...opportuniteFormData, description: e.target.value })}
                  rows={4}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => suggestActionsWithAI(editingOpportunite?.id, opportuniteFormData.client_id)}
                  disabled={aiLoading || !opportuniteFormData.client_id}
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  title="Obtenir des suggestions d'actions IA"
                >
                  {aiLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
                      Analyse...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      Suggestions IA
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveOpportunite}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setShowOpportuniteForm(false);
                    setEditingOpportunite(null);
                    resetOpportuniteForm();
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Activité */}
      {showActiviteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingActivite ? 'Modifier' : 'Nouvelle'} activité
              </h2>
              <button
                onClick={() => {
                  setShowActiviteForm(false);
                  setEditingActivite(null);
                  resetActiviteForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                <select
                  value={activiteFormData.type_activite}
                  onChange={(e) => setActiviteFormData({ ...activiteFormData, type_activite: e.target.value as any })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                  <option value="appel">Appel</option>
                  <option value="email">Email</option>
                  <option value="reunion">Réunion</option>
                  <option value="tache">Tâche</option>
                  <option value="note">Note</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sujet *</label>
                <input
                  type="text"
                  value={activiteFormData.sujet}
                  onChange={(e) => setActiviteFormData({ ...activiteFormData, sujet: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client</label>
                <select
                  value={activiteFormData.client_id}
                  onChange={(e) => setActiviteFormData({ ...activiteFormData, client_id: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.nom} {client.prenom || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date et heure *</label>
                  <input
                    type="datetime-local"
                    value={activiteFormData.date_activite}
                    onChange={(e) => setActiviteFormData({ ...activiteFormData, date_activite: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Durée (minutes)</label>
                  <input
                    type="number"
                    value={activiteFormData.duree_minutes}
                    onChange={(e) => setActiviteFormData({ ...activiteFormData, duree_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Statut</label>
                  <select
                    value={activiteFormData.statut}
                    onChange={(e) => setActiviteFormData({ ...activiteFormData, statut: e.target.value as any })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="planifiee">Planifiée</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priorité</label>
                  <select
                    value={activiteFormData.priorite}
                    onChange={(e) => setActiviteFormData({ ...activiteFormData, priorite: e.target.value as any })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={activiteFormData.description}
                  onChange={(e) => setActiviteFormData({ ...activiteFormData, description: e.target.value })}
                  rows={4}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveActivite}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setShowActiviteForm(false);
                    setEditingActivite(null);
                    resetActiviteForm();
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Campagne */}
      {showCampagneForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingCampagne ? 'Modifier' : 'Nouvelle'} campagne email
              </h2>
              <button
                onClick={() => {
                  setShowCampagneForm(false);
                  setEditingCampagne(null);
                  resetCampagneForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                <input
                  type="text"
                  value={campagneFormData.nom}
                  onChange={(e) => setCampagneFormData({ ...campagneFormData, nom: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Objet email *</label>
                  <button
                    type="button"
                    onClick={() => generateEmailWithAI(opportuniteFormData.client_id, 'campagne', campagneFormData.description)}
                    disabled={aiLoading}
                    className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-300"></div>
                        Génération...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Générer avec IA
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={campagneFormData.objet_email}
                  onChange={(e) => setCampagneFormData({ ...campagneFormData, objet_email: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Contenu email *</label>
                  <button
                    type="button"
                    onClick={() => generateEmailWithAI(opportuniteFormData.client_id, 'campagne', campagneFormData.description)}
                    disabled={aiLoading}
                    className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-300"></div>
                        Génération...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Générer avec IA
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={campagneFormData.contenu_email}
                  onChange={(e) => setCampagneFormData({ ...campagneFormData, contenu_email: e.target.value })}
                  rows={10}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveCampagne}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setShowCampagneForm(false);
                    setEditingCampagne(null);
                    resetCampagneForm();
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Étape Pipeline */}
      {showEtapeForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingEtape ? 'Modifier' : 'Nouvelle'} étape
              </h2>
              <button
                onClick={() => {
                  setShowEtapeForm(false);
                  setEditingEtape(null);
                  resetEtapeForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                <input
                  type="text"
                  value={etapeFormData.nom}
                  onChange={(e) => setEtapeFormData({ ...etapeFormData, nom: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Couleur</label>
                  <input
                    type="color"
                    value={etapeFormData.couleur}
                    onChange={(e) => setEtapeFormData({ ...etapeFormData, couleur: e.target.value })}
                    className="w-full h-10 bg-white/10 border border-white/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ordre</label>
                  <input
                    type="number"
                    value={etapeFormData.ordre}
                    onChange={(e) => setEtapeFormData({ ...etapeFormData, ordre: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Probabilité (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={etapeFormData.probabilite}
                  onChange={(e) => setEtapeFormData({ ...etapeFormData, probabilite: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={etapeFormData.est_etape_finale}
                  onChange={(e) => setEtapeFormData({ ...etapeFormData, est_etape_finale: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-300">Étape finale (gagné/perdu)</label>
              </div>

              {etapeFormData.est_etape_finale && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type d'étape</label>
                  <select
                    value={etapeFormData.type_etape}
                    onChange={(e) => setEtapeFormData({ ...etapeFormData, type_etape: e.target.value as any })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="en_cours">En cours</option>
                    <option value="gagne">Gagné</option>
                    <option value="perdu">Perdu</option>
                  </select>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleSaveEtape}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setShowEtapeForm(false);
                    setEditingEtape(null);
                    resetEtapeForm();
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal IA */}
      {showAiModal && aiResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">
                  {aiAction === 'generate_email' && 'Email généré par IA'}
                  {aiAction === 'analyze_opportunity' && 'Analyse IA de l\'opportunité'}
                  {aiAction === 'suggest_actions' && 'Suggestions d\'actions IA'}
                  {aiAction === 'analyze_sentiment' && 'Analyse de sentiment'}
                  {aiAction === 'generate_proposal' && 'Proposition commerciale générée par IA'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAiModal(false);
                  setAiResult(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {aiAction === 'generate_email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Objet</label>
                    <div className="bg-white/5 rounded-lg p-3 text-white border border-white/10">
                      {aiResult.objet}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Contenu</label>
                    <div 
                      className="bg-white/5 rounded-lg p-3 text-white border border-white/10 prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: aiResult.contenu }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={applyAIEmailToCampagne}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                    >
                      Utiliser pour la campagne
                    </button>
                    <button
                      onClick={() => {
                        setShowAiModal(false);
                        setAiResult(null);
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}

              {aiAction === 'analyze_opportunity' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="text-sm text-gray-400 mb-1">Probabilité prédite</div>
                      <div className="text-2xl font-bold text-purple-400">{aiResult.probabilite_predite}%</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="text-sm text-gray-400 mb-1">Score de sentiment</div>
                      <div className="text-2xl font-bold text-blue-400">{aiResult.score || 'N/A'}</div>
                    </div>
                  </div>
                  {aiResult.risques && aiResult.risques.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">⚠️ Risques identifiés</label>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {aiResult.risques.map((risque: string, idx: number) => (
                          <li key={idx}>{risque}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.recommandations && aiResult.recommandations.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">💡 Recommandations</label>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {aiResult.recommandations.map((reco: string, idx: number) => (
                          <li key={idx}>{reco}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.prochaines_actions && aiResult.prochaines_actions.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">🎯 Prochaines actions</label>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {aiResult.prochaines_actions.map((action: string, idx: number) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.analyse && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">📊 Analyse détaillée</label>
                      <div className="bg-white/5 rounded-lg p-3 text-gray-300 border border-white/10">
                        {aiResult.analyse}
                      </div>
                    </div>
                  )}
                </>
              )}

              {aiAction === 'suggest_actions' && aiResult.actions && (
                <>
                  <div className="space-y-3">
                    {aiResult.actions.map((action: any, idx: number) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              action.priorite === 'urgente' ? 'bg-red-500/20 text-red-400' :
                              action.priorite === 'haute' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {action.priorite}
                            </span>
                            <span className="text-sm text-gray-400">{action.type}</span>
                          </div>
                          {action.delai_jours && (
                            <span className="text-xs text-gray-500">Dans {action.delai_jours} jours</span>
                          )}
                        </div>
                        <div className="font-semibold text-white mb-1">{action.titre}</div>
                        <div className="text-sm text-gray-300">{action.description}</div>
                        <button
                          onClick={() => {
                            setActiviteFormData({
                              ...activiteFormData,
                              type_activite: action.type,
                              sujet: action.titre,
                              description: action.description,
                              priorite: action.priorite,
                              date_activite: new Date(Date.now() + (action.delai_jours || 0) * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                            });
                            setShowAiModal(false);
                            setShowActiviteForm(true);
                          }}
                          className="mt-2 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-2 py-1 rounded"
                        >
                          Créer cette activité
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {aiAction === 'analyze_sentiment' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="text-sm text-gray-400 mb-1">Sentiment</div>
                      <div className={`text-2xl font-bold ${
                        aiResult.sentiment === 'positif' ? 'text-green-400' :
                        aiResult.sentiment === 'negatif' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {aiResult.sentiment}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="text-sm text-gray-400 mb-1">Score</div>
                      <div className="text-2xl font-bold text-blue-400">{aiResult.score?.toFixed(2) || 'N/A'}</div>
                    </div>
                  </div>
                  {aiResult.emotions && aiResult.emotions.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Émotions détectées</label>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.emotions.map((emotion: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm">
                            {emotion}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiResult.alertes && aiResult.alertes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-red-300 mb-2">⚠️ Alertes</label>
                      <ul className="list-disc list-inside space-y-1 text-red-300">
                        {aiResult.alertes.map((alerte: string, idx: number) => (
                          <li key={idx}>{alerte}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.analyse && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Analyse</label>
                      <div className="bg-white/5 rounded-lg p-3 text-gray-300 border border-white/10">
                        {aiResult.analyse}
                      </div>
                    </div>
                  )}
                </>
              )}

              {aiAction === 'generate_proposal' && (
                <>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">{aiResult.titre}</h3>
                    <div className="text-gray-300 mb-4">{aiResult.introduction}</div>
                    <div className="text-gray-300 mb-4">{aiResult.solution}</div>
                    {aiResult.avantages && aiResult.avantages.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-white mb-2">Avantages</h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {aiResult.avantages.map((avantage: string, idx: number) => (
                            <li key={idx}>{avantage}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiResult.tarification && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-white mb-2">Tarification</h4>
                        <div className="text-gray-300">{aiResult.tarification}</div>
                      </div>
                    )}
                    {aiResult.prochaines_etapes && aiResult.prochaines_etapes.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-white mb-2">Prochaines étapes</h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {aiResult.prochaines_etapes.map((etape: string, idx: number) => (
                            <li key={idx}>{etape}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-gray-300">{aiResult.conclusion}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAiModal(false);
                      setAiResult(null);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                  >
                    Fermer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

