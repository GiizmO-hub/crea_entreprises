import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Settings, Building2, Mail, Trash2, Play, Pause, Plus, Search, AlertCircle, Send, User, Building, FileText, Bell, Lock, CreditCard, Database, Users, ShieldOff, Crown, Eye, MapPin, Phone, EyeOff, Image, Palette, Type, Layout, Save, Sparkles, TrendingUp, DollarSign, Calendar, PieChart, BarChart3 } from 'lucide-react';
import CredentialsModal from '../components/CredentialsModal';
import { sendClientCredentialsEmail } from '../services/emailService';
import type { ClientCredentialsEmailData } from '../services/emailService';
import { EspaceMembreModal } from '../pages/clients/EspaceMembreModal';
import type { Client, EspaceMembreData, Plan, Option } from '../pages/clients/types';
import { EntrepriseAccordion } from '../components/EntrepriseAccordion';
import { ClientDetailsModal } from '../components/ClientDetailsModal';

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

type TabType = 'profil' | 'entreprise' | 'facturation' | 'documents' | 'notifications' | 'securite' | 'abonnement' | 'donnees' | 'clients' | 'finances';

export default function Parametres() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profil');
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientEntreprise, setClientEntreprise] = useState<any>(null);
  const [profileFormData, setProfileFormData] = useState({
    adresse: '',
    telephone: '',
    site_web: '',
    code_postal: '',
    ville: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
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
  const [selectedClientForEspace, setSelectedClientForEspace] = useState<Client | null>(null);
  const [espaceMembreData, setEspaceMembreData] = useState<EspaceMembreData>({
    password: '',
    plan_id: '',
    options_ids: [],
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [entrepriseConfigs, setEntrepriseConfigs] = useState<Array<{
    id: string;
    nom: string;
    statut_paiement?: string;
    statut?: string;
    clients: number;
    espaces: number;
    abonnements: number;
    superAdmins: number;
    created_at?: string;
  }>>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  // Cache des rôles confirmés par la fonction RPC pour préserver entre rechargements
  // Initialiser depuis localStorage pour persister même après navigation
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientDetailsModal, setShowClientDetailsModal] = useState(false);
  
  // États pour la configuration des documents
  const [documentParams, setDocumentParams] = useState<any>(null);
  const [loadingDocumentParams, setLoadingDocumentParams] = useState(false);
  const [savingDocumentParams, setSavingDocumentParams] = useState(false);
  const [generatingMentions, setGeneratingMentions] = useState(false);
  const [selectedEntrepriseForDocs, setSelectedEntrepriseForDocs] = useState<string | null>(null);
  
  // États pour les finances
  const [financialDetails, setFinancialDetails] = useState<any>(null);
  const [loadingFinancialDetails, setLoadingFinancialDetails] = useState(false);
  const [selectedFinancialPeriod, setSelectedFinancialPeriod] = useState<'mois' | 'trimestre' | 'annee' | 'toutes'>('toutes');

  // Formater une date en AAAA-MM-JJ en heure locale (sans décalage UTC)
  const formatDateLocal = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [confirmedRolesCache, setConfirmedRolesCache] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('confirmedRolesCache');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📦 Cache des rôles restauré depuis localStorage:', parsed);
        return parsed || {};
      }
    } catch (error) {
      console.error('❌ Erreur lecture cache depuis localStorage:', error);
    }
    return {};
  });
  
  // Sauvegarder le cache dans localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem('confirmedRolesCache', JSON.stringify(confirmedRolesCache));
      console.log('💾 Cache des rôles sauvegardé dans localStorage:', confirmedRolesCache);
    } catch (error) {
      console.error('❌ Erreur sauvegarde cache dans localStorage:', error);
    }
  }, [confirmedRolesCache]);
  

  useEffect(() => {
    if (user) {
      checkSuperAdmin();
      checkIfClient();
    }
  }, [user]);

  useEffect(() => {
    if (user && isSuperAdmin && activeTab === 'clients') {
      // Recharger les clients uniquement si l'onglet vient d'être activé
      // Ne pas forcer un rechargement à chaque rendu pour éviter d'écraser le state local
      loadAllClients();
      loadPlans();
      loadOptions();
    }
  }, [user, isSuperAdmin, activeTab]);
  
  // Ne PAS recharger automatiquement les clients quand on change d'onglet si on vient de faire un toggle
  // Cela évite d'écraser le state local avec des données potentiellement obsolètes

  useEffect(() => {
    // ✅ Variable pour suivre si le composant est monté
    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    
    const clearAllTimeouts = () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.length = 0;
    };
    
    if (user && activeTab === 'entreprise') {
      loadEntrepriseConfig();
    }
    if (user && activeTab === 'documents') {
      // Pour les clients, attendre que clientEntreprise soit chargé
      if (isClient) {
        if (clientEntreprise) {
          loadDocumentParams();
        } else {
          // Recharger checkIfClient pour obtenir clientEntreprise
          checkIfClient();
          // Charger les paramètres après un délai pour laisser le temps à checkIfClient
          const timeout = setTimeout(() => {
            if (isMounted) loadDocumentParams();
          }, 1000);
          timeouts.push(timeout);
        }
      } else {
        // Pour les utilisateurs plateforme, charger les entreprises d'abord si nécessaire
        if (entrepriseConfigs.length === 0) {
          loadEntrepriseConfig();
          // Charger les paramètres après un délai pour laisser le temps à loadEntrepriseConfig
          const timeout = setTimeout(() => {
            if (isMounted) loadDocumentParams();
          }, 1000);
          timeouts.push(timeout);
        } else {
          loadDocumentParams();
        }
      }
    }
    if (user && activeTab === 'finances') {
      loadFinancialDetails();
    }
    
    // Écouter les événements de mise à jour d'abonnement pour recharger la config
    const handleAbonnementUpdate = () => {
      if (activeTab === 'entreprise' && isMounted) {
        console.log('🔄 Rechargement config entreprise après mise à jour abonnement');
        const timeout = setTimeout(() => {
          if (isMounted) loadEntrepriseConfig();
        }, 500);
        timeouts.push(timeout);
      }
    };
    
    // Écouter les événements de création d'entreprise pour recharger automatiquement
    const handleEntrepriseCreated = () => {
      if (!isMounted) return;
      console.log('🔄 Événement entrepriseCreated reçu - Rechargement config entreprise et clients');
      // Recharger la config entreprise (toujours, même si pas sur l'onglet)
      const timeout1 = setTimeout(() => {
        if (isMounted) loadEntrepriseConfig();
      }, 1000);
      timeouts.push(timeout1);
      // Recharger les clients aussi si on est sur l'onglet clients
      if (activeTab === 'clients' && isSuperAdmin) {
        const timeout2 = setTimeout(() => {
          if (isMounted) loadAllClients();
        }, 1500);
        timeouts.push(timeout2);
      }
      // Recharger les paramètres documents si on est sur cet onglet
      if (activeTab === 'documents') {
        const timeout3 = setTimeout(() => {
          if (isMounted) loadDocumentParams();
        }, 1500);
        timeouts.push(timeout3);
      }
      // Recharger les détails financiers si on est sur cet onglet
      if (activeTab === 'finances') {
        const timeout4 = setTimeout(() => {
          if (isMounted) loadFinancialDetails();
        }, 500);
        timeouts.push(timeout4);
      }
    };
    
    window.addEventListener('abonnementUpdated', handleAbonnementUpdate);
    window.addEventListener('entrepriseCreated', handleEntrepriseCreated);
    
    return () => {
      isMounted = false;
      clearAllTimeouts();
      window.removeEventListener('abonnementUpdated', handleAbonnementUpdate);
      window.removeEventListener('entrepriseCreated', handleEntrepriseCreated);
    };
  }, [user, activeTab, isSuperAdmin, isClient, clientEntreprise, entrepriseConfigs.length]);

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
        setIsClient(false); // Super admin plateforme n'est pas un client
      }
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
    }
  };

  const checkIfClient = async () => {
    if (!user) {
      setIsClient(false);
      return;
    }
    
    try {
      // Vérifier si l'utilisateur a un espace membre client
      const { data: espaceClient, error } = await supabase
        .from('espaces_membres_clients')
        .select('entreprise_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error || !espaceClient) {
        setIsClient(false);
        return;
      }
      
      setIsClient(true);
      
      // Charger l'entreprise du client
      const { data: entreprise, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', espaceClient.entreprise_id)
        .maybeSingle();
      
      if (!entrepriseError && entreprise) {
        setClientEntreprise(entreprise);
        setSelectedEntrepriseForDocs(entreprise.id);
        // Initialiser les données du formulaire profil avec les données de l'entreprise
        setProfileFormData({
          adresse: entreprise.adresse || '',
          telephone: entreprise.telephone || '',
          site_web: entreprise.site_web || '',
          code_postal: entreprise.code_postal || '',
          ville: entreprise.ville || '',
        });
      }
    } catch (error) {
      console.error('Erreur vérification client:', error);
      setIsClient(false);
    }
  };

  // Charger les paramètres de documents
  const loadDocumentParams = async () => {
    if (!user) return;
    
    setLoadingDocumentParams(true);
    try {
      // Déterminer l'entreprise_id
      let entrepriseId: string | null = null;
      
      if (isClient && clientEntreprise) {
        entrepriseId = clientEntreprise.id;
      } else if (selectedEntrepriseForDocs) {
        entrepriseId = selectedEntrepriseForDocs;
      } else if (entrepriseConfigs.length > 0) {
        entrepriseId = entrepriseConfigs[0].id;
        setSelectedEntrepriseForDocs(entrepriseId);
      }
      
      if (!entrepriseId) {
        console.log('⚠️ Aucune entreprise trouvée pour charger les paramètres de documents');
        setDocumentParams(null);
        setLoadingDocumentParams(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('parametres_documents')
        .select('*')
        .eq('entreprise_id', entrepriseId)
        .maybeSingle();
      
      // Gérer les erreurs : 404 = table n'existe pas encore, PGRST116 = pas de ligne
      if (error) {
        // Si la table n'existe pas encore (migration non appliquée), créer juste la config par défaut
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
          console.warn('⚠️ Table parametres_documents n\'existe pas encore. Utilisation de la configuration par défaut.');
          // Créer une configuration par défaut sans sauvegarder
          const defaultParams = {
            entreprise_id: entrepriseId,
            logo_position: 'left',
            logo_size: 40,
            show_entreprise_nom: true,
            show_entreprise_adresse: true,
            show_entreprise_contact: true,
            show_entreprise_siret: true,
            primary_color: '#3b82f6',
            secondary_color: '#6b7280',
            text_color: '#1f2937',
            header_font: 'helvetica',
            header_font_size: 24,
            body_font: 'helvetica',
            body_font_size: 10,
            footer_text: '',
            capital_social: '',
            rcs: '',
            tva_intracommunautaire: '',
          };
          setDocumentParams(defaultParams);
          setLoadingDocumentParams(false);
          return;
        }
        // PGRST116 = pas de ligne retournée (normal si pas encore de config)
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }
      
      if (data) {
        setDocumentParams(data);
      } else {
        // Créer une configuration par défaut
        const defaultParams = {
          entreprise_id: entrepriseId,
          logo_position: 'left',
          logo_size: 40,
          show_entreprise_nom: true,
          show_entreprise_adresse: true,
          show_entreprise_contact: true,
          show_entreprise_siret: true,
          primary_color: '#3b82f6',
          secondary_color: '#6b7280',
          text_color: '#1f2937',
          header_font: 'helvetica',
          header_font_size: 24,
          body_font: 'helvetica',
          body_font_size: 10,
          footer_text: '',
          capital_social: '',
          rcs: '',
          tva_intracommunautaire: '',
        };
        setDocumentParams(defaultParams);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres documents:', error);
      alert('❌ Erreur lors du chargement des paramètres: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setLoadingDocumentParams(false);
    }
  };

  // Générer les mentions légales avec IA
  const generateLegalMentions = async () => {
    if (!user || !documentParams) return;

    const entrepriseId = isClient && clientEntreprise 
      ? clientEntreprise.id 
      : selectedEntrepriseForDocs || documentParams.entreprise_id;

    if (!entrepriseId) {
      alert('❌ Aucune entreprise sélectionnée');
      return;
    }

    setGeneratingMentions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-legal-mentions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ entreprise_id: entrepriseId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la génération');
      }

      const result = await response.json();
      
      if (result.success && result.mentions) {
        setDocumentParams({
          ...documentParams,
          footer_text: result.mentions.footer_text || '',
          capital_social: result.mentions.capital_social || '',
          rcs: result.mentions.rcs || '',
          tva_intracommunautaire: result.mentions.tva_intracommunautaire || '',
        });
        alert(`✅ Mentions légales générées avec succès !\n\nIA utilisée: ${result.ai_provider === 'gemini' ? 'Google Gemini' : result.ai_provider === 'openai' ? 'OpenAI' : 'Par défaut'}`);
      } else {
        throw new Error('Réponse invalide de l\'API');
      }
    } catch (error) {
      console.error('Erreur génération mentions légales:', error);
      alert('❌ Erreur lors de la génération: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setGeneratingMentions(false);
    }
  };

  // Sauvegarder les paramètres de documents
  const saveDocumentParams = async () => {
    if (!user || !documentParams) return;
    
    setSavingDocumentParams(true);
    try {
      const { data, error } = await supabase
        .from('parametres_documents')
        .upsert({
          ...documentParams,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'entreprise_id'
        })
        .select()
        .single();
      
      if (error) {
        // Si la table n'existe pas encore, informer l'utilisateur
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
          alert('⚠️ La table parametres_documents n\'existe pas encore.\n\nVeuillez appliquer la migration SQL dans Supabase:\n20250131000001_create_parametres_documents.sql\n\nLes paramètres seront sauvegardés après l\'application de la migration.');
          return;
        }
        throw error;
      }
      
      setDocumentParams(data);
      alert('✅ Paramètres enregistrés avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde paramètres documents:', error);
      alert('❌ Erreur lors de la sauvegarde: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setSavingDocumentParams(false);
    }
  };

  // Charger les détails financiers
  const loadFinancialDetails = async () => {
    if (!user) return;
    
    setLoadingFinancialDetails(true);
    try {
      let entrepriseIds: string[] = [];
      let userClientId: string | null = null;

      if (isClient) {
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('entreprise_id, client_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (espaceClient?.entreprise_id) {
          entrepriseIds = [espaceClient.entreprise_id];
          userClientId = espaceClient.client_id;
        }
      } else {
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id');
        entrepriseIds = entreprises?.map((e) => e.id) || [];
      }

      if (entrepriseIds.length === 0) {
        setLoadingFinancialDetails(false);
        return;
      }

      // Calculer la période en utilisant des dates locales (pour éviter le décalage UTC)
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      if (selectedFinancialPeriod === 'mois') {
        // 1er jour du mois courant
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        // Dernier jour du même mois
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (selectedFinancialPeriod === 'trimestre') {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      } else if (selectedFinancialPeriod === 'annee') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }
      // Si 'toutes', startDate et endDate restent null et on charge toutes les factures

      // Charger toutes les factures
      // ✅ Utiliser left join pour ne pas exclure les factures sans client
      let facturesQuery = supabase
        .from('factures')
        .select('*, clients(nom, prenom, entreprise_nom)')
        .in('entreprise_id', entrepriseIds);

      // ❌ Ne pas filtrer par date côté base pour éviter les incohérences
      // On appliquera le filtre de période côté client sur la même logique que l'affichage (date_facturation || date_emission || created_at)

      if (isClient && userClientId) {
        facturesQuery = facturesQuery.eq('client_id', userClientId);
      } else {
        facturesQuery = facturesQuery.or('source.is.null,source.neq.client');
      }

      const { data: factures, error } = await facturesQuery;
      if (error) {
        console.error('❌ [Parametres/Finances] Erreur chargement factures:', error);
        throw error;
      }

      let facturesList = factures || [];
      
      // ✅ Filtrer côté client pour les périodes spécifiques
      if (startDate && endDate && selectedFinancialPeriod !== 'toutes') {
        const startDateObj = new Date(startDate.getTime());
        const endDateObj = new Date(endDate.getTime());
        endDateObj.setHours(23, 59, 59, 999); // Fin de journée
        
        facturesList = facturesList.filter(f => {
          const rawDate = (f as any).date_facturation || (f as any).date_emission || f.created_at;
          if (!rawDate) return false;
          const factureDate = new Date(rawDate);
          return factureDate >= startDateObj && factureDate <= endDateObj;
        });
        
        console.log(`🔍 [Parametres/Finances] Filtrage côté client (période ${selectedFinancialPeriod}): ${facturesList.length} factures après filtrage (sur ${factures?.length || 0} chargées)`);
      }
      
      console.log(`📊 [Parametres/Finances] Factures chargées: ${facturesList.length} (période: ${selectedFinancialPeriod}, date début: ${formatDateLocal(startDate) || 'toutes'}, date fin: ${formatDateLocal(endDate) || 'toutes'})`);
      console.log(`📊 [Parametres/Finances] Détails factures:`, facturesList.map(f => ({
        id: f.id,
        numero: f.numero,
        statut: f.statut,
        date_facturation: (f as any).date_facturation || (f as any).date_emission || f.created_at,
        montant_ttc: f.montant_ttc,
        source: f.source
      })));

      // Calculer les statistiques détaillées
      const facturesPayees = facturesList.filter(f => f.statut === 'payee');
      const facturesEnAttente = facturesList.filter(f => f.statut === 'en_attente');
      const facturesEnRetard = facturesList.filter(f => {
        if (f.statut !== 'payee' && f.date_echeance) {
          return new Date(f.date_echeance) < now;
        }
        return false;
      });

      const caHT = facturesPayees.reduce((sum, f) => sum + Number(f.montant_ht || 0), 0);
      const caTTC = facturesPayees.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
      const tvaTotal = caTTC - caHT;
      const montantEnAttente = facturesEnAttente.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
      const montantEnRetard = facturesEnRetard.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);

      // Évolution mensuelle détaillée
      const evolutionMap = new Map<string, { ca: number; factures: number; ht: number; tva: number }>();
      facturesPayees.forEach(f => {
        const date = new Date(f.date_emission || f.created_at);
        const moisKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!evolutionMap.has(moisKey)) {
          evolutionMap.set(moisKey, { ca: 0, factures: 0, ht: 0, tva: 0 });
        }
        const current = evolutionMap.get(moisKey)!;
        current.ca += Number(f.montant_ttc || 0);
        current.ht += Number(f.montant_ht || 0);
        current.tva += Number(f.montant_ttc || 0) - Number(f.montant_ht || 0);
        current.factures += 1;
        evolutionMap.set(moisKey, current);
      });

      const evolutionMensuelle = Array.from(evolutionMap.entries())
        .map(([key, data]) => ({
          mois: new Date(key + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          ca: data.ca,
          ht: data.ht,
          tva: data.tva,
          factures: data.factures,
        }))
        .sort((a, b) => a.mois.localeCompare(b.mois));

      // Répartition par client détaillée
      const clientsMap = new Map<string, { nom: string; montant: number; factures: number; ht: number; tva: number }>();
      facturesPayees.forEach(f => {
        const clientId = f.client_id;
        const clientNom = (f.clients as any)?.entreprise_nom || 
                         `${(f.clients as any)?.prenom || ''} ${(f.clients as any)?.nom || ''}`.trim() || 
                         'Client inconnu';
        
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, { nom: clientNom, montant: 0, factures: 0, ht: 0, tva: 0 });
        }
        const current = clientsMap.get(clientId)!;
        current.montant += Number(f.montant_ttc || 0);
        current.ht += Number(f.montant_ht || 0);
        current.tva += Number(f.montant_ttc || 0) - Number(f.montant_ht || 0);
        current.factures += 1;
        clientsMap.set(clientId, current);
      });

      const repartitionClients = Array.from(clientsMap.entries())
        .map(([client_id, data]) => ({
          client_id,
          client_nom: data.nom,
          montant: data.montant,
          ht: data.ht,
          tva: data.tva,
          factures: data.factures,
        }))
        .sort((a, b) => b.montant - a.montant);

      // Répartition par statut
      const repartitionStatuts = {
        payees: facturesPayees.length,
        en_attente: facturesEnAttente.length,
        en_retard: facturesEnRetard.length,
        brouillons: facturesList.filter(f => f.statut === 'brouillon').length,
        envoyees: facturesList.filter(f => f.statut === 'envoyee').length,
        annulees: facturesList.filter(f => f.statut === 'annulee').length,
      };

      // Top 10 factures
      const topFactures = [...facturesPayees]
        .sort((a, b) => Number(b.montant_ttc || 0) - Number(a.montant_ttc || 0))
        .slice(0, 10)
        .map(f => ({
          id: f.id,
          numero: f.numero,
          client_nom: (f.clients as any)?.entreprise_nom || `${(f.clients as any)?.prenom || ''} ${(f.clients as any)?.nom || ''}`.trim() || 'Client inconnu',
          montant_ttc: Number(f.montant_ttc || 0),
          date_facturation: f.date_facturation || f.created_at,
        }));

      setFinancialDetails({
        caTotal: caTTC,
        caHT,
        caTTC,
        tvaTotal,
        facturesPayees: facturesPayees.length,
        facturesEnAttente: facturesEnAttente.length,
        facturesEnRetard: facturesEnRetard.length,
        montantEnAttente,
        montantEnRetard,
        facturesTotal: facturesList.length,
        evolutionMensuelle,
        repartitionClients,
        repartitionStatuts,
        topFactures,
      });
      
      console.log(`✅ [Parametres/Finances] Détails financiers mis à jour:`, {
        caTotal: caTTC,
        facturesTotal: facturesList.length,
        facturesPayees: facturesPayees.length,
        facturesEnAttente: facturesEnAttente.length,
        facturesEnRetard: facturesEnRetard.length
      });
    } catch (error) {
      console.error('❌ Erreur chargement détails financiers:', error);
      // Afficher les détails de l'erreur pour déboguer
      if (error instanceof Error) {
        console.error('❌ Message:', error.message);
        console.error('❌ Stack:', error.stack);
      }
    } finally {
      setLoadingFinancialDetails(false);
    }
  };

  const loadEntrepriseConfig = async () => {
    if (!user) {
      console.log('⚠️ loadEntrepriseConfig: Pas d\'utilisateur connecté');
      return;
    }
    
    setLoadingConfig(true);
    try {
      console.log('🔄 loadEntrepriseConfig: Chargement des entreprises pour user:', user.id);
      
      // ✅ Si super admin plateforme, charger TOUTES les entreprises
      // Sinon, charger uniquement les entreprises de l'utilisateur
      let query = supabase
        .from('entreprises')
        .select('id, nom, statut, statut_paiement, created_at, user_id');
      
      if (!isSuperAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      const { data: entreprisesData, error: entreprisesError } = await query
        .order('created_at', { ascending: false });

      if (entreprisesError) {
        console.error('❌ Erreur chargement entreprises:', entreprisesError);
        console.error('❌ Détails erreur:', JSON.stringify(entreprisesError, null, 2));
        setEntrepriseConfigs([]);
        setLoadingConfig(false);
        return;
      }

      console.log('📦 Entreprises récupérées:', entreprisesData?.length || 0);
      if (entreprisesData && entreprisesData.length > 0) {
        console.log('📦 Détails entreprises:', entreprisesData.map(e => ({
          id: e.id,
          nom: e.nom,
          user_id: e.user_id,
          statut: e.statut
        })));
      }

      if (!entreprisesData || entreprisesData.length === 0) {
        console.log('⚠️ Aucune entreprise trouvée pour l\'utilisateur:', user.id);
        setEntrepriseConfigs([]);
        setLoadingConfig(false);
        return;
      }

      // Charger les configurations pour chaque entreprise
      const configs = await Promise.all(
        entreprisesData.map(async (entreprise) => {
          const entrepriseId = entreprise.id;

      // Compter les clients
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId);

      // ✅ NOUVEAU: Récupérer les clients avec leurs rôles depuis clients_with_roles
      const { data: clientsData } = await supabase
        .from('clients_with_roles')
        .select('id, email, role_code')
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

      // Compter les abonnements actifs (statut='actif')
      const { data: abonnementsData, error: abonnementsError } = await supabase
        .from('abonnements')
        .select('id, statut')
        .eq('entreprise_id', entrepriseId)
        .eq('statut', 'actif');
      
      let abonnementsCount = 0;
      if (!abonnementsError && abonnementsData) {
        // Compter les abonnements avec statut='actif'
        abonnementsCount = abonnementsData.length;
      }
      
      console.log(`📊 Entreprise ${entrepriseId}: ${abonnementsCount} abonnement(s) actif(s)`, abonnementsData);

      // ✅ NOUVEAU: Compter les clients super admins depuis clients_with_roles (role_code)
      let superAdminsCount = 0;
      if (clientsData && clientsData.length > 0) {
        // Les rôles sont déjà dans clientsData depuis clients_with_roles
        superAdminsCount = clientsData.filter((c: { role_code?: string }) => c.role_code === 'client_super_admin').length;
        console.log(`✅ Super admins trouvés depuis clients_with_roles:`, superAdminsCount);
        
        // Vérifier aussi dans le cache local si disponible (pour mise à jour immédiate)
        const cachedSuperAdmins = Object.values(confirmedRolesCache).filter(role => role === 'client_super_admin').length;
        if (cachedSuperAdmins > superAdminsCount) {
          console.log(`🔧 Utilisation du cache pour super admins: ${cachedSuperAdmins} (DB: ${superAdminsCount})`);
          superAdminsCount = Math.max(superAdminsCount, cachedSuperAdmins);
        }
        
        console.log(`👑 Entreprise ${entrepriseId}: ${superAdminsCount} super admin(s) client(s) final`);
      }

          return {
            id: entreprise.id,
            nom: entreprise.nom,
            statut_paiement: entreprise.statut_paiement || 'non_requis',
            statut: entreprise.statut || 'active',
            clients: clientsCount || 0,
            espaces: espacesCount,
            abonnements: abonnementsCount || 0,
            superAdmins: superAdminsCount,
            created_at: entreprise.created_at,
          };
        })
      );

      console.log('✅ Configurations chargées:', configs.length);
      setEntrepriseConfigs(configs);
    } catch (error) {
      console.error('❌ Erreur chargement config entreprises:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
      setEntrepriseConfigs([]);
    } finally {
      setLoadingConfig(false);
      console.log('✅ loadEntrepriseConfig terminé');
    }
  };

  const loadAllClients = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // ✅ Si super admin plateforme, charger TOUTES les entreprises
      // Sinon, charger uniquement les entreprises de l'utilisateur
      let entrepriseIds: string[] = [];
      
      if (isSuperAdmin) {
        // Super admin plateforme voit TOUTES les entreprises
        const { data: allEntreprises, error: entreprisesError } = await supabase
          .from('entreprises')
          .select('id');
        
        if (entreprisesError) {
          console.error('❌ Erreur chargement toutes les entreprises:', entreprisesError);
          setClients([]);
          setLoading(false);
          return;
        }
        
        entrepriseIds = allEntreprises?.map(e => e.id) || [];
        console.log('👑 Super Admin: Chargement clients de TOUTES les entreprises:', entrepriseIds.length);
      } else {
        // Utilisateur normal : charger uniquement ses entreprises
        const { data: userEntreprises, error: entreprisesError } = await supabase
          .from('entreprises')
          .select('id')
          .eq('user_id', user.id);
        
        if (entreprisesError) {
          console.error('❌ Erreur chargement entreprises pour clients:', entreprisesError);
          setClients([]);
          setLoading(false);
          return;
        }
        
        if (!userEntreprises || userEntreprises.length === 0) {
          console.log('⚠️ Aucune entreprise trouvée pour charger les clients');
          setClients([]);
          setLoading(false);
          return;
        }
        
        entrepriseIds = userEntreprises.map(e => e.id);
        console.log('📦 Entreprises trouvées:', entrepriseIds.length);
      }
      
      // ✅ Charger les clients directement depuis la table clients avec filtre par entreprise_id
      // ✅ CORRECTION : Récupérer TOUS les champs créés lors de la création d'entreprise
      const { data: clientsRaw, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          entreprise_id,
          nom,
          prenom,
          email,
          telephone,
          adresse,
          code_postal,
          ville,
          siret,
          entreprise_nom,
          statut,
          created_at,
          role_id,
          entreprises!inner(nom)
        `)
        .in('entreprise_id', entrepriseIds);

      if (clientsError) {
        console.error('❌ Erreur chargement clients:', clientsError);
        console.error('❌ Détails:', JSON.stringify(clientsError, null, 2));
        setClients([]);
        setLoading(false);
        return;
      }

      if (!clientsRaw || clientsRaw.length === 0) {
        console.log('⚠️ Aucun client trouvé pour ces entreprises');
        setClients([]);
        setLoading(false);
        return;
      }

      console.log('📦 Clients bruts chargés:', clientsRaw.length);

      // ✅ CORRECTION : Utiliser clients_with_roles directement pour obtenir les rôles corrects
      // Cela prend en compte utilisateurs.role (client_super_admin) en priorité
      const clientIdsFromRaw = clientsRaw.map((c: { id: string }) => c.id);
      
      let clientsWithRolesMap: Record<string, { role_code: string; role_nom: string }> = {};
      if (clientIdsFromRaw.length > 0) {
        const { data: clientsWithRolesData } = await supabase
          .from('clients_with_roles')
          .select('id, role_code, role_nom')
          .in('id', clientIdsFromRaw);
        
        if (clientsWithRolesData) {
          clientsWithRolesData.forEach((cwr: { id: string; role_code: string; role_nom: string }) => {
            clientsWithRolesMap[cwr.id] = { 
              role_code: cwr.role_code || 'client', 
              role_nom: cwr.role_nom || 'Client' 
            };
          });
        }
      }

      // ✅ Transformer les données pour correspondre au format attendu
      // Le type réel retourné par Supabase inclut entreprises comme array ou object
      interface ClientRaw {
        id: string;
        nom: string | null;
        prenom: string | null;
        email: string | null;
        telephone: string | null;
        adresse: string | null;
        code_postal: string | null;
        ville: string | null;
        siret: string | null;
        entreprise_nom: string | null;
        statut: string | null;
        entreprise_id: string;
        role_id?: string | null;
        created_at: string;
        entreprises?: { nom: string } | Array<{ nom: string }> | null;
      }
      const data = clientsRaw.map((c: ClientRaw) => {
        const roleFromView = clientsWithRolesMap[c.id];
        // Extraire le nom de l'entreprise depuis la structure Supabase
        // ✅ PRIORITÉ : Utiliser entreprise_nom de la table clients (créé lors de la création)
        // Sinon, utiliser le nom depuis la relation entreprises
        let entrepriseNom = c.entreprise_nom || 'N/A';
        if (entrepriseNom === 'N/A' || !entrepriseNom) {
          if (Array.isArray(c.entreprises) && c.entreprises.length > 0) {
            entrepriseNom = c.entreprises[0]?.nom || 'N/A';
          } else if (c.entreprises && typeof c.entreprises === 'object' && 'nom' in c.entreprises) {
            entrepriseNom = (c.entreprises as { nom: string }).nom || 'N/A';
          }
        }
        
        return {
          id: c.id,
          entreprise_id: c.entreprise_id,
          nom: c.nom,
          prenom: c.prenom,
          email: c.email,
          telephone: c.telephone,
          adresse: c.adresse,
          code_postal: c.code_postal,
          ville: c.ville,
          siret: c.siret,
          entreprise_nom: entrepriseNom,
          statut: c.statut,
          created_at: c.created_at,
          role_code: roleFromView?.role_code || 'client',
          role_nom: roleFromView?.role_nom || 'Client',
          role_niveau: 0,
          entreprises: { nom: entrepriseNom }
        };
      });

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

      // ✅ Récupérer les codes de rôles par client_id depuis data (déjà chargé avec role_code)
      const roleCodesMap: Record<string, string> = {};
      
      // Les rôles sont déjà dans data depuis clients_with_roles (role_code)
      data.forEach((c: { id: string; role_code?: string }) => {
        if (c.role_code) {
          roleCodesMap[c.id] = c.role_code;
          console.log(`📌 Rôle récupéré depuis clients_with_roles pour client ${c.id}: "${c.role_code}"`);
        } else {
          // Par défaut, 'client' si pas de rôle défini
          roleCodesMap[c.id] = 'client';
        }
      });
      
      console.log(`✅ Rôles récupérés depuis clients_with_roles:`, Object.keys(roleCodesMap).length, 'clients');

      // Transformer les données pour correspondre à ClientInfo
      const transformedClients: ClientInfo[] = data.map((client: unknown) => {
        const c = client as {
          id: string;
          entreprise_id: string;
          nom?: string;
          prenom?: string;
          email: string;
          telephone?: string | null;
          adresse?: string | null;
          code_postal?: string | null;
          ville?: string | null;
          siret?: string | null;
          entreprise_nom?: string | null;
          statut?: string | null;
          created_at: string;
          entreprises?: { nom: string } | null | Array<{ nom: string }>;
          espaces_membres_clients?: Array<{ id: string; actif: boolean; user_id: string | null }> | null;
        };
        
        // Récupérer l'espace depuis la map (plus fiable que le JOIN)
        const espace = espacesMap[c.id] || null;
        
        // ✅ CORRECTION : Utiliser entreprise_nom depuis les données récupérées (créé lors de la création)
        // Sinon, utiliser le nom depuis la relation entreprises
        let entrepriseNom = c.entreprise_nom || 'N/A';
        if (entrepriseNom === 'N/A' || !entrepriseNom) {
          if (Array.isArray(c.entreprises) && c.entreprises.length > 0) {
            entrepriseNom = c.entreprises[0]?.nom || 'N/A';
          } else if (c.entreprises && typeof c.entreprises === 'object' && 'nom' in c.entreprises) {
            entrepriseNom = (c.entreprises as { nom: string }).nom || 'N/A';
          }
        }
        
        // Récupérer le rôle avec priorité: cache confirmé (localStorage) > cache state > roleCodesMap > 'client'
        // Le cache a la priorité ABSOLUE car il contient le rôle confirmé par la fonction RPC
        // Vérifier d'abord le cache state, puis localStorage si nécessaire
        let cachedRole = confirmedRolesCache[c.id];
        if (!cachedRole && c.id) {
          try {
            const saved = localStorage.getItem('confirmedRolesCache');
            if (saved) {
              const parsed = JSON.parse(saved);
              cachedRole = parsed[c.id];
              if (cachedRole) {
                console.log(`📦 Rôle récupéré depuis localStorage pour client ${c.id}: "${cachedRole}"`);
                // Mettre à jour le state pour cohérence
                setConfirmedRolesCache(prev => ({ ...prev, [c.id]: cachedRole! }));
              }
            }
          } catch (error) {
            console.error('❌ Erreur lecture cache depuis localStorage:', error);
          }
        }
        
        const dbRole = roleCodesMap[c.id];
        
        // ✅ CORRECTION : Toujours prioriser le rôle en DB s'il est client_super_admin
        // Car le cache localStorage peut contenir une ancienne valeur obsolète
        let clientRole: string;
        
        if (dbRole === 'client_super_admin') {
          // Si le rôle en DB est client_super_admin, l'utiliser en priorité absolue
          clientRole = 'client_super_admin';
          // Mettre à jour le cache pour cohérence
          if (cachedRole !== 'client_super_admin') {
            console.log(`🔄 Client ${c.id} (${c.email}): Rôle en DB est client_super_admin, mise à jour du cache (${cachedRole || 'N/A'} → client_super_admin)`);
            setConfirmedRolesCache(prev => {
              const updated = { ...prev, [c.id]: 'client_super_admin' };
              localStorage.setItem('confirmedRolesCache', JSON.stringify(updated));
              return updated;
            });
          }
        } else {
          // Pour les autres rôles, utiliser le cache s'il existe, sinon la DB
          clientRole = cachedRole || dbRole || 'client';
        }
        
        // Log pour diagnostiquer quelle source est utilisée
        if (cachedRole && cachedRole !== dbRole && dbRole !== 'client_super_admin') {
          console.log(`🔧 Client ${c.id} (${c.email}): Utilisation du rôle depuis le cache: "${cachedRole}" (DB: "${dbRole || 'non trouvé'}")`);
        } else if (!roleCodesMap[c.id] && !cachedRole && c.email) {
          console.warn(`⚠️ Rôle non trouvé pour client ${c.id} (${c.email}), utilisation de 'client' par défaut`);
        } else if (dbRole && !cachedRole) {
          console.log(`📌 Client ${c.id} (${c.email}): Rôle depuis DB: "${dbRole}"`);
        } else if (dbRole === 'client_super_admin') {
          console.log(`✅ Client ${c.id} (${c.email}): Rôle client_super_admin confirmé depuis DB`);
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
      console.log('🔍 Rôles détectés:', roleCodesMap);
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
      nom: client.client_nom || '',
      prenom: client.client_prenom || '',
      email: client.email || '',
      statut: 'actif', // Valeur par défaut car ClientInfo n'a pas de statut
      created_at: client.created_at || new Date().toISOString(),
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

      console.log('🔍 Réponse toggle super admin:', data);
      
      if (data?.success) {
        const confirmedRole = data.role || (newStatus ? 'client_super_admin' : 'client');
        console.log(`✅ Rôle confirmé par la fonction RPC: "${confirmedRole}"`);
        
        alert(
          newStatus
            ? '✅ Client défini comme super admin de son espace.\n💡 Le client doit se déconnecter et se reconnecter pour voir le badge Super Admin.'
            : '✅ Statut super admin retiré du client.'
        );
        
        // Stocker le rôle confirmé dans le cache pour préserver après rechargement et changement d'onglet
        setConfirmedRolesCache(prev => {
          const updated = {
            ...prev,
            [client.id]: confirmedRole
          };
          console.log(`💾 Cache des rôles mis à jour pour client ${client.id}: "${confirmedRole}"`);
          console.log(`💾 Cache complet:`, updated);
          return updated;
        });
        
        // Mettre à jour immédiatement le rôle dans le state local avec le rôle confirmé par la fonction RPC
        setClients(prevClients => prevClients.map(c => {
          if (c.id === client.id) {
            const updatedClient = { ...c, role: confirmedRole };
            console.log(`🔄 Mise à jour state local pour client ${c.email}: "${c.role}" → "${confirmedRole}"`);
            return updatedClient;
          }
          return c;
        }));
        
        // Recharger après un délai pour synchroniser avec la base de données
        // Mais préserver le rôle confirmé par la fonction RPC si le rechargement échoue
        setTimeout(async () => {
          console.log('🔄 Rechargement clients après toggle Super Admin (3s)');
          const savedRole = confirmedRole;
          
          // Recharger les clients
          await loadAllClients();
          
          // Vérifier si le rôle a été perdu après rechargement
          setClients(prevClients => {
            const updatedClient = prevClients.find(c => c.id === client.id);
            if (updatedClient && updatedClient.role !== savedRole) {
              console.warn(`⚠️ Rôle perdu après rechargement: "${savedRole}" → "${updatedClient.role}"`);
              console.warn(`🔧 Forcer le rôle confirmé par la fonction RPC: "${savedRole}"`);
              // Forcer le rôle confirmé par la fonction RPC
              return prevClients.map(c => 
                c.id === client.id ? { ...c, role: savedRole } : c
              );
            }
            return prevClients;
          });
          
          // TOUJOURS recharger la config entreprise pour mettre à jour le compteur, même si on n'est pas sur l'onglet
          console.log('🔄 Rechargement config entreprise pour mettre à jour le compteur Super Admin');
          await loadEntrepriseConfig();
        }, 3000);
        
        // Recharger aussi après un délai plus long pour s'assurer que la base est synchronisée
        setTimeout(async () => {
          console.log('🔄 Rechargement config entreprise après toggle Super Admin (5s - second rechargement)');
          await loadEntrepriseConfig();
        }, 5000);
      } else {
        console.error('❌ Échec toggle super admin:', data);
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
    // Onglet "Entreprise" visible uniquement pour super admin plateforme (pour vérifier le workflow de création)
    ...(isSuperAdmin ? [{ id: 'entreprise' as TabType, label: 'Entreprises Plateforme', icon: Building }] : []),
    { id: 'facturation' as TabType, label: 'Facturation', icon: FileText },
    { id: 'documents' as TabType, label: 'En-têtes Documents', icon: FileText },
    { id: 'finances' as TabType, label: 'Finances', icon: DollarSign },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell },
    { id: 'securite' as TabType, label: 'Sécurité', icon: Lock },
    { id: 'abonnement' as TabType, label: 'Abonnement', icon: CreditCard },
    { id: 'donnees' as TabType, label: 'Données', icon: Database },
    ...(isSuperAdmin ? [{ id: 'clients' as TabType, label: 'Gestion Clients', icon: Users }] : []),
  ];

  const renderTabContent = () => {
    console.log('🔄 [Parametres] Rendu contenu onglet:', activeTab);
    switch (activeTab) {
        case 'profil':
          // Vue Profil pour les clients avec informations entreprise
          if (isClient && clientEntreprise) {
            return (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-4">Profil Utilisateur</h2>
                
                {/* Informations de l'entreprise */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Informations de l'entreprise
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informations non modifiables */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase">Informations non modifiables</h4>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        Nom de l'entreprise
                      </label>
                      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                        {clientEntreprise.nom}
                      </div>
                    </div>
                    
                    {clientEntreprise.siret && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                          <Lock className="w-3 h-3" />
                          SIRET
                        </label>
                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                          {clientEntreprise.siret}
                        </div>
                      </div>
                    )}
                    
                    {clientEntreprise.email && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                          <Lock className="w-3 h-3" />
                          Email (connexion)
                        </label>
                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {clientEntreprise.email}
                        </div>
                      </div>
                    )}
                    
                    {clientEntreprise.forme_juridique && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Forme juridique</label>
                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                          {clientEntreprise.forme_juridique}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Informations modifiables */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase">Informations modifiables</h4>
                    
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Adresse</label>
                      <input
                        type="text"
                        value={profileFormData.adresse}
                        onChange={(e) => setProfileFormData({ ...profileFormData, adresse: e.target.value })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123 Rue Example"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Code postal</label>
                        <input
                          type="text"
                          value={profileFormData.code_postal}
                          onChange={(e) => setProfileFormData({ ...profileFormData, code_postal: e.target.value })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="75001"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Ville</label>
                        <input
                          type="text"
                          value={profileFormData.ville}
                          onChange={(e) => setProfileFormData({ ...profileFormData, ville: e.target.value })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Paris"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={profileFormData.telephone}
                        onChange={(e) => setProfileFormData({ ...profileFormData, telephone: e.target.value })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Site web</label>
                      <input
                        type="url"
                        value={profileFormData.site_web}
                        onChange={(e) => setProfileFormData({ ...profileFormData, site_web: e.target.value })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://www.example.com"
                      />
                    </div>
                    
                    <button
                      onClick={async () => {
                        setSavingProfile(true);
                        try {
                          const { error } = await supabase
                            .from('entreprises')
                            .update({
                              adresse: profileFormData.adresse || null,
                              telephone: profileFormData.telephone || null,
                              site_web: profileFormData.site_web || null,
                              code_postal: profileFormData.code_postal || null,
                              ville: profileFormData.ville || null,
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', clientEntreprise.id);
                          
                          if (error) throw error;
                          
                          alert('✅ Informations mises à jour avec succès');
                          // Recharger l'entreprise
                          await checkIfClient();
                        } catch (error) {
                          console.error('Erreur mise à jour entreprise:', error);
                          alert('❌ Erreur lors de la mise à jour: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
                        } finally {
                          setSavingProfile(false);
                        }
                      }}
                      disabled={savingProfile}
                      className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                    >
                      {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Modification du mot de passe */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Changer le mot de passe
                </h3>
                
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Mot de passe actuel"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nouveau mot de passe"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirmer le nouveau mot de passe"
                    />
                  </div>
                  
                  <button
                    onClick={async () => {
                      if (passwordData.newPassword !== passwordData.confirmPassword) {
                        alert('❌ Les mots de passe ne correspondent pas');
                        return;
                      }
                      
                      if (passwordData.newPassword.length < 6) {
                        alert('❌ Le mot de passe doit contenir au moins 6 caractères');
                        return;
                      }
                      
                      setSavingPassword(true);
                      try {
                        const { error } = await supabase.auth.updateUser({
                          password: passwordData.newPassword
                        });
                        
                        if (error) throw error;
                        
                        alert('✅ Mot de passe modifié avec succès');
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                      } catch (error) {
                        console.error('Erreur changement mot de passe:', error);
                        alert('❌ Erreur lors du changement de mot de passe: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
                      } finally {
                        setSavingPassword(false);
                      }
                    }}
                    disabled={savingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                  >
                    {savingPassword ? 'Modification...' : 'Modifier le mot de passe'}
                  </button>
                </div>
              </div>
            </div>
          );
        }
        
        // Vue Profil par défaut (pour non-clients)
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Profil Utilisateur</h2>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <p className="text-gray-400">Gestion de votre profil utilisateur</p>
              <p className="text-gray-500 text-sm mt-2">Email: {user?.email}</p>
            </div>
          </div>
        );

      case 'entreprise':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Paramètres Entreprise</h2>
              {entrepriseConfigs.length > 0 && (
                <span className="text-sm text-gray-400">
                  {entrepriseConfigs.length} entreprise{entrepriseConfigs.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            <EntrepriseAccordion 
              entreprises={entrepriseConfigs} 
              loading={loadingConfig}
              isPlatformUser={isSuperAdmin}
            />
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

      case 'documents':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Configuration des En-têtes de Documents
              </h2>
              {documentParams && (
                <button
                  onClick={saveDocumentParams}
                  disabled={savingDocumentParams || loadingDocumentParams}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingDocumentParams ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              )}
            </div>

            {loadingDocumentParams ? (
              <div className="text-center text-gray-400 py-8">Chargement des paramètres...</div>
            ) : !documentParams ? (
              <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                <p className="text-gray-400">Aucune entreprise trouvée. Veuillez créer une entreprise d'abord.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sélection entreprise (pour plateforme) */}
                {!isClient && entrepriseConfigs.length > 1 && (
                  <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Entreprise
                    </label>
                    <select
                      value={selectedEntrepriseForDocs || ''}
                      onChange={(e) => {
                        setSelectedEntrepriseForDocs(e.target.value);
                        // ✅ Utiliser requestAnimationFrame au lieu de setTimeout pour éviter les problèmes de nettoyage
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            loadDocumentParams();
                          });
                        });
                      }}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {entrepriseConfigs.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Logo */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Image className="w-5 h-5" />
                    Logo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">URL du logo</label>
                      <input
                        type="url"
                        value={documentParams.logo_url || ''}
                        onChange={(e) => setDocumentParams({ ...documentParams, logo_url: e.target.value })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Position du logo</label>
                      <select
                        value={documentParams.logo_position || 'left'}
                        onChange={(e) => setDocumentParams({ ...documentParams, logo_position: e.target.value as 'left' | 'right' | 'center' | 'none' })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="left">Gauche</option>
                        <option value="right">Droite</option>
                        <option value="center">Centre</option>
                        <option value="none">Aucun</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Taille du logo (px)</label>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={documentParams.logo_size || 40}
                        onChange={(e) => setDocumentParams({ ...documentParams, logo_size: parseInt(e.target.value) || 40 })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Informations à afficher */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Layout className="w-5 h-5" />
                    Informations à afficher
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={documentParams.show_entreprise_nom !== false}
                        onChange={(e) => setDocumentParams({ ...documentParams, show_entreprise_nom: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Nom entreprise</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={documentParams.show_entreprise_adresse !== false}
                        onChange={(e) => setDocumentParams({ ...documentParams, show_entreprise_adresse: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Adresse</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={documentParams.show_entreprise_contact !== false}
                        onChange={(e) => setDocumentParams({ ...documentParams, show_entreprise_contact: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Contact</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={documentParams.show_entreprise_siret !== false}
                        onChange={(e) => setDocumentParams({ ...documentParams, show_entreprise_siret: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">SIRET</span>
                    </label>
                  </div>
                </div>

                {/* Couleurs */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Couleurs
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Couleur principale</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={documentParams.primary_color || '#3b82f6'}
                          onChange={(e) => setDocumentParams({ ...documentParams, primary_color: e.target.value })}
                          className="w-16 h-10 rounded border border-white/10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={documentParams.primary_color || '#3b82f6'}
                          onChange={(e) => setDocumentParams({ ...documentParams, primary_color: e.target.value })}
                          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="#3B82F6"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Couleur secondaire</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={documentParams.secondary_color || '#6b7280'}
                          onChange={(e) => setDocumentParams({ ...documentParams, secondary_color: e.target.value })}
                          className="w-16 h-10 rounded border border-white/10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={documentParams.secondary_color || '#6b7280'}
                          onChange={(e) => setDocumentParams({ ...documentParams, secondary_color: e.target.value })}
                          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="#1F2937"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Couleur texte</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={documentParams.text_color || '#1f2937'}
                          onChange={(e) => setDocumentParams({ ...documentParams, text_color: e.target.value })}
                          className="w-16 h-10 rounded border border-white/10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={documentParams.text_color || '#1f2937'}
                          onChange={(e) => setDocumentParams({ ...documentParams, text_color: e.target.value })}
                          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Typographie */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    Typographie
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Police titre</label>
                      <select
                        value={documentParams.header_font || 'helvetica'}
                        onChange={(e) => setDocumentParams({ ...documentParams, header_font: e.target.value as 'helvetica' | 'times' | 'courier' })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="helvetica">Helvetica</option>
                        <option value="times">Times</option>
                        <option value="courier">Courier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Taille titre (px)</label>
                      <input
                        type="number"
                        min="12"
                        max="48"
                        value={documentParams.header_font_size || 24}
                        onChange={(e) => setDocumentParams({ ...documentParams, header_font_size: parseInt(e.target.value) || 24 })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Police texte</label>
                      <select
                        value={documentParams.body_font || 'helvetica'}
                        onChange={(e) => setDocumentParams({ ...documentParams, body_font: e.target.value as 'helvetica' | 'times' | 'courier' })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="helvetica">Helvetica</option>
                        <option value="times">Times</option>
                        <option value="courier">Courier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Taille texte (px)</label>
                      <input
                        type="number"
                        min="8"
                        max="20"
                        value={documentParams.body_font_size || 10}
                        onChange={(e) => setDocumentParams({ ...documentParams, body_font_size: parseInt(e.target.value) || 10 })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Mentions légales */}
                <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Mentions légales</h3>
                    <button
                      onClick={generateLegalMentions}
                      disabled={generatingMentions || !documentParams}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingMentions ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Génération...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Générer avec IA</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Mentions légales (texte libre)</label>
                      <textarea
                        value={documentParams.footer_text || ''}
                        onChange={(e) => setDocumentParams({ ...documentParams, footer_text: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Capital social, RCS, TVA intracommunautaire..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Capital social</label>
                        <input
                          type="text"
                          value={documentParams.capital_social || ''}
                          onChange={(e) => setDocumentParams({ ...documentParams, capital_social: e.target.value })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: 10 000 €"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">RCS</label>
                        <input
                          type="text"
                          value={documentParams.rcs || ''}
                          onChange={(e) => setDocumentParams({ ...documentParams, rcs: e.target.value })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: RCS Paris B 123 456 789"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">TVA Intracommunautaire</label>
                        <input
                          type="text"
                          value={documentParams.tva_intracommunautaire || ''}
                          onChange={(e) => setDocumentParams({ ...documentParams, tva_intracommunautaire: e.target.value })}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: FR12 345678901"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bouton sauvegarder en bas */}
                <div className="flex justify-end">
                  <button
                    onClick={saveDocumentParams}
                    disabled={savingDocumentParams || loadingDocumentParams}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {savingDocumentParams ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'finances':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Détails Financiers Complets
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedFinancialPeriod('toutes');
                    loadFinancialDetails();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFinancialPeriod === 'toutes'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => {
                    setSelectedFinancialPeriod('mois');
                    loadFinancialDetails();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFinancialPeriod === 'mois'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  Mois
                </button>
                <button
                  onClick={() => {
                    setSelectedFinancialPeriod('trimestre');
                    loadFinancialDetails();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFinancialPeriod === 'trimestre'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  Trimestre
                </button>
                <button
                  onClick={() => {
                    setSelectedFinancialPeriod('annee');
                    loadFinancialDetails();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFinancialPeriod === 'annee'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  Année
                </button>
              </div>
            </div>

            {loadingFinancialDetails ? (
              <div className="text-center text-gray-400 py-8">Chargement des données financières...</div>
            ) : !financialDetails ? (
              <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
                <p className="text-gray-400">Aucune donnée financière disponible</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Vue d'ensemble */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-green-500/20 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-400" />
                      </div>
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {financialDetails.caTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                    <div className="text-sm text-gray-300">Chiffre d'affaires TTC</div>
                    <div className="text-xs text-gray-400 mt-1">
                      HT: {financialDetails.caHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-500/20 rounded-lg">
                        <FileText className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{financialDetails.facturesPayees}</div>
                    <div className="text-sm text-gray-300">Factures payées</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Sur {financialDetails.facturesTotal} factures
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-yellow-500/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-yellow-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{financialDetails.facturesEnAttente}</div>
                    <div className="text-sm text-gray-300">En attente</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {financialDetails.montantEnAttente.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-lg rounded-xl p-6 border border-red-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-red-500/20 rounded-lg">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{financialDetails.facturesEnRetard}</div>
                    <div className="text-sm text-gray-300">En retard</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {financialDetails.montantEnRetard.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                  </div>
                </div>

                {/* Évolution mensuelle détaillée */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Évolution Mensuelle Détaillée
                  </h3>
                  {financialDetails.evolutionMensuelle && financialDetails.evolutionMensuelle.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Mois</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">HT</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">TVA</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">TTC</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Factures</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialDetails.evolutionMensuelle.map((item, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4 text-white font-medium">{item.mois}</td>
                              <td className="py-3 px-4 text-right text-gray-300">
                                {item.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-gray-300">
                                {item.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-white font-semibold">
                                {item.ca.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-gray-400">{item.factures}</td>
                            </tr>
                          ))}
                          <tr className="bg-white/5 font-bold">
                            <td className="py-3 px-4 text-white">Total</td>
                            <td className="py-3 px-4 text-right text-white">
                              {financialDetails.caHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                            </td>
                            <td className="py-3 px-4 text-right text-white">
                              {financialDetails.tvaTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                            </td>
                            <td className="py-3 px-4 text-right text-white">
                              {financialDetails.caTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                            </td>
                            <td className="py-3 px-4 text-right text-white">{financialDetails.facturesPayees}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune donnée disponible</p>
                    </div>
                  )}
                </div>

                {/* Répartition par client détaillée */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Répartition par Client (Détaillée)
                  </h3>
                  {financialDetails.repartitionClients && financialDetails.repartitionClients.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Client</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">HT</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">TVA</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">TTC</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Factures</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">% du CA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialDetails.repartitionClients.map((client, index) => (
                            <tr key={client.client_id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {index + 1}
                                  </div>
                                  <span className="text-white font-medium">{client.client_nom}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-gray-300">
                                {client.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-gray-300">
                                {client.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-white font-semibold">
                                {client.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-right text-gray-400">{client.factures}</td>
                              <td className="py-3 px-4 text-right text-gray-400">
                                {financialDetails.caTTC > 0 
                                  ? ((client.montant / financialDetails.caTTC) * 100).toFixed(1)
                                  : '0.0'}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Aucun client trouvé</p>
                    </div>
                  )}
                </div>

                {/* Répartition par statut */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Répartition par Statut
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
                      <div className="text-sm text-gray-300 mb-1">Payées</div>
                      <div className="text-2xl font-bold text-green-400">{financialDetails.repartitionStatuts?.payees || 0}</div>
                    </div>
                    <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                      <div className="text-sm text-gray-300 mb-1">En attente</div>
                      <div className="text-2xl font-bold text-yellow-400">{financialDetails.repartitionStatuts?.en_attente || 0}</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                      <div className="text-sm text-gray-300 mb-1">En retard</div>
                      <div className="text-2xl font-bold text-red-400">{financialDetails.repartitionStatuts?.en_retard || 0}</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
                      <div className="text-sm text-gray-300 mb-1">Envoyées</div>
                      <div className="text-2xl font-bold text-blue-400">{financialDetails.repartitionStatuts?.envoyees || 0}</div>
                    </div>
                    <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/30">
                      <div className="text-sm text-gray-300 mb-1">Brouillons</div>
                      <div className="text-2xl font-bold text-gray-400">{financialDetails.repartitionStatuts?.brouillons || 0}</div>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                      <div className="text-sm text-gray-300 mb-1">Annulées</div>
                      <div className="text-2xl font-bold text-orange-400">{financialDetails.repartitionStatuts?.annulees || 0}</div>
                    </div>
                  </div>
                </div>

                {/* Top 10 factures */}
                {financialDetails.topFactures && financialDetails.topFactures.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Top 10 Factures
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">#</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Numéro</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Client</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Montant TTC</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialDetails.topFactures.map((facture, index) => (
                            <tr key={facture.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {index + 1}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-white font-medium">{facture.numero}</td>
                              <td className="py-3 px-4 text-gray-300">{facture.client_nom}</td>
                              <td className="py-3 px-4 text-right text-white font-semibold">
                                {facture.montant_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                              </td>
                              <td className="py-3 px-4 text-gray-400">
                                {new Date(facture.date_facturation).toLocaleDateString('fr-FR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'notifications':
        console.log('✅ [Parametres] Rendu onglet notifications');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Configuration des Notifications
              </h2>
              <button
                onClick={() => {
                  window.location.hash = 'notifications';
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Voir toutes les notifications
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Préférences de notifications</h3>
              <p className="text-gray-400 mb-6">
                Configurez vos préférences pour recevoir des notifications sur différents événements.
              </p>

              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-md font-semibold text-white mb-3">Notifications Email</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Nouvelles factures créées</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Paiements reçus</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Factures en retard</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Rappels d'échéances (7 jours avant)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Nouveaux clients ajoutés</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-md font-semibold text-white mb-3">Notifications In-App</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Activer les notifications push</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Son de notification</span>
                    </label>
                    <div className="mt-4">
                      <label className="block text-sm text-gray-300 mb-2">Fréquence des notifications</label>
                      <select className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="immediate">Immédiat</option>
                        <option value="daily">Quotidien (résumé)</option>
                        <option value="weekly">Hebdomadaire (résumé)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-md font-semibold text-white mb-3">Mode Ne Pas Déranger</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300">Activer le mode ne pas déranger</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Heure de début</label>
                        <input
                          type="time"
                          defaultValue="22:00"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Heure de fin</label>
                        <input
                          type="time"
                          defaultValue="08:00"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    Enregistrer les préférences
                  </button>
                </div>
              </div>
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
                                  <div className="relative group">
                                    <button
                                      onClick={() => handleSuspendreEspace(client)}
                                      className={`p-2 rounded-lg transition-all ${
                                        client.espace_actif
                                          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30'
                                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                                      }`}
                                    >
                                      {client.espace_actif ? (
                                        <Pause className="w-4 h-4" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                    </button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      {client.espace_actif ? 'Suspendre' : 'Activer'}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                  <div className="relative group">
                                    <button
                                      onClick={() => handleResendCredentials(client)}
                                      disabled={resendingEmail === client.id}
                                      className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {resendingEmail === client.id ? (
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <Send className="w-4 h-4" />
                                      )}
                                    </button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Renvoyer les identifiants par email
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                  <div className="relative group">
                                    <button
                                      onClick={() => {
                                        setSelectedClientId(client.id);
                                        setShowClientDetailsModal(true);
                                      }}
                                      className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Voir et modifier les détails du client
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="relative group">
                                    <button
                                      onClick={() => {
                                        setSelectedClientId(client.id);
                                        setShowClientDetailsModal(true);
                                      }}
                                      className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Voir et modifier les détails du client
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                  <div className="relative group">
                                    <button
                                      onClick={() => handleCreateEspaceClick(client)}
                                      disabled={!client.email}
                                      className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      {!client.email ? 'Le client doit avoir un email' : 'Créer l\'espace membre avec abonnement'}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </>
                              )}
                              <div className="relative group">
                                <button
                                  key={`super-admin-${client.id}-${client.role}`}
                                  onClick={() => handleToggleSuperAdmin(client)}
                                  disabled={!client.espace_id}
                                  className={`p-2 rounded-lg transition-all ${
                                    client.role === 'client_super_admin'
                                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {(() => {
                                    const isSuperAdmin = client.role === 'client_super_admin';
                                    const Icon = isSuperAdmin ? ShieldOff : Crown;
                                    return <Icon className="w-4 h-4" />;
                                  })()}
                                </button>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {!client.espace_id ? 'L\'espace membre doit être créé d\'abord' : client.role === 'client_super_admin' ? 'Retirer le statut super admin' : 'Définir comme super admin'}
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                              <div className="relative group">
                                <button
                                  onClick={() => handleDeleteClient(client)}
                                  className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  Supprimer définitivement
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
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
                onClick={() => {
                  console.log('🔄 [Parametres] Changement d\'onglet:', tab.id);
                  setActiveTab(tab.id);
                }}
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
          client={selectedClientForEspace as any}
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

      {/* Modal Détails Client */}
      <ClientDetailsModal
        clientId={selectedClientId}
        isOpen={showClientDetailsModal}
        onClose={() => {
          setShowClientDetailsModal(false);
          setSelectedClientId(null);
        }}
        onUpdate={() => {
          loadAllClients();
        }}
      />
    </div>
  );
}
