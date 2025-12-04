import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getTauxCotisations, getTauxParDefaut } from '../services/cotisationsService';
import {
  Calculator,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Users,
  Receipt,
  BookOpen,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  Filter,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Edit,
  Trash2,
  X,
  Eye,
  RefreshCw,
  Settings
} from 'lucide-react';

type TabType = 'dashboard' | 'ecritures' | 'journaux' | 'fiches-paie' | 'bilans' | 'declarations' | 'plan-comptable' | 'parametres';

interface EcritureComptable {
  id: string;
  numero_piece: string;
  date_ecriture: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  type_ecriture: 'automatique' | 'manuelle' | 'importee';
  source_type?: string;
  journal_id: string;
  journal_code?: string;
  journal_libelle?: string;
  facture_id?: string;
  paiement_id?: string;
}

interface FichePaie {
  id: string;
  collaborateur_id: string;
  collaborateur_nom?: string;
  periode: string;
  date_paiement: string;
  salaire_brut: number;
  salaire_net: number;
  net_a_payer: number;
  statut: string;
  est_automatique: boolean;
}

interface RubriquePaie {
  id: string;
  code: string;
  libelle: string;
  categorie: string;
  sens: 'gain' | 'perte';
  ordre_affichage: number;
  groupe_affichage: string;
  par_defaut_active: boolean;
}

interface FichePaieLigne {
  id?: string;
  fiche_paie_id: string;
  rubrique_id: string;
  libelle_affiche?: string;
  base: number;
  unite_base?: string;
  taux_salarial?: number;
  montant_salarial?: number;
  taux_patronal?: number;
  montant_patronal?: number;
  montant_a_payer?: number;
  ordre_affichage?: number;
  groupe_affichage?: string;
  rubrique?: RubriquePaie;
}

interface DeclarationFiscale {
  id: string;
  type_declaration: string;
  periode: string;
  date_echeance: string;
  date_depot?: string;
  montant_due: number;
  montant_paye: number;
  statut: string;
}

interface BilanComptable {
  id: string;
  type_bilan: string;
  exercice: string;
  date_cloture: string;
  total_actif?: number;
  total_passif?: number;
  resultat_net?: number;
  chiffre_affaires?: number;
  est_provisoire: boolean;
  est_valide: boolean;
}

export default function Comptabilite() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // États pour les données
  const [ecritures, setEcritures] = useState<EcritureComptable[]>([]);
  const [fichesPaie, setFichesPaie] = useState<FichePaie[]>([]);
  const [declarations, setDeclarations] = useState<DeclarationFiscale[]>([]);
  const [bilans, setBilans] = useState<BilanComptable[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<Array<{ id: string; nom: string; prenom: string; email: string }>>([]);
  const [journaux, setJournaux] = useState<Array<{ id: string; code_journal: string; libelle: string }>>([]);
  const [rubriquesPaie, setRubriquesPaie] = useState<RubriquePaie[]>([]);
  const [fichePaieLignes, setFichePaieLignes] = useState<FichePaieLigne[]>([]);
  const [editingLigne, setEditingLigne] = useState<FichePaieLigne | null>(null);
  
  // États pour les modals et formulaires
  const [showFichePaieModal, setShowFichePaieModal] = useState(false);
  const [showViewFichePaieModal, setShowViewFichePaieModal] = useState(false);
  const [showEditFichePaieModal, setShowEditFichePaieModal] = useState(false);
  const [currentFichePaie, setCurrentFichePaie] = useState<any>(null);
  const [showEcritureModal, setShowEcritureModal] = useState(false);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [showBilanModal, setShowBilanModal] = useState(false);
  
  // États pour les formulaires
  const [fichePaieForm, setFichePaieForm] = useState({
    collaborateur_id: '',
    periode: new Date().toISOString().slice(0, 7), // Format YYYY-MM
    salaire_brut: '',
  });
  
  const [ecritureForm, setEcritureForm] = useState({
    journal_id: '',
    numero_piece: '',
    date_ecriture: new Date().toISOString().split('T')[0],
    libelle: '',
    compte_debit: '',
    compte_credit: '',
    montant: '',
    notes: '',
  });
  
  const [declarationForm, setDeclarationForm] = useState({
    type_declaration: 'tva',
    periode: new Date().toISOString().slice(0, 7), // Format YYYY-MM
  });
  
  const [bilanForm, setBilanForm] = useState({
    type_bilan: 'bilan',
    exercice: new Date().getFullYear().toString(),
    date_cloture: new Date().toISOString().split('T')[0],
  });
  
  // États pour les statistiques du dashboard
  const [stats, setStats] = useState({
    totalEcritures: 0,
    ecrituresAutomatiques: 0,
    ecrituresManuelles: 0,
    totalDebit: 0,
    totalCredit: 0,
    solde: 0,
    fichesPaieEnAttente: 0,
    declarationsEnRetard: 0,
    declarationsAfaire: 0,
  });

  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedEntreprise) {
      // Toujours charger les données de base nécessaires pour tous les onglets
      loadCollaborateurs();
      loadJournaux();
      loadRubriquesPaie(); // Charger les rubriques de paie
      // Charger les données spécifiques à l'onglet actif
      loadData();
    }
  }, [user, selectedEntreprise, activeTab]);

  const checkUserRole = async () => {
    if (!user) {
      setIsClient(false);
      return;
    }

    try {
      const { data: isPlatformAdmin } = await supabase.rpc('is_platform_super_admin');
      
      if (isPlatformAdmin === true) {
        setIsClient(false);
        loadEntreprises();
        return;
      }

      const { data: espaceClient } = await supabase
        .from('espaces_membres_clients')
        .select('id, entreprise_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (espaceClient?.entreprise_id) {
        setIsClient(true);
        setSelectedEntreprise(espaceClient.entreprise_id);
      } else {
        setIsClient(false);
        loadEntreprises();
      }
    } catch (error) {
      console.error('❌ Erreur vérification rôle:', error);
      setIsClient(false);
    }
  };

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom')
        .order('nom');

      if (error) throw error;
      
      setEntreprises(data || []);
      if (data && data.length > 0 && !selectedEntreprise) {
        setSelectedEntreprise(data[0].id);
      }
    } catch (error) {
      console.error('❌ Erreur chargement entreprises:', error);
    }
  };

  const loadData = async () => {
    if (!selectedEntreprise) return;

    setLoading(true);
    try {
      // Charger selon l'onglet actif
      switch (activeTab) {
        case 'dashboard':
          await Promise.all([
            loadStats(),
            loadEcrituresRecent(),
            loadDeclarationsRecent()
          ]);
          break;
        case 'ecritures':
          await loadEcritures();
          break;
        case 'fiches-paie':
          await loadFichesPaie();
          break;
        case 'declarations':
          await loadDeclarations();
          break;
        case 'bilans':
          await loadBilans();
          break;
        case 'journaux':
          // Les journaux sont déjà chargés dans loadJournaux() qui est appelé dans useEffect
          // Pas besoin de recharger ici
          break;
        case 'plan-comptable':
          // Le plan comptable sera chargé dans le composant si nécessaire
          break;
        case 'parametres':
          // Les paramètres seront chargés dans le composant si nécessaire
          break;
        default:
          console.warn(`⚠️ Onglet non géré: ${activeTab}`);
      }
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedEntreprise) return;

    try {
      // Statistiques écritures
      const { data: ecrituresData } = await supabase
        .from('ecritures_comptables')
        .select('type_ecriture, montant, compte_debit, compte_credit')
        .eq('entreprise_id', selectedEntreprise);

      if (ecrituresData && ecrituresData.length > 0) {
        const totalEcritures = ecrituresData.length;
        const ecrituresAutomatiques = ecrituresData.filter(e => e.type_ecriture === 'automatique').length;
        const ecrituresManuelles = totalEcritures - ecrituresAutomatiques;
        
        // Calculer le total débit (somme des montants où compte_debit existe)
        const totalDebit = ecrituresData
          .filter(e => e.compte_debit && e.compte_debit !== null && e.compte_debit !== '')
          .reduce((sum, e) => sum + Number(e.montant || 0), 0);
        
        // Calculer le total crédit (somme des montants où compte_credit existe)
        const totalCredit = ecrituresData
          .filter(e => e.compte_credit && e.compte_credit !== null && e.compte_credit !== '')
          .reduce((sum, e) => sum + Number(e.montant || 0), 0);

        const solde = totalDebit - totalCredit;

        console.log('📊 [Comptabilite] Stats écritures:', {
          total: totalEcritures,
          auto: ecrituresAutomatiques,
          manuelles: ecrituresManuelles,
          debit: totalDebit,
          credit: totalCredit,
          solde,
          ecrituresAvecDebit: ecrituresData.filter(e => e.compte_debit && e.compte_debit !== null && e.compte_debit !== '').length,
          ecrituresAvecCredit: ecrituresData.filter(e => e.compte_credit && e.compte_credit !== null && e.compte_credit !== '').length,
        });

        setStats(prev => ({
          ...prev,
          totalEcritures,
          ecrituresAutomatiques,
          ecrituresManuelles,
          totalDebit,
          totalCredit,
          solde,
        }));
      } else {
        console.warn('⚠️ [Comptabilite] Aucune écriture trouvée pour l\'entreprise:', selectedEntreprise);
        // Réinitialiser les stats si aucune écriture
        setStats(prev => ({
          ...prev,
          totalEcritures: 0,
          ecrituresAutomatiques: 0,
          ecrituresManuelles: 0,
          totalDebit: 0,
          totalCredit: 0,
          solde: 0,
        }));
      }

      // Statistiques fiches de paie
      // Note: La table fiches_paie n'a pas de colonne statut, on compte toutes les fiches
      const { data: fichesData, error: fichesError } = await supabase
        .from('fiches_paie')
        .select('id')
        .eq('entreprise_id', selectedEntreprise);

      if (fichesError) {
        console.warn('⚠️ [Comptabilite] Erreur chargement fiches de paie pour stats:', fichesError);
      }

      setStats(prev => ({
        ...prev,
        fichesPaieEnAttente: fichesData?.length || 0,
      }));

      // Statistiques déclarations
      const { data: declarationsData, error: declarationsError } = await supabase
        .from('declarations_fiscales')
        .select('statut, date_echeance, montant_due')
        .eq('entreprise_id', selectedEntreprise);

      if (declarationsError) {
        console.error('❌ Erreur chargement déclarations pour stats:', declarationsError);
      }

      if (declarationsData) {
        const aujourdhui = new Date();
        const enRetard = declarationsData.filter(d => 
          d.statut !== 'payee' && 
          d.statut !== 'deposee' &&
          d.date_echeance && 
          new Date(d.date_echeance) < aujourdhui
        ).length;
        
        const aFaire = declarationsData.filter(d => 
          d.statut === 'a_faire' || d.statut === 'en_cours' || d.statut === 'deposee'
        ).length;

        console.log('📋 [Comptabilite] Déclarations chargées:', {
          total: declarationsData.length,
          enRetard,
          aFaire,
          statuts: declarationsData.map(d => d.statut)
        });

        setStats(prev => ({
          ...prev,
          declarationsEnRetard: enRetard,
          declarationsAfaire: aFaire,
        }));
      } else {
        console.warn('⚠️ [Comptabilite] Aucune déclaration trouvée pour l\'entreprise:', selectedEntreprise);
      }
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
    }
  };

  const loadEcrituresRecent = async () => {
    if (!selectedEntreprise) return;

    try {
      console.log('🔄 [Comptabilite] Chargement écritures récentes pour entreprise:', selectedEntreprise);
      
      // Essayer d'abord avec la jointure inner
      let { data, error } = await supabase
        .from('ecritures_comptables')
        .select(`
          id,
          numero_piece,
          date_ecriture,
          libelle,
          compte_debit,
          compte_credit,
          montant,
          type_ecriture,
          source_type,
          journal_id,
          journaux_comptables!inner(code_journal, libelle)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('date_ecriture', { ascending: false })
        .limit(10);

      // Si erreur avec inner join, essayer avec left join
      if (error) {
        console.warn('⚠️ [Comptabilite] Erreur avec inner join, essai avec left join:', error.message);
        const result = await supabase
          .from('ecritures_comptables')
          .select(`
            id,
            numero_piece,
            date_ecriture,
            libelle,
            compte_debit,
            compte_credit,
            montant,
            type_ecriture,
            source_type,
            journal_id,
            journaux_comptables(code_journal, libelle)
          `)
          .eq('entreprise_id', selectedEntreprise)
          .order('date_ecriture', { ascending: false })
          .limit(10);
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ [Comptabilite] Erreur chargement écritures récentes:', error);
        throw error;
      }
      
      console.log(`✅ [Comptabilite] ${data?.length || 0} écritures récentes chargées`);
      
      setEcritures((data || []).map(e => ({
        ...e,
        journal_code: (e.journaux_comptables as any)?.code_journal || 'N/A',
        journal_libelle: (e.journaux_comptables as any)?.libelle || 'Journal inconnu',
      })));
    } catch (error) {
      console.error('❌ Erreur chargement écritures:', error);
      setEcritures([]);
    }
  };

  const loadEcritures = async () => {
    if (!selectedEntreprise) return;

    try {
      console.log('🔄 [Comptabilite] Chargement écritures pour entreprise:', selectedEntreprise);
      
      // Essayer d'abord avec la jointure inner
      let { data, error } = await supabase
        .from('ecritures_comptables')
        .select(`
          id,
          numero_piece,
          date_ecriture,
          libelle,
          compte_debit,
          compte_credit,
          montant,
          type_ecriture,
          source_type,
          journal_id,
          journaux_comptables!inner(code_journal, libelle)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('date_ecriture', { ascending: false })
        .limit(100);

      // Si erreur avec inner join, essayer avec left join
      if (error) {
        console.warn('⚠️ [Comptabilite] Erreur avec inner join, essai avec left join:', error.message);
        const result = await supabase
          .from('ecritures_comptables')
          .select(`
            id,
            numero_piece,
            date_ecriture,
            libelle,
            compte_debit,
            compte_credit,
            montant,
            type_ecriture,
            source_type,
            journal_id,
            journaux_comptables(code_journal, libelle)
          `)
          .eq('entreprise_id', selectedEntreprise)
          .order('date_ecriture', { ascending: false })
          .limit(100);
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ [Comptabilite] Erreur chargement écritures:', error);
        throw error;
      }
      
      console.log(`✅ [Comptabilite] ${data?.length || 0} écritures chargées`);
      
      setEcritures((data || []).map(e => ({
        ...e,
        journal_code: (e.journaux_comptables as any)?.code_journal || 'N/A',
        journal_libelle: (e.journaux_comptables as any)?.libelle || 'Journal inconnu',
      })));
    } catch (error) {
      console.error('❌ Erreur chargement écritures:', error);
      setEcritures([]);
    }
  };

  const loadCollaborateurs = async (entrepriseId?: string) => {
    const id = entrepriseId || selectedEntreprise;
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('collaborateurs_entreprise')
        .select('id, nom, prenom, email')
        .eq('entreprise_id', id)
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setCollaborateurs(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement collaborateurs:', error);
      setCollaborateurs([]);
    }
  };

  const loadJournaux = async (entrepriseId?: string) => {
    const id = entrepriseId || selectedEntreprise;
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('journaux_comptables')
        .select('id, code_journal, libelle')
        .eq('entreprise_id', id)
        .order('code_journal');

      if (error) throw error;
      setJournaux(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement journaux:', error);
      setJournaux([]);
    }
  };

  // Fonction pour charger automatiquement le salaire brut et les taux de charges
  const loadSalaireBrutEtTaux = async (collaborateurId: string) => {
    if (!selectedEntreprise || !collaborateurId) return;

    try {
      // 1. Récupérer le salaire brut depuis la table salaries
      const { data: salaryData } = await supabase
        .from('salaries')
        .select('salaire_brut, collaborateur_id')
        .eq('collaborateur_id', collaborateurId)
        .eq('actif', true)
        .order('date_debut', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Si pas trouvé par collaborateur_id, chercher par nom/prénom dans collaborateurs_entreprise
      if (!salaryData) {
        const { data: collab } = await supabase
          .from('collaborateurs_entreprise')
          .select('nom, prenom')
          .eq('id', collaborateurId)
          .maybeSingle();

        if (collab) {
          const { data: salaryByName } = await supabase
            .from('salaries')
            .select('salaire_brut')
            .eq('entreprise_id', selectedEntreprise)
            .eq('nom', collab.nom)
            .eq('prenom', collab.prenom)
            .eq('actif', true)
            .order('date_debut', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (salaryByName) {
            setFichePaieForm(prev => ({
              ...prev,
              salaire_brut: salaryByName.salaire_brut?.toString() || ''
            }));
            console.log('✅ Salaire brut récupéré depuis salaries (par nom):', salaryByName.salaire_brut);
          }
        }
      } else {
        setFichePaieForm(prev => ({
          ...prev,
          salaire_brut: salaryData.salaire_brut?.toString() || ''
        }));
        console.log('✅ Salaire brut récupéré depuis salaries:', salaryData.salaire_brut);
      }

      // 2. Récupérer les taux de cotisations
      const taux = await getTauxCotisations(selectedEntreprise, collaborateurId);
      console.log('✅ Taux de cotisations récupérés:', taux);
      
      // Les taux seront utilisés automatiquement lors de la génération de la fiche de paie
      // On peut les stocker dans un état si nécessaire pour les afficher
      
    } catch (error) {
      console.error('❌ Erreur chargement salaire brut et taux:', error);
    }
  };

  const loadFichesPaie = async () => {
    if (!selectedEntreprise) return;

    try {
      console.log('🔄 [Comptabilite] Chargement fiches de paie pour entreprise:', selectedEntreprise);
      
      const { data, error } = await supabase
        .from('fiches_paie')
        .select(`
          id,
          collaborateur_id,
          periode_debut,
          periode_fin,
          salaire_brut,
          net_a_payer,
          numero,
          created_at
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('periode_debut', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ [Comptabilite] Erreur chargement fiches de paie:', error);
        throw error;
      }
      
      console.log(`✅ [Comptabilite] ${data?.length || 0} fiches de paie chargées`);
      
      // Enrichir avec les noms des collaborateurs
      const fichesWithNames = await Promise.all((data || []).map(async (f) => {
        if (f.collaborateur_id) {
          const { data: collab } = await supabase
            .from('collaborateurs_entreprise')
            .select('nom, prenom')
            .eq('id', f.collaborateur_id)
            .maybeSingle();
          
          return {
            ...f,
            collaborateur_nom: collab ? `${collab.prenom || ''} ${collab.nom || ''}`.trim() : 'Collaborateur inconnu',
            // Ajouter des champs calculés pour compatibilité avec l'affichage
            periode: f.periode_debut ? new Date(f.periode_debut).toISOString().slice(0, 7) : '',
            date_paiement: f.periode_fin || f.created_at || new Date().toISOString(),
            salaire_net: f.net_a_payer || 0,
            statut: 'validee', // Par défaut, les fiches existantes sont considérées comme validées
            est_automatique: true, // Par défaut, les fiches sont automatiques
          };
        }
        return { 
          ...f, 
          collaborateur_nom: 'Non assigné',
          periode: f.periode_debut ? new Date(f.periode_debut).toISOString().slice(0, 7) : '',
          date_paiement: f.periode_fin || f.created_at || new Date().toISOString(),
          salaire_net: f.net_a_payer || 0,
          statut: 'validee',
          est_automatique: true,
        };
      }));
      
      setFichesPaie(fichesWithNames);
    } catch (error) {
      console.error('❌ Erreur chargement fiches de paie:', error);
      setFichesPaie([]);
    }
  };

  const loadDeclarations = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('declarations_fiscales')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('periode', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDeclarations(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement déclarations:', error);
    }
  };

  const loadDeclarationsRecent = async () => {
    if (!selectedEntreprise) return;

    try {
      console.log('🔄 [Comptabilite] Chargement déclarations récentes pour entreprise:', selectedEntreprise);
      
      const { data, error } = await supabase
        .from('declarations_fiscales')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('date_echeance', { ascending: true })
        .limit(5);

      if (error) {
        console.error('❌ [Comptabilite] Erreur chargement déclarations récentes:', error);
        throw error;
      }
      
      console.log(`✅ [Comptabilite] ${data?.length || 0} déclarations récentes chargées`);
      
      setDeclarations(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement déclarations:', error);
      setDeclarations([]);
    }
  };

  const loadBilans = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('bilans_comptables')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('exercice', { ascending: false })
        .limit(20);

      if (error) throw error;
      setBilans(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement bilans:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  // Charger les rubriques de paie
  const loadRubriquesPaie = async () => {
    try {
      const { data, error } = await supabase
        .from('rubriques_paie')
        .select('*')
        .order('ordre_affichage', { ascending: true });

      if (error) throw error;
      setRubriquesPaie(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement rubriques de paie:', error);
      setRubriquesPaie([]);
    }
  };

  // Charger les lignes d'une fiche de paie
  const loadFichePaieLignes = async (fichePaieId: string) => {
    try {
      console.log('🔄 [Comptabilite] Chargement lignes de paie pour fiche:', fichePaieId);
      
      const { data, error } = await supabase
        .from('fiches_paie_lignes')
        .select(`
          *,
          rubriques_paie (*)
        `)
        .eq('fiche_paie_id', fichePaieId)
        .order('ordre_affichage', { ascending: true });

      if (error) {
        console.error('❌ [Comptabilite] Erreur chargement lignes:', error);
        throw error;
      }
      
      console.log(`✅ [Comptabilite] ${data?.length || 0} lignes chargées:`, data);
      
      const lignes: FichePaieLigne[] = (data || []).map((l: any) => {
        const ligne: FichePaieLigne = {
          id: l.id,
          fiche_paie_id: l.fiche_paie_id,
          rubrique_id: l.rubrique_id,
          libelle_affiche: l.libelle_affiche || l.rubriques_paie?.libelle || 'N/A',
          base: l.base || 0,
          taux_salarial: l.taux_salarial || 0,
          montant_salarial: l.montant_salarial || 0,
          taux_patronal: l.taux_patronal || 0,
          montant_patronal: l.montant_patronal || 0,
          montant_a_payer: l.montant_a_payer || 0,
          ordre_affichage: l.ordre_affichage || 0,
          groupe_affichage: l.groupe_affichage || 'autre',
          rubrique: l.rubriques_paie,
        };
        
        console.log('📋 [Comptabilite] Ligne mappée:', {
          libelle: ligne.libelle_affiche,
          base: ligne.base,
          taux_salarial: ligne.taux_salarial,
          montant_salarial: ligne.montant_salarial,
          taux_patronal: ligne.taux_patronal,
          montant_patronal: ligne.montant_patronal,
        });
        
        return ligne;
      });
      
      setFichePaieLignes(lignes);
      console.log('✅ [Comptabilite] Lignes définies dans le state:', lignes.length);
      return lignes;
    } catch (error) {
      console.error('❌ Erreur chargement lignes de paie:', error);
      setFichePaieLignes([]);
      return [];
    }
  };

  // Recalculer les totaux d'une fiche de paie
  const recalculerTotauxFichePaie = async (fichePaieId: string, lignes: FichePaieLigne[]) => {
    try {
      const totalCotisationsSalariales = lignes
        .filter(l => l.montant_salarial && l.montant_salarial < 0)
        .reduce((sum, l) => sum + Math.abs(l.montant_salarial || 0), 0);

      const totalCotisationsPatronales = lignes
        .filter(l => l.montant_patronal && l.montant_patronal > 0)
        .reduce((sum, l) => sum + (l.montant_patronal || 0), 0);

      // Trouver le salaire brut (ligne avec code SAL_BASE ou première ligne gain)
      const salaireBrutLigne = lignes.find(l => 
        l.rubrique?.code === 'SAL_BASE' || 
        (l.rubrique?.sens === 'gain' && l.montant_a_payer && l.montant_a_payer > 0)
      );
      const salaireBrut = salaireBrutLigne?.montant_a_payer || salaireBrutLigne?.base || 0;

      const netImposable = lignes
        .filter(l => l.rubrique?.code === 'NET_IMPOSABLE' || l.montant_a_payer !== undefined)
        .reduce((sum, l) => sum + (l.montant_a_payer || 0), 0);

      const netAPayer = lignes
        .filter(l => l.rubrique?.code === 'NET_A_PAYER' || (l.montant_a_payer && l.montant_a_payer > 0))
        .reduce((sum, l) => sum + (l.montant_a_payer || 0), 0);

      const coutTotalEmployeur = salaireBrut + totalCotisationsPatronales;

      // Mettre à jour la fiche de paie
      const { error } = await supabase
        .from('fiches_paie')
        .update({
          salaire_brut: salaireBrut,
          total_cotisations_salariales: totalCotisationsSalariales,
          total_cotisations_patronales: totalCotisationsPatronales,
          net_imposable: netImposable || salaireBrut - totalCotisationsSalariales,
          net_a_payer: netAPayer || salaireBrut - totalCotisationsSalariales,
          cout_total_employeur: coutTotalEmployeur,
        })
        .eq('id', fichePaieId);

      if (error) throw error;
      
      return {
        salaire_brut: salaireBrut,
        total_cotisations_salariales: totalCotisationsSalariales,
        total_cotisations_patronales: totalCotisationsPatronales,
        net_imposable: netImposable || salaireBrut - totalCotisationsSalariales,
        net_a_payer: netAPayer || salaireBrut - totalCotisationsSalariales,
        cout_total_employeur: coutTotalEmployeur,
      };
    } catch (error) {
      console.error('❌ Erreur recalcul totaux:', error);
      throw error;
    }
  };

  // Ajouter une ligne à une fiche de paie
  const handleAjouterLignePaie = async (fichePaieId: string, rubriqueId: string) => {
    try {
      const rubrique = rubriquesPaie.find(r => r.id === rubriqueId);
      if (!rubrique) return;

      const nouvelleLigne: Partial<FichePaieLigne> = {
        fiche_paie_id: fichePaieId,
        rubrique_id: rubriqueId,
        libelle_affiche: rubrique.libelle,
        base: 0,
        taux_salarial: 0,
        montant_salarial: 0,
        taux_patronal: 0,
        montant_patronal: 0,
        montant_a_payer: 0,
        ordre_affichage: fichePaieLignes.length + 1,
        groupe_affichage: rubrique.groupe_affichage || 'autre',
      };

      const { data, error } = await supabase
        .from('fiches_paie_lignes')
        .insert(nouvelleLigne)
        .select(`
          *,
          rubriques_paie (*)
        `)
        .single();

      if (error) throw error;

      const ligneAvecRubrique: FichePaieLigne = {
        ...data,
        rubrique: data.rubriques_paie,
      };

      const nouvellesLignes = [...fichePaieLignes, ligneAvecRubrique];
      setFichePaieLignes(nouvellesLignes);
      
      // Recalculer les totaux
      await recalculerTotauxFichePaie(fichePaieId, nouvellesLignes);
      
      return ligneAvecRubrique;
    } catch (error) {
      console.error('❌ Erreur ajout ligne:', error);
      alert(`Erreur: ${(error as any).message || 'Impossible d\'ajouter la ligne'}`);
      throw error;
    }
  };

  // Modifier une ligne de paie
  const handleModifierLignePaie = async (ligne: FichePaieLigne) => {
    if (!ligne.id || !currentFichePaie) return;

    try {
      setLoading(true);

      // Recalculer montant_salarial et montant_patronal si base et taux sont fournis
      let montantSalarial = ligne.montant_salarial || 0;
      let montantPatronal = ligne.montant_patronal || 0;

      if (ligne.base && ligne.taux_salarial) {
        montantSalarial = (ligne.base * ligne.taux_salarial) / 100;
      }
      if (ligne.base && ligne.taux_patronal) {
        montantPatronal = (ligne.base * ligne.taux_patronal) / 100;
      }

      const { error } = await supabase
        .from('fiches_paie_lignes')
        .update({
          libelle_affiche: ligne.libelle_affiche,
          base: ligne.base,
          taux_salarial: ligne.taux_salarial,
          montant_salarial: montantSalarial,
          taux_patronal: ligne.taux_patronal,
          montant_patronal: montantPatronal,
          montant_a_payer: ligne.montant_a_payer,
          ordre_affichage: ligne.ordre_affichage,
        })
        .eq('id', ligne.id);

      if (error) throw error;

      // Recharger les lignes
      const nouvellesLignes = await loadFichePaieLignes(currentFichePaie.id);
      
      // Recalculer les totaux
      await recalculerTotauxFichePaie(currentFichePaie.id, nouvellesLignes);
      
      setEditingLigne(null);
      alert('✅ Ligne modifiée avec succès !');
    } catch (error: any) {
      console.error('❌ Erreur modification ligne:', error);
      alert(`Erreur: ${error.message || 'Impossible de modifier la ligne'}`);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une ligne de paie
  const handleSupprimerLignePaie = async (ligneId: string) => {
    if (!currentFichePaie) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette ligne ?')) {
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('fiches_paie_lignes')
        .delete()
        .eq('id', ligneId);

      if (error) throw error;

      // Recharger les lignes
      const nouvellesLignes = await loadFichePaieLignes(currentFichePaie.id);
      
      // Recalculer les totaux
      await recalculerTotauxFichePaie(currentFichePaie.id, nouvellesLignes);
      
      alert('✅ Ligne supprimée avec succès !');
    } catch (error: any) {
      console.error('❌ Erreur suppression ligne:', error);
      alert(`Erreur: ${error.message || 'Impossible de supprimer la ligne'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Visualiser une fiche de paie
  const handleVisualiserFichePaie = (fiche: any) => {
    setCurrentFichePaie(fiche);
    setShowViewFichePaieModal(true);
  };

  // HANDLER : Modifier une fiche de paie
  const handleModifierFichePaie = async (fiche: any) => {
    try {
      // Recharger les données complètes de la fiche de paie depuis la base (sans jointure automatique)
      const { data: ficheComplete, error } = await supabase
        .from('fiches_paie')
        .select('*')
        .eq('id', fiche.id)
        .single();

      if (error) {
        console.error('❌ Erreur chargement fiche de paie:', error);
        alert('Erreur lors du chargement de la fiche de paie');
        return;
      }

      // Charger les informations du collaborateur séparément
      let collaborateurNom = fiche.collaborateur_nom || 'N/A';
      if (ficheComplete.collaborateur_id) {
        const { data: collab } = await supabase
          .from('collaborateurs_entreprise')
          .select('nom, prenom')
          .eq('id', ficheComplete.collaborateur_id)
          .maybeSingle();
        
        if (collab) {
          collaborateurNom = `${collab.prenom || ''} ${collab.nom || ''}`.trim();
        }
      }

      // Construire l'objet fiche avec toutes les données
      const ficheAvecDonnees = {
        ...ficheComplete,
        collaborateur_nom: collaborateurNom,
        periode: ficheComplete.periode_debut 
          ? new Date(ficheComplete.periode_debut).toISOString().slice(0, 7)
          : fiche.periode || new Date().toISOString().slice(0, 7),
        salaire_brut: ficheComplete.salaire_brut || 0,
      };

      setCurrentFichePaie(ficheAvecDonnees);
      setFichePaieForm({
        collaborateur_id: ficheComplete.collaborateur_id || '',
        periode: ficheAvecDonnees.periode,
        salaire_brut: ficheComplete.salaire_brut?.toString() || '0',
      });
      
      // Charger les lignes de cette fiche de paie
      await loadFichePaieLignes(fiche.id);
      
      setShowEditFichePaieModal(true);
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'ouverture du modal d\'édition:', error);
      alert('Erreur: ' + (error.message || 'Impossible de charger la fiche de paie'));
    }
  };

  // HANDLER : Supprimer une fiche de paie
  const handleSupprimerFichePaie = async (fiche: any) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la fiche de paie ${fiche.numero} ?`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('fiches_paie')
        .delete()
        .eq('id', fiche.id);

      if (error) throw error;

      alert('✅ Fiche de paie supprimée avec succès !');
      await loadFichesPaie();
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erreur suppression fiche de paie:', error);
      alert(`Erreur: ${error.message || 'Impossible de supprimer la fiche de paie'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Télécharger PDF fiche de paie
  const handleTelechargerPDFFichePaie = async (fiche: any) => {
    try {
      setLoading(true);
      
      console.log('🔄 [Comptabilite] Génération PDF pour fiche:', fiche.id);
      
      // Récupérer les informations de la fiche de paie
      const { data: ficheData, error: ficheError } = await supabase
        .from('fiches_paie')
        .select('*')
        .eq('id', fiche.id)
        .single();

      if (ficheError || !ficheData) {
        console.error('❌ [Comptabilite] Erreur récupération fiche:', ficheError);
        throw new Error(`Impossible de récupérer la fiche de paie: ${ficheError?.message || 'Erreur inconnue'}`);
      }

      // Récupérer les informations du collaborateur
      let collaborateur = null;
      if (ficheData.collaborateur_id) {
        const { data: collabData, error: collabError } = await supabase
          .from('collaborateurs_entreprise')
          .select('nom, prenom, email')
          .eq('id', ficheData.collaborateur_id)
          .maybeSingle();
        
        if (collabError) {
          console.warn('⚠️ [Comptabilite] Erreur récupération collaborateur:', collabError);
        } else {
          collaborateur = collabData;
        }
      }

      // Récupérer les informations de l'entreprise
      let entreprise = null;
      if (ficheData.entreprise_id) {
        const { data: entrepriseData, error: entrepriseError } = await supabase
          .from('entreprises')
          .select('nom, adresse, code_postal, ville, siret, email, telephone')
          .eq('id', ficheData.entreprise_id)
          .maybeSingle();
        
        if (entrepriseError) {
          console.warn('⚠️ [Comptabilite] Erreur récupération entreprise:', entrepriseError);
        } else {
          entreprise = entrepriseData;
        }
      }

      // Charger les lignes de paie depuis fiches_paie_lignes
      const { data: lignesData, error: lignesError } = await supabase
        .from('fiches_paie_lignes')
        .select(`
          *,
          rubriques_paie (*)
        `)
        .eq('fiche_paie_id', fiche.id)
        .order('ordre_affichage', { ascending: true });

      if (lignesError) {
        console.warn('⚠️ [Comptabilite] Erreur récupération lignes:', lignesError);
      }

      // Construire l'objet complet pour le PDF
      const ficheComplete = {
        ...ficheData,
        collaborateurs_entreprise: collaborateur || { nom: 'N/A', prenom: 'N/A', email: '' },
        entreprises: entreprise || { nom: 'N/A', adresse: '', code_postal: '', ville: '', siret: '', email: '', telephone: '' },
        lignes: (lignesData || []).map((l: any) => ({
          libelle: l.libelle_affiche || l.rubriques_paie?.libelle || 'N/A',
          base: l.base || 0,
          taux_salarial: l.taux_salarial || 0,
          montant_salarial: l.montant_salarial || 0,
          taux_patronal: l.taux_patronal || 0,
          montant_patronal: l.montant_patronal || 0,
          montant_a_payer: l.montant_a_payer || 0,
          ordre_affichage: l.ordre_affichage || 0,
          groupe_affichage: l.groupe_affichage || 'autre',
        })),
      };

      console.log('✅ [Comptabilite] Données complètes récupérées:', ficheComplete);

      // Générer le PDF
      const { generatePDFFichePaie } = await import('../lib/pdfGeneratorFichePaie');
      await generatePDFFichePaie(ficheComplete);

      alert('✅ PDF généré avec succès !');
    } catch (error: any) {
      console.error('❌ [Comptabilite] Erreur génération PDF:', error);
      alert(`Erreur: ${error.message || 'Impossible de générer le PDF'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Sauvegarder modification fiche de paie
  const handleSaveEditFichePaie = async () => {
    if (!currentFichePaie || !selectedEntreprise) return;

    try {
      setLoading(true);

      // Convertir periode (YYYY-MM) en periode_debut et periode_fin
      const periodeDate = new Date(fichePaieForm.periode + '-01');
      const periodeDebut = periodeDate.toISOString().split('T')[0];
      const periodeFin = new Date(periodeDate.getFullYear(), periodeDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const salaireBrut = parseFloat(fichePaieForm.salaire_brut) || currentFichePaie.salaire_brut || 2000;
      const cotisations = salaireBrut * 0.22;
      const salaireNet = salaireBrut - cotisations;

      const { error } = await supabase
        .from('fiches_paie')
        .update({
          periode_debut: periodeDebut,
          periode_fin: periodeFin,
          salaire_brut: salaireBrut,
          net_a_payer: salaireNet,
        })
        .eq('id', currentFichePaie.id);

      if (error) throw error;

      alert('✅ Fiche de paie modifiée avec succès !');
      setShowEditFichePaieModal(false);
      setCurrentFichePaie(null);
      await loadFichesPaie();
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erreur modification fiche de paie:', error);
      alert(`Erreur: ${error.message || 'Impossible de modifier la fiche de paie'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Générer une fiche de paie
  const handleGenererFichePaie = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    if (!fichePaieForm.collaborateur_id || !fichePaieForm.periode) {
      alert('Veuillez sélectionner un collaborateur et une période');
      return;
    }

    try {
      setLoading(true);

      // Créer la fiche de paie directement (la fonction RPC utilise des colonnes qui n'existent pas)
      const salaireBrut = parseFloat(fichePaieForm.salaire_brut) || 0;
      
      // Récupérer les informations du collaborateur (sans salaire_brut car cette colonne n'existe pas)
      const { data: collab, error: collabError } = await supabase
        .from('collaborateurs_entreprise')
        .select('nom, prenom, email')
        .eq('id', fichePaieForm.collaborateur_id)
        .maybeSingle();
      
      if (collabError) {
        console.error('❌ [Comptabilite] Erreur récupération collaborateur:', collabError);
        throw new Error(`Erreur lors de la récupération du collaborateur: ${collabError.message}`);
      }
      
      if (!collab) {
        console.error('❌ [Comptabilite] Collaborateur non trouvé:', fichePaieForm.collaborateur_id);
        throw new Error('Collaborateur non trouvé');
      }
      
      console.log('✅ [Comptabilite] Collaborateur trouvé:', collab);
      
      // Trouver ou créer le salary_id dans la table salaries
      let salaryId: string | null = null;
      
      // Chercher un salary existant pour ce collaborateur (par collaborateur_id d'abord)
      const { data: existingSalaryByCollabId } = await supabase
        .from('salaries')
        .select('id, salaire_brut')
        .eq('collaborateur_id', fichePaieForm.collaborateur_id)
        .eq('actif', true)
        .order('date_debut', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingSalaryByCollabId) {
        salaryId = existingSalaryByCollabId.id;
        console.log('✅ [Comptabilite] Salary existant trouvé (par collaborateur_id):', salaryId);
      } else {
        // Chercher par nom/prénom
        const { data: existingSalary } = await supabase
          .from('salaries')
          .select('id, salaire_brut')
          .eq('entreprise_id', selectedEntreprise)
          .eq('nom', collab.nom)
          .eq('prenom', collab.prenom)
          .eq('actif', true)
          .order('date_debut', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingSalary) {
          salaryId = existingSalary.id;
          console.log('✅ [Comptabilite] Salary existant trouvé (par nom):', salaryId);
        } else {
          // Créer un salary si il n'existe pas
          // Le salaire brut vient du formulaire ou d'une valeur par défaut
          const salaireBrutInitial = salaireBrut || 2000;
          
          console.log('🔄 [Comptabilite] Création d\'un nouveau salary pour:', collab.nom, collab.prenom);
          
          const { data: newSalary, error: createSalaryError } = await supabase
            .from('salaries')
            .insert({
              entreprise_id: selectedEntreprise,
              collaborateur_id: fichePaieForm.collaborateur_id,
              nom: collab.nom,
              prenom: collab.prenom,
              email: collab.email || `${collab.prenom.toLowerCase()}.${collab.nom.toLowerCase()}@sastest.fr`,
              salaire_brut: salaireBrutInitial,
              type_contrat: 'CDI',
              statut: 'actif',
              date_embauche: new Date().toISOString().split('T')[0],
              date_debut: new Date().toISOString().split('T')[0],
            })
            .select('id, salaire_brut')
            .single();
          
          if (createSalaryError || !newSalary) {
            console.error('❌ [Comptabilite] Erreur création salary:', createSalaryError);
            throw new Error(`Impossible de créer le salary pour ce collaborateur: ${createSalaryError?.message || 'Erreur inconnue'}`);
          }
          
          salaryId = newSalary.id;
          console.log('✅ [Comptabilite] Nouveau salary créé:', salaryId);
        }
      }
      
      // Déterminer le salaire brut final
      let salaireBrutFinal = salaireBrut;
      
      // Si pas de salaire brut fourni dans le formulaire, récupérer depuis le salary
      if (!salaireBrutFinal || salaireBrutFinal === 0) {
        if (existingSalaryByCollabId?.salaire_brut) {
          salaireBrutFinal = parseFloat(existingSalaryByCollabId.salaire_brut.toString()) || 0;
        } else if (salaryId) {
          const { data: salaryData } = await supabase
            .from('salaries')
            .select('salaire_brut')
            .eq('id', salaryId)
            .maybeSingle();
          
          if (salaryData?.salaire_brut) {
            salaireBrutFinal = parseFloat(salaryData.salaire_brut.toString()) || 0;
          }
        }
      }
      
      // Si toujours pas de salaire, utiliser une valeur par défaut
      if (!salaireBrutFinal || salaireBrutFinal === 0) {
        salaireBrutFinal = 2000; // Valeur par défaut
      }
      
      console.log('💰 [Comptabilite] Salaire brut final:', salaireBrutFinal);

      // Convertir periode (YYYY-MM) en periode_debut et periode_fin
      const periodeDate = new Date(fichePaieForm.periode + '-01');
      const periodeDebut = periodeDate.toISOString().split('T')[0];
      // Fin du mois
      const periodeFin = new Date(periodeDate.getFullYear(), periodeDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      // Générer un numéro unique
      const numero = `FDP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Calculer le net à payer (sera recalculé après la création des lignes de paie)
      // Pour l'instant, on utilise une estimation basique
      const cotisationsEstimees = salaireBrutFinal * 0.22; // 22% de cotisations (simplifié)
      const salaireNetEstime = salaireBrutFinal - cotisationsEstimees;

      const { data: nouvelleFiche, error: insertError } = await supabase
        .from('fiches_paie')
        .insert({
          entreprise_id: selectedEntreprise,
          collaborateur_id: fichePaieForm.collaborateur_id,
          salary_id: salaryId,
          periode_debut: periodeDebut,
          periode_fin: periodeFin,
          salaire_brut: salaireBrutFinal,
          net_a_payer: salaireNetEstime,
          numero: numero,
        })
        .select('id')
        .single();

      if (insertError || !nouvelleFiche) {
        console.error('❌ [Comptabilite] Erreur insertion fiche de paie:', insertError);
        throw insertError || new Error('Impossible de créer la fiche de paie');
      }

      // Récupérer les taux de cotisations depuis la convention collective
      console.log('🔄 [Comptabilite] Récupération des taux de cotisations...');
      const tauxCotisations = await getTauxCotisations(selectedEntreprise, fichePaieForm.collaborateur_id);
      console.log('✅ [Comptabilite] Taux récupérés:', tauxCotisations);

      // Charger les rubriques par défaut si pas encore chargées
      if (rubriquesPaie.length === 0) {
        await loadRubriquesPaie();
      }

      // Créer les lignes par défaut pour cette fiche de paie
      const rubriquesParDefaut = rubriquesPaie.filter(r => r.par_defaut_active);
      
      if (rubriquesParDefaut.length > 0) {
        const lignesParDefaut = rubriquesParDefaut.map((rubrique, index) => {
          let base = salaireBrutFinal;
          let tauxSalarial = 0;
          let tauxPatronal = 0;
          let montantAPayer = 0;

          // Utiliser les taux récupérés depuis la convention collective
          switch (rubrique.code) {
            case 'SAL_BASE':
              montantAPayer = salaireBrutFinal;
              break;
            case 'SS_MALADIE_SAL':
              tauxSalarial = tauxCotisations.taux_ss_maladie_sal * 100; // Convertir en %
              break;
            case 'SS_VIEIL_PLAF_SAL':
              tauxSalarial = tauxCotisations.taux_ss_vieil_plaf_sal * 100;
              break;
            case 'SS_VIEIL_DEPLAF_SAL':
              tauxSalarial = tauxCotisations.taux_ss_vieil_deplaf_sal * 100;
              break;
            case 'ASS_CHOMAGE_SAL':
              tauxSalarial = tauxCotisations.taux_ass_chomage_sal * 100;
              break;
            case 'RET_COMPL_SAL':
              tauxSalarial = tauxCotisations.taux_ret_compl_sal * 100;
              break;
            case 'CSG_DED':
              tauxSalarial = tauxCotisations.taux_csg_ded_sal * 100;
              break;
            case 'CSG_NON_DED':
              tauxSalarial = tauxCotisations.taux_csg_non_ded_sal * 100;
              break;
            case 'SS_MALADIE_PAT':
              tauxPatronal = tauxCotisations.taux_ss_maladie_pat * 100;
              break;
            case 'SS_VIEIL_PLAF_PAT':
              tauxPatronal = tauxCotisations.taux_ss_vieil_plaf_pat * 100;
              break;
            case 'SS_VIEIL_DEPLAF_PAT':
              tauxPatronal = tauxCotisations.taux_ss_vieil_deplaf_pat * 100;
              break;
            case 'ALLOC_FAM_PAT':
              tauxPatronal = tauxCotisations.taux_alloc_fam_pat * 100;
              break;
            case 'AT_MP_PAT':
              tauxPatronal = tauxCotisations.taux_at_mp_pat * 100;
              break;
            case 'ASS_CHOMAGE_PAT':
              tauxPatronal = tauxCotisations.taux_ass_chomage_pat * 100;
              break;
            case 'RET_COMPL_PAT':
              tauxPatronal = tauxCotisations.taux_ret_compl_pat * 100;
              break;
            case 'NET_A_PAYER':
              // Sera calculé après toutes les cotisations
              break;
          }

          const montantSalarial = tauxSalarial ? -(base * tauxSalarial) / 100 : 0;
          const montantPatronal = tauxPatronal ? (base * tauxPatronal) / 100 : 0;

          const ligne = {
            fiche_paie_id: nouvelleFiche.id,
            rubrique_id: rubrique.id,
            libelle_affiche: rubrique.libelle,
            base: base,
            taux_salarial: tauxSalarial > 0 ? tauxSalarial : null,
            montant_salarial: montantSalarial !== 0 ? montantSalarial : null,
            taux_patronal: tauxPatronal > 0 ? tauxPatronal : null,
            montant_patronal: montantPatronal !== 0 ? montantPatronal : null,
            montant_a_payer: montantAPayer || null,
            ordre_affichage: index + 1,
            groupe_affichage: rubrique.groupe_affichage || 'autre',
          };
          
          console.log(`📋 [Comptabilite] Ligne créée pour ${rubrique.libelle}:`, {
            base: ligne.base,
            taux_salarial: ligne.taux_salarial,
            montant_salarial: ligne.montant_salarial,
            taux_patronal: ligne.taux_patronal,
            montant_patronal: ligne.montant_patronal,
          });
          
          return ligne;
        });

        // Calculer le net à payer
        const totalCotisationsSalariales = lignesParDefaut
          .filter(l => l.montant_salarial && l.montant_salarial < 0)
          .reduce((sum, l) => sum + Math.abs(l.montant_salarial || 0), 0);
        
        const ligneNetAPayer = lignesParDefaut.find(l => l.rubrique_id === rubriquesParDefaut.find(r => r.code === 'NET_A_PAYER')?.id);
        if (ligneNetAPayer) {
          ligneNetAPayer.montant_a_payer = salaireBrutFinal - totalCotisationsSalariales;
        }

        // Insérer toutes les lignes
        const { error: lignesError } = await supabase
          .from('fiches_paie_lignes')
          .insert(lignesParDefaut);

        if (lignesError) {
          console.warn('⚠️ [Comptabilite] Erreur création lignes par défaut:', lignesError);
          // Ne pas bloquer si les lignes ne peuvent pas être créées
        } else {
          console.log(`✅ [Comptabilite] ${lignesParDefaut.length} lignes par défaut créées`);
        }

        // Recalculer les totaux
        await recalculerTotauxFichePaie(nouvelleFiche.id, lignesParDefaut as FichePaieLigne[]);
      }
      
      alert('✅ Fiche de paie créée avec succès !');

      setShowFichePaieModal(false);
      setFichePaieForm({
        collaborateur_id: '',
        periode: new Date().toISOString().slice(0, 7),
        salaire_brut: '',
      });
      await loadFichesPaie();
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erreur génération fiche de paie:', error);
      alert(`Erreur: ${error.message || 'Impossible de générer la fiche de paie'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Créer une écriture comptable manuelle
  const handleCreerEcriture = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    if (!ecritureForm.journal_id || !ecritureForm.compte_debit || !ecritureForm.compte_credit || !ecritureForm.montant) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('ecritures_comptables')
        .insert({
          entreprise_id: selectedEntreprise,
          journal_id: ecritureForm.journal_id,
          numero_piece: ecritureForm.numero_piece || `MAN-${Date.now()}`,
          date_ecriture: ecritureForm.date_ecriture,
          libelle: ecritureForm.libelle,
          compte_debit: ecritureForm.compte_debit,
          compte_credit: ecritureForm.compte_credit,
          montant: parseFloat(ecritureForm.montant),
          type_ecriture: 'manuelle',
          notes: ecritureForm.notes || null,
        });

      if (error) throw error;

      alert('✅ Écriture comptable créée avec succès !');
      setShowEcritureModal(false);
      setEcritureForm({
        journal_id: '',
        numero_piece: '',
        date_ecriture: new Date().toISOString().split('T')[0],
        libelle: '',
        compte_debit: '',
        compte_credit: '',
        montant: '',
        notes: '',
      });
      await loadEcritures();
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erreur création écriture:', error);
      alert(`Erreur: ${error.message || 'Impossible de créer l\'écriture'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Calculer une déclaration fiscale
  const handleCalculerDeclaration = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      setLoading(true);

      // Appeler la fonction RPC pour calculer la déclaration TVA
      const { data, error } = await supabase.rpc('calculer_declaration_tva', {
        p_entreprise_id: selectedEntreprise,
        p_periode: declarationForm.periode,
      });

      if (error) throw error;

      alert('✅ Déclaration calculée avec succès !');
      setShowDeclarationModal(false);
      setDeclarationForm({
        type_declaration: 'tva',
        periode: new Date().toISOString().slice(0, 7),
      });
      await loadDeclarations();
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erreur calcul déclaration:', error);
      alert(`Erreur: ${error.message || 'Impossible de calculer la déclaration'}`);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER : Générer un bilan comptable
  const handleGenererBilan = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      setLoading(true);

      // Calculer les totaux depuis les écritures comptables
      const { data: ecrituresData } = await supabase
        .from('ecritures_comptables')
        .select('compte_debit, compte_credit, montant, date_ecriture')
        .eq('entreprise_id', selectedEntreprise)
        .gte('date_ecriture', `${bilanForm.exercice}-01-01`)
        .lte('date_ecriture', `${bilanForm.exercice}-12-31`);

      if (!ecrituresData) {
        alert('Aucune écriture comptable trouvée pour cet exercice');
        return;
      }

      // Calculer les totaux (simplifié - à améliorer avec le plan comptable)
      const totalDebit = ecrituresData
        .filter(e => e.compte_debit)
        .reduce((sum, e) => sum + Number(e.montant || 0), 0);
      
      const totalCredit = ecrituresData
        .filter(e => e.compte_credit)
        .reduce((sum, e) => sum + Number(e.montant || 0), 0);

      const resultatNet = totalDebit - totalCredit;

      // Créer le bilan
      const { error } = await supabase
        .from('bilans_comptables')
        .insert({
          entreprise_id: selectedEntreprise,
          type_bilan: bilanForm.type_bilan,
          exercice: bilanForm.exercice,
          date_cloture: bilanForm.date_cloture,
          total_actif: totalDebit,
          total_passif: totalCredit,
          resultat_net: resultatNet,
          donnees_bilan: {
            total_debit: totalDebit,
            total_credit: totalCredit,
            nombre_ecritures: ecrituresData.length,
          },
          est_provisoire: true,
          est_valide: false,
        });

      if (error) throw error;

      alert('✅ Bilan comptable généré avec succès !');
      setShowBilanModal(false);
      setBilanForm({
        type_bilan: 'bilan',
        exercice: new Date().getFullYear().toString(),
        date_cloture: new Date().toISOString().split('T')[0],
      });
      await loadBilans();
    } catch (error: any) {
      console.error('❌ Erreur génération bilan:', error);
      alert(`Erreur: ${error.message || 'Impossible de générer le bilan'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedEntreprise) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  if (!selectedEntreprise) {
    return (
      <div className="p-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Aucune entreprise sélectionnée</h2>
          <p className="text-gray-300">Veuillez sélectionner une entreprise pour accéder à la comptabilité.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Comptabilité Automatisée</h1>
          <p className="text-gray-300">Gestion comptable 100% automatisée</p>
        </div>
        
        {!isClient && entreprises.length > 0 && (
          <select
            value={selectedEntreprise}
            onChange={async (e) => {
              const newEntrepriseId = e.target.value;
              setSelectedEntreprise(newEntrepriseId);
              // Recharger toutes les données pour la nouvelle entreprise
              if (newEntrepriseId) {
                setLoading(true);
                try {
                  // Charger les données de base avec le nouvel ID
                  await Promise.all([
                    loadCollaborateurs(newEntrepriseId),
                    loadJournaux(newEntrepriseId),
                  ]);
                  // Utiliser un useEffect pour recharger les données de l'onglet actif
                  // Le useEffect existant se déclenchera automatiquement avec le nouveau selectedEntreprise
                } catch (error) {
                  console.error('❌ Erreur rechargement données:', error);
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {entreprises.map((e) => (
              <option key={e.id} value={e.id} className="bg-gray-800">
                {e.nom}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'ecritures', label: 'Écritures', icon: FileText },
          { id: 'journaux', label: 'Journaux', icon: BookOpen },
          { id: 'fiches-paie', label: 'Fiches de Paie', icon: Receipt },
          { id: 'bilans', label: 'Bilans', icon: TrendingUp },
          { id: 'declarations', label: 'Déclarations', icon: FileCheck },
          { id: 'plan-comptable', label: 'Plan Comptable', icon: Calculator },
          { id: 'parametres', label: 'Paramètres', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        {activeTab === 'dashboard' && (
          <DashboardContent stats={stats} ecritures={ecritures} declarations={declarations} formatCurrency={formatCurrency} formatDate={formatDate} />
        )}
        
        {activeTab === 'ecritures' && (
          <EcrituresContent 
            ecritures={ecritures} 
            journaux={journaux}
            formatCurrency={formatCurrency} 
            formatDate={formatDate}
            onCreerEcriture={() => setShowEcritureModal(true)}
            selectedEntreprise={selectedEntreprise}
          />
        )}
        
        {activeTab === 'fiches-paie' && (
          <FichesPaieContent 
            fichesPaie={fichesPaie} 
            collaborateurs={collaborateurs}
            formatCurrency={formatCurrency} 
            formatDate={formatDate}
            onGenererFichePaie={() => setShowFichePaieModal(true)}
            onVisualiser={(f) => handleVisualiserFichePaie(f)}
            onModifier={(f) => handleModifierFichePaie(f)}
            onSupprimer={(f) => handleSupprimerFichePaie(f)}
            onTelechargerPDF={(f) => handleTelechargerPDFFichePaie(f)}
          />
        )}
        
        {activeTab === 'declarations' && (
          <DeclarationsContent 
            declarations={declarations} 
            formatCurrency={formatCurrency} 
            formatDate={formatDate}
            onCalculerDeclaration={() => setShowDeclarationModal(true)}
          />
        )}
        
        {activeTab === 'bilans' && (
          <BilansContent 
            bilans={bilans} 
            formatCurrency={formatCurrency} 
            formatDate={formatDate}
            onGenererBilan={() => setShowBilanModal(true)}
          />
        )}
        
        {activeTab === 'journaux' && (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Module Journaux Comptables - En développement</p>
          </div>
        )}
        
        {activeTab === 'plan-comptable' && (
          <div className="text-center py-12 text-gray-400">
            <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Module Plan Comptable - En développement</p>
          </div>
        )}
        
        {activeTab === 'parametres' && (
          <div className="text-center py-12 text-gray-400">
            <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Module Paramètres Comptables - En développement</p>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* Modal Générer Fiche de Paie */}
      {showFichePaieModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Générer Fiche de Paie</h2>
              <button
                onClick={() => setShowFichePaieModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Collaborateur *
                </label>
                <select
                  value={fichePaieForm.collaborateur_id}
                  onChange={async (e) => {
                    const collaborateurId = e.target.value;
                    setFichePaieForm({ ...fichePaieForm, collaborateur_id: collaborateurId });
                    
                    // Charger automatiquement le salaire brut et les taux
                    if (collaborateurId && selectedEntreprise) {
                      await loadSalaireBrutEtTaux(collaborateurId);
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-gray-800">Sélectionner un collaborateur</option>
                  {collaborateurs.map((c) => (
                    <option key={c.id} value={c.id} className="bg-gray-800">
                      {c.prenom} {c.nom} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Période (YYYY-MM) *
                </label>
                <input
                  type="month"
                  value={fichePaieForm.periode}
                  onChange={(e) => setFichePaieForm({ ...fichePaieForm, periode: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Salaire Brut (€) - Optionnel (sera récupéré automatiquement si vide)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={fichePaieForm.salaire_brut}
                  onChange={(e) => setFichePaieForm({ ...fichePaieForm, salaire_brut: e.target.value })}
                  placeholder="Ex: 2500.00"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowFichePaieModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenererFichePaie}
                  disabled={loading || !fichePaieForm.collaborateur_id || !fichePaieForm.periode}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Génération...' : 'Générer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvelle Écriture */}
      {showEcritureModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Nouvelle Écriture Comptable</h2>
              <button
                onClick={() => setShowEcritureModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Journal *
                </label>
                <select
                  value={ecritureForm.journal_id}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, journal_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-gray-800">Sélectionner un journal</option>
                  {journaux.map((j) => (
                    <option key={j.id} value={j.id} className="bg-gray-800">
                      {j.code_journal} - {j.libelle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date Écriture *
                </label>
                <input
                  type="date"
                  value={ecritureForm.date_ecriture}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, date_ecriture: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Libellé *
                </label>
                <input
                  type="text"
                  value={ecritureForm.libelle}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, libelle: e.target.value })}
                  placeholder="Description de l'écriture"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Numéro Pièce
                </label>
                <input
                  type="text"
                  value={ecritureForm.numero_piece}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, numero_piece: e.target.value })}
                  placeholder="Auto-généré si vide"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Montant (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ecritureForm.montant}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, montant: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Compte Débit *
                </label>
                <input
                  type="text"
                  value={ecritureForm.compte_debit}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, compte_debit: e.target.value })}
                  placeholder="Ex: 411000"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Compte Crédit *
                </label>
                <input
                  type="text"
                  value={ecritureForm.compte_credit}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, compte_credit: e.target.value })}
                  placeholder="Ex: 706000"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={ecritureForm.notes}
                  onChange={(e) => setEcritureForm({ ...ecritureForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Notes complémentaires..."
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setShowEcritureModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                Annuler
              </button>
              <button
                onClick={handleCreerEcriture}
                disabled={loading || !ecritureForm.journal_id || !ecritureForm.compte_debit || !ecritureForm.compte_credit || !ecritureForm.montant}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Création...' : 'Créer l\'Écriture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Calculer Déclaration */}
      {showDeclarationModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Calculer Déclaration Fiscale</h2>
              <button
                onClick={() => setShowDeclarationModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type de Déclaration *
                </label>
                <select
                  value={declarationForm.type_declaration}
                  onChange={(e) => setDeclarationForm({ ...declarationForm, type_declaration: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="tva" className="bg-gray-800">TVA</option>
                  <option value="urssaf" className="bg-gray-800">URSSAF</option>
                  <option value="cfe" className="bg-gray-800">CFE</option>
                  <option value="is" className="bg-gray-800">Impôt sur les Sociétés</option>
                  <option value="ir" className="bg-gray-800">Impôt sur le Revenu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Période (YYYY-MM) *
                </label>
                <input
                  type="month"
                  value={declarationForm.periode}
                  onChange={(e) => setDeclarationForm({ ...declarationForm, periode: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDeclarationModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCalculerDeclaration}
                  disabled={loading || !declarationForm.periode}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Calcul...' : 'Calculer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Générer Bilan */}
      {showBilanModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Générer Bilan Comptable</h2>
              <button
                onClick={() => setShowBilanModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type de Bilan *
                </label>
                <select
                  value={bilanForm.type_bilan}
                  onChange={(e) => setBilanForm({ ...bilanForm, type_bilan: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bilan" className="bg-gray-800">Bilan</option>
                  <option value="compte_resultat" className="bg-gray-800">Compte de Résultat</option>
                  <option value="tableau_flux_tresorerie" className="bg-gray-800">Tableau de Flux de Trésorerie</option>
                  <option value="annexe" className="bg-gray-800">Annexe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Exercice (Année) *
                </label>
                <input
                  type="number"
                  value={bilanForm.exercice}
                  onChange={(e) => setBilanForm({ ...bilanForm, exercice: e.target.value })}
                  min="2000"
                  max="2100"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date de Clôture *
                </label>
                <input
                  type="date"
                  value={bilanForm.date_cloture}
                  onChange={(e) => setBilanForm({ ...bilanForm, date_cloture: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowBilanModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenererBilan}
                  disabled={loading || !bilanForm.exercice || !bilanForm.date_cloture}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Génération...' : 'Générer le Bilan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualiser Fiche de Paie */}
      {showViewFichePaieModal && currentFichePaie && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Fiche de Paie - {currentFichePaie.numero}</h2>
              <button
                onClick={() => {
                  setShowViewFichePaieModal(false);
                  setCurrentFichePaie(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Collaborateur</p>
                  <p className="text-white font-medium">{currentFichePaie.collaborateur_nom || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Période</p>
                  <p className="text-white font-medium">{currentFichePaie.periode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Date de paiement</p>
                  <p className="text-white font-medium">{formatDate(currentFichePaie.date_paiement)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Numéro</p>
                  <p className="text-white font-medium">{currentFichePaie.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Salaire Brut</p>
                  <p className="text-white font-medium">{formatCurrency(currentFichePaie.salaire_brut || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Net à Payer</p>
                  <p className="text-white font-semibold text-lg text-green-400">{formatCurrency(currentFichePaie.net_a_payer || 0)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowViewFichePaieModal(false);
                      handleModifierFichePaie(currentFichePaie);
                    }}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleTelechargerPDFFichePaie(currentFichePaie)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Télécharger PDF
                  </button>
                  <button
                    onClick={() => {
                      setShowViewFichePaieModal(false);
                      setCurrentFichePaie(null);
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier Fiche de Paie */}
      {showEditFichePaieModal && currentFichePaie && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-6xl w-full max-h-[90vh] border border-white/20 my-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Modifier Fiche de Paie - {currentFichePaie.numero}</h2>
              <button
                onClick={() => {
                  setShowEditFichePaieModal(false);
                  setCurrentFichePaie(null);
                  setFichePaieLignes([]);
                  setEditingLigne(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Collaborateur</p>
                  <p className="text-white font-medium">{currentFichePaie.collaborateur_nom || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Période</p>
                  <p className="text-white font-medium">{currentFichePaie.periode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Salaire Brut</p>
                  <p className="text-white font-semibold">{formatCurrency(currentFichePaie.salaire_brut || 0)}</p>
                </div>
              </div>

              {/* Tableau des lignes de paie */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Éléments de paie</h3>
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value && currentFichePaie.id) {
                          handleAjouterLignePaie(currentFichePaie.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="" className="bg-gray-800">Ajouter une rubrique...</option>
                      {rubriquesPaie.map((r) => (
                        <option key={r.id} value={r.id} className="bg-gray-800">
                          {r.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase border-b border-white/10">Rubrique</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">Base</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">Taux sal.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">Part sal.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">Taux emp.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">Part emp.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase border-b border-white/10">À payer</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase border-b border-white/10">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichePaieLignes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                            Aucune ligne. Ajoutez une rubrique pour commencer.
                          </td>
                        </tr>
                      ) : (
                        fichePaieLignes.map((ligne) => (
                          <tr key={ligne.id || ligne.rubrique_id} className="border-b border-white/5 hover:bg-white/5">
                            {editingLigne?.id === ligne.id ? (
                              <>
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={editingLigne.libelle_affiche || ''}
                                    onChange={(e) => setEditingLigne({ ...editingLigne, libelle_affiche: e.target.value })}
                                    className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingLigne.base || 0}
                                    onChange={(e) => {
                                      const base = parseFloat(e.target.value) || 0;
                                      const tauxSal = editingLigne.taux_salarial || 0;
                                      const tauxPat = editingLigne.taux_patronal || 0;
                                      setEditingLigne({
                                        ...editingLigne,
                                        base,
                                        montant_salarial: (base * tauxSal) / 100,
                                        montant_patronal: (base * tauxPat) / 100,
                                      });
                                    }}
                                    className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingLigne.taux_salarial || 0}
                                    onChange={(e) => {
                                      const tauxSal = parseFloat(e.target.value) || 0;
                                      const base = editingLigne.base || 0;
                                      setEditingLigne({
                                        ...editingLigne,
                                        taux_salarial: tauxSal,
                                        montant_salarial: (base * tauxSal) / 100,
                                      });
                                    }}
                                    className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right text-white text-sm">
                                  {formatCurrency(Math.abs(editingLigne.montant_salarial || 0))}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingLigne.taux_patronal || 0}
                                    onChange={(e) => {
                                      const tauxPat = parseFloat(e.target.value) || 0;
                                      const base = editingLigne.base || 0;
                                      setEditingLigne({
                                        ...editingLigne,
                                        taux_patronal: tauxPat,
                                        montant_patronal: (base * tauxPat) / 100,
                                      });
                                    }}
                                    className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right text-white text-sm">
                                  {formatCurrency(editingLigne.montant_patronal || 0)}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingLigne.montant_a_payer || 0}
                                    onChange={(e) => setEditingLigne({ ...editingLigne, montant_a_payer: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-right"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => {
                                        handleModifierLignePaie(editingLigne);
                                      }}
                                      className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                      title="Sauvegarder"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingLigne(null)}
                                      className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                      title="Annuler"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-white text-sm">{ligne.libelle_affiche || ligne.rubrique?.libelle || 'N/A'}</td>
                                <td className="px-4 py-3 text-right text-white text-sm">{formatCurrency(ligne.base || 0)}</td>
                                <td className="px-4 py-3 text-right text-white text-sm">{(ligne.taux_salarial || 0).toFixed(2)}%</td>
                                <td className="px-4 py-3 text-right text-white text-sm">{formatCurrency(Math.abs(ligne.montant_salarial || 0))}</td>
                                <td className="px-4 py-3 text-right text-white text-sm">{(ligne.taux_patronal || 0).toFixed(2)}%</td>
                                <td className="px-4 py-3 text-right text-white text-sm">{formatCurrency(ligne.montant_patronal || 0)}</td>
                                <td className="px-4 py-3 text-right text-white font-semibold">{formatCurrency(ligne.montant_a_payer || 0)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setEditingLigne({ ...ligne })}
                                      className="p-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30"
                                      title="Modifier"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => ligne.id && handleSupprimerLignePaie(ligne.id)}
                                      className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totaux */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total cotisations salariales</p>
                  <p className="text-white font-semibold text-lg">
                    {formatCurrency(
                      fichePaieLignes
                        .filter(l => l.montant_salarial && l.montant_salarial < 0)
                        .reduce((sum, l) => sum + Math.abs(l.montant_salarial || 0), 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total cotisations patronales</p>
                  <p className="text-white font-semibold text-lg">
                    {formatCurrency(
                      fichePaieLignes
                        .filter(l => l.montant_patronal && l.montant_patronal > 0)
                        .reduce((sum, l) => sum + (l.montant_patronal || 0), 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Net à payer</p>
                  <p className="text-green-400 font-semibold text-xl">
                    {formatCurrency(
                      fichePaieLignes
                        .filter(l => l.montant_a_payer && l.montant_a_payer > 0)
                        .reduce((sum, l) => sum + (l.montant_a_payer || 0), 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Coût total employeur</p>
                  <p className="text-white font-semibold text-lg">
                    {formatCurrency(
                      (currentFichePaie.salaire_brut || 0) +
                      fichePaieLignes
                        .filter(l => l.montant_patronal && l.montant_patronal > 0)
                        .reduce((sum, l) => sum + (l.montant_patronal || 0), 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditFichePaieModal(false);
                    setCurrentFichePaie(null);
                    setFichePaieLignes([]);
                    setEditingLigne(null);
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                  Fermer
                </button>
                <button
                  onClick={() => handleTelechargerPDFFichePaie(currentFichePaie)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Télécharger PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composants pour chaque onglet
function DashboardContent({ stats, ecritures, declarations, formatCurrency, formatDate }: any) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Écritures Total"
          value={stats.totalEcritures}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Écritures Auto"
          value={stats.ecrituresAutomatiques}
          icon={CheckCircle2}
          color="green"
          subtitle={`${stats.ecrituresManuelles} manuelles`}
        />
        <StatCard
          title="Solde Comptable"
          value={formatCurrency(stats.solde || 0)}
          icon={DollarSign}
          color={stats.solde >= 0 ? 'green' : 'red'}
          subtitle={`Débit: ${formatCurrency(stats.totalDebit || 0)} / Crédit: ${formatCurrency(stats.totalCredit || 0)}`}
        />
        <StatCard
          title="Déclarations"
          value={stats.declarationsAfaire}
          icon={AlertCircle}
          color="yellow"
          subtitle={`${stats.declarationsEnRetard} en retard`}
        />
      </div>

      {/* Écritures récentes */}
      <div className="bg-white/5 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Écritures Récentes</h3>
        <div className="space-y-2">
          {ecritures.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aucune écriture récente</p>
          ) : (
            ecritures.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-medium">{e.libelle}</p>
                  <p className="text-sm text-gray-400">
                    {e.journal_code} - {formatDate(e.date_ecriture)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{formatCurrency(e.montant)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    e.type_ecriture === 'automatique' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {e.type_ecriture}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Déclarations à faire */}
      <div className="bg-white/5 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Déclarations à Faire</h3>
        <div className="space-y-2">
          {declarations.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aucune déclaration en attente</p>
          ) : (
            declarations.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-medium">
                    {d.type_declaration.toUpperCase()} - {d.periode}
                  </p>
                  <p className="text-sm text-gray-400">
                    Échéance: {formatDate(d.date_echeance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{formatCurrency(d.montant_due)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    d.statut === 'en_retard' 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {d.statut}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EcrituresContent({ ecritures, journaux, formatCurrency, formatDate, onCreerEcriture, selectedEntreprise }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Écritures Comptables</h2>
        <button 
          onClick={onCreerEcriture}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Écriture
        </button>
      </div>
      
      <div className="space-y-2">
        {ecritures.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucune écriture comptable</p>
        ) : (
          ecritures.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white font-medium">{e.numero_piece}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    e.type_ecriture === 'automatique' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {e.type_ecriture}
                  </span>
                </div>
                <p className="text-gray-300">{e.libelle}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {formatDate(e.date_ecriture)} • {e.journal_code} • Débit: {e.compte_debit} / Crédit: {e.compte_credit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold text-lg">{formatCurrency(e.montant)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FichesPaieContent({ 
  fichesPaie, 
  collaborateurs, 
  formatCurrency, 
  formatDate, 
  onGenererFichePaie,
  onVisualiser,
  onModifier,
  onSupprimer,
  onTelechargerPDF
}: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Fiches de Paie</h2>
        <button 
          onClick={onGenererFichePaie}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Générer Fiche de Paie
        </button>
      </div>
      
      <div className="space-y-2">
        {fichesPaie.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucune fiche de paie</p>
        ) : (
          fichesPaie.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <div className="flex-1">
                <p className="text-white font-medium">{f.collaborateur_nom || 'Collaborateur'}</p>
                <p className="text-sm text-gray-400">Période: {f.periode}</p>
                <p className="text-sm text-gray-400">Date paiement: {formatDate(f.date_paiement)}</p>
                <p className="text-sm text-gray-400">Numéro: {f.numero}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right mr-4">
                  <p className="text-white font-semibold">{formatCurrency(f.net_a_payer)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    f.statut === 'payee' 
                      ? 'bg-green-500/20 text-green-400' 
                      : f.statut === 'validee'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {f.statut}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onVisualiser(f)}
                    className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                    title="Visualiser"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onModifier(f)}
                    className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onTelechargerPDF(f)}
                    className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                    title="Télécharger PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSupprimer(f)}
                    className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeclarationsContent({ declarations, formatCurrency, formatDate, onCalculerDeclaration }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Déclarations Fiscales</h2>
        <button 
          onClick={onCalculerDeclaration}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Calculer Déclaration
        </button>
      </div>
      
      <div className="space-y-2">
        {declarations.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucune déclaration</p>
        ) : (
          declarations.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <div>
                <p className="text-white font-medium">
                  {d.type_declaration.toUpperCase()} - {d.periode}
                </p>
                <p className="text-sm text-gray-400">
                  Échéance: {formatDate(d.date_echeance)}
                  {d.date_depot && ` • Déposé: ${formatDate(d.date_depot)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">{formatCurrency(d.montant_due)}</p>
                <span className={`text-xs px-2 py-1 rounded ${
                  d.statut === 'payee' 
                    ? 'bg-green-500/20 text-green-400' 
                    : d.statut === 'en_retard'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {d.statut}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BilansContent({ bilans, formatCurrency, formatDate, onGenererBilan }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Bilans Comptables</h2>
        <button 
          onClick={onGenererBilan}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Générer Bilan
        </button>
      </div>
      
      <div className="space-y-2">
        {bilans.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucun bilan comptable</p>
        ) : (
          bilans.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
              <div>
                <p className="text-white font-medium">
                  {b.type_bilan.replace('_', ' ').toUpperCase()} - Exercice {b.exercice}
                </p>
                <p className="text-sm text-gray-400">
                  Clôture: {formatDate(b.date_cloture)}
                  {b.est_provisoire && ' • Provisoire'}
                  {b.est_valide && ' • Validé'}
                </p>
              </div>
              <div className="text-right">
                {b.resultat_net !== null && (
                  <p className={`font-semibold ${b.resultat_net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(b.resultat_net)}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: any) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">{title}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

