import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Edit, Trash2, Search, Building2, X, Receipt, CreditCard, ArrowLeftRight, CheckCircle2, Clock, Download, Minus, AlertTriangle, Send, Mic } from 'lucide-react';
import { VoiceInput } from '../components/VoiceInput';
import { parseVoiceInput } from '../utils/voiceParser';
import { generatePDF } from '../lib/pdfGenerator';

interface Facture {
  id: string;
  numero: string;
  type?: string;
  client_id: string;
  entreprise_id: string;
  date_facturation?: string;
  date_emission?: string;
  date_echeance?: string;
  montant_ht: number;
  montant_tva?: number;
  taux_tva?: number;
  montant_ttc: number;
  statut: string;
  created_at: string;
  client_nom?: string;
  entreprise_nom?: string;
  facture_id?: string; // Pour les avoirs liés
  source?: 'plateforme' | 'client'; // Source de création
}

interface FactureLigne {
  id?: string;
  description: string;
  quantite: number | string; // Permettre string pour éviter que le curseur bouge
  prix_unitaire_ht: number | string;
  taux_tva: number | string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  ordre: number;
}

interface RelanceMRA {
  id?: string;
  facture_id: string;
  numero_relance: string;
  date_relance: string;
  type_relance: 'premiere' | 'deuxieme' | 'mise_en_demeure' | 'injonction_de_payer';
  montant_due: number;
  frais_recouvrement: number;
  statut: string;
  notes?: string;
}

export default function Factures() {
  const { user } = useAuth();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [avoirs, setAvoirs] = useState<Facture[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; nom?: string; entreprise_nom?: string }>>([]);
  const [articles, setArticles] = useState<Array<{ id: string; code: string; libelle: string; prix_unitaire_ht: number; taux_tva: number; unite: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAvoirForm, setShowAvoirForm] = useState(false);
  const [facturePourAvoir, setFacturePourAvoir] = useState<Facture | null>(null);
  const [showMRAForm, setShowMRAForm] = useState(false);
  const [facturePourMRA, setFacturePourMRA] = useState<Facture | null>(null);
  const [relances, setRelances] = useState<RelanceMRA[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArticlesForm, setShowArticlesForm] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleFormData, setArticleFormData] = useState({
    code: '',
    libelle: '',
    prix_unitaire_ht: '',
    taux_tva: '20',
    unite: 'unité',
    notes: '',
  });
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isInteracting, setIsInteracting] = useState(false); // Flag pour empêcher la fermeture pendant les interactions
  const [parsedVoiceData, setParsedVoiceData] = useState<any>(null); // Stocker les données parsées
  const [searchTerm, setSearchTerm] = useState('');
  const aiTimeoutRef = useRef<any>(null); // Pour debouncer les appels IA
  const [filterType, setFilterType] = useState<string>('all'); // 'all', 'facture', 'proforma', 'avoir', 'recues'
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    numero: '',
    type: 'facture' as 'facture' | 'proforma',
    client_id: '',
    entreprise_id: '',
    date_facturation: new Date().toISOString().split('T')[0],
    date_echeance: '',
    montant_ht: 0,
    taux_tva: 20,
    statut: 'brouillon',
    motif: '',
    notes: '',
  });
  const [lignes, setLignes] = useState<FactureLigne[]>([]);

  // Vérifier si l'utilisateur est un client
  useEffect(() => {
    if (!user) {
      setIsClient(false);
      return;
    }

    const checkIfClient = async () => {
      try {
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('actif', true)
          .maybeSingle();

        setIsClient(!!espaceClient);
        // Ne pas changer le filtre par défaut - les clients peuvent voir toutes leurs factures
      } catch (error) {
        console.error('Erreur vérification client:', error);
        setIsClient(false);
      }
    };

    checkIfClient();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEntreprises();
    }
  }, [user]);

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      setSelectedEntreprise(entreprises[0].id);
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
      loadClients(entreprises[0].id);
    }
  }, [entreprises]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadClients(selectedEntreprise);
      loadArticles(selectedEntreprise);
      loadFactures();
      loadAvoirs();
      loadRelances();
    }
  }, [selectedEntreprise]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      // ✅ SIMPLIFIER : Charger toutes les entreprises - les RLS policies filtreront automatiquement
      // Si super_admin PLATEFORME → RLS permet de voir toutes
      // Si utilisateur normal → RLS permet de voir uniquement les siennes
      console.log('🔄 [Factures] Chargement entreprises (RLS filtrera automatiquement)');
      
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom')
        .order('nom');

      if (error) {
        console.error('❌ [Factures] Erreur chargement entreprises:', error);
        throw error;
      }
      
      console.log(`✅ [Factures] Entreprises chargées: ${data?.length || 0}`);
      setEntreprises(data || []);
    } catch (error) {
      console.error('❌ [Factures] Erreur chargement entreprises:', error);
    }
  };

  const loadArticles = async (entrepriseId: string) => {
    try {
      const { data, error } = await supabase
        .from('facture_articles')
        .select('id, code, libelle, prix_unitaire_ht, taux_tva, unite')
        .eq('entreprise_id', entrepriseId)
        .eq('actif', true)
        .order('code');
      
      if (error) {
        // Si la table n'existe pas, initialiser avec un tableau vide
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.warn('⚠️ Table facture_articles n\'existe pas encore, initialisation avec tableau vide');
          setArticles([]);
          return;
        }
        throw error;
      }
      setArticles(data || []);
    } catch (error) {
      console.error('Erreur chargement articles:', error);
      // En cas d'erreur, initialiser avec un tableau vide pour éviter les crashes
      setArticles([]);
    }
  };

  const loadClients = async (entrepriseId: string) => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, nom, prenom, entreprise_nom')
        .eq('entreprise_id', entrepriseId)
        .order('nom');

      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadFactures = async () => {
    if (!selectedEntreprise) return;

    try {
      // Charger toutes les factures de l'entreprise (clients et plateforme)
      const { data, error } = await supabase
        .from('factures')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .in('type', ['facture', 'proforma'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enrichir avec les noms des clients
      const facturesEnrichies = await Promise.all(
        (data || []).map(async (facture) => {
          const { data: client } = await supabase
            .from('clients')
            .select('nom, prenom, entreprise_nom')
            .eq('id', facture.client_id)
            .single();

          return {
            ...facture,
            client_nom: client?.entreprise_nom || `${client?.prenom || ''} ${client?.nom || ''}`.trim() || 'Client',
            type: facture.type || 'facture',
            source: facture.source || 'client', // Par défaut 'client' si non défini
          };
        })
      );

      setFactures(facturesEnrichies);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvoirs = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('avoirs')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enrichir avec les noms des clients
      const avoirsEnrichies = await Promise.all(
        (data || []).map(async (avoir) => {
          const { data: client } = await supabase
            .from('clients')
            .select('nom, prenom, entreprise_nom')
            .eq('id', avoir.client_id)
            .single();

          return {
            ...avoir,
            client_nom: client?.entreprise_nom || `${client?.prenom || ''} ${client?.nom || ''}`.trim() || 'Client',
            type: 'avoir',
            date_facturation: avoir.date_emission,
            montant_tva: avoir.tva || 0,
            taux_tva: avoir.montant_ht ? ((avoir.tva || 0) / avoir.montant_ht) * 100 : 20,
          };
        })
      );

      setAvoirs(avoirsEnrichies);
    } catch (error) {
      console.error('Erreur chargement avoirs:', error);
    }
  };

  const loadRelances = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('relances_mra')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('date_relance', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRelances(data || []);
    } catch (error) {
      console.error('Erreur chargement relances:', error);
    }
  };

  const isFactureEnRetard = (facture: Facture): boolean => {
    if (facture.statut === 'payee' || facture.statut === 'annulee') return false;
    
    if (facture.date_echeance) {
      const dateEcheance = new Date(facture.date_echeance);
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      dateEcheance.setHours(0, 0, 0, 0);
      return dateEcheance < aujourdhui;
    }
    
    // Si pas de date d'échéance mais facture envoyée depuis plus de 30 jours
    if (facture.statut === 'envoyee' || facture.statut === 'en_attente') {
      const dateEmission = new Date(facture.date_facturation || facture.date_emission || facture.created_at);
      const joursEcoules = (new Date().getTime() - dateEmission.getTime()) / (1000 * 60 * 60 * 24);
      return joursEcoules > 30;
    }
    
    return false;
  };

  const getRelancesForFacture = (factureId: string): RelanceMRA[] => {
    return relances.filter(r => r.facture_id === factureId);
  };

  const getNextRelanceType = (factureId: string): 'premiere' | 'deuxieme' | 'mise_en_demeure' | 'injonction_de_payer' => {
    const factureRelances = getRelancesForFacture(factureId);
    
    if (factureRelances.length === 0) return 'premiere';
    if (factureRelances.some(r => r.type_relance === 'premiere' && !factureRelances.some(r2 => r2.type_relance === 'deuxieme'))) {
      return 'deuxieme';
    }
    if (factureRelances.some(r => r.type_relance === 'deuxieme' && !factureRelances.some(r2 => r2.type_relance === 'mise_en_demeure'))) {
      return 'mise_en_demeure';
    }
    return 'injonction_de_payer';
  };

  const generateNumeroRelance = async (type: 'premiere' | 'deuxieme' | 'mise_en_demeure' | 'injonction_de_payer' = 'premiere'): Promise<string> => {
    if (!selectedEntreprise) return 'MRA-001';

    const prefixes: Record<string, string> = {
      'premiere': 'MRA-1',
      'deuxieme': 'MRA-2',
      'mise_en_demeure': 'MRA-MDE',
      'injonction_de_payer': 'MRA-IJP',
    };
    const prefix = prefixes[type] || 'MRA';

    try {
      const { data } = await supabase
        .from('relances_mra')
        .select('numero_relance')
        .eq('entreprise_id', selectedEntreprise)
        .ilike('numero_relance', `${prefix}-%`)
        .order('numero_relance', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastNum = parseInt(data[0].numero_relance?.split('-').pop() || '0');
        return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
      }
      return `${prefix}-001`;
    } catch (error) {
      console.error('Erreur génération numéro relance:', error);
      return `${prefix}-001`;
    }
  };

  const handleCreateMRA = (facture: Facture) => {
    setFacturePourMRA(facture);
    setShowMRAForm(true);
  };

  const handleSubmitMRA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !facturePourMRA) {
      alert('Veuillez sélectionner une facture');
      return;
    }

    try {
      const nextType = getNextRelanceType(facturePourMRA.id);
      const numeroRelance = await generateNumeroRelance(nextType);
      
      // Calculer les jours de retard
      const dateEcheance = facturePourMRA.date_echeance ? new Date(facturePourMRA.date_echeance) : null;
      const aujourdhui = new Date();
      const joursRetard = dateEcheance ? Math.max(0, Math.floor((aujourdhui.getTime() - dateEcheance.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      
      // Frais de recouvrement selon le type de relance (exemple)
      const fraisRecouvrement: Record<string, number> = {
        'premiere': 0,
        'deuxieme': 40,
        'mise_en_demeure': 80,
        'injonction_de_payer': 150,
      };

      const { error } = await supabase.from('relances_mra').insert([{
        facture_id: facturePourMRA.id,
        entreprise_id: selectedEntreprise,
        client_id: facturePourMRA.client_id,
        numero_relance: numeroRelance,
        date_relance: new Date().toISOString().split('T')[0],
        type_relance: nextType,
        montant_due: facturePourMRA.montant_ttc,
        frais_recouvrement: fraisRecouvrement[nextType] || 0,
        statut: 'envoyee',
        notes: `Relance ${nextType} - Jours de retard: ${joursRetard}`,
      }]);

      if (error) throw error;

      await loadRelances();
      setShowMRAForm(false);
      setFacturePourMRA(null);
      alert(`✅ Relance ${nextType} créée avec succès!`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur création relance:', error);
      alert('❌ Erreur lors de la création de la relance: ' + errorMessage);
    }
  };

  const calculateLigneTotals = (ligne: FactureLigne): FactureLigne => {
    const montant_ht = ligne.quantite * ligne.prix_unitaire_ht;
    const montant_tva = montant_ht * (ligne.taux_tva / 100);
    const montant_ttc = montant_ht + montant_tva;
    return {
      ...ligne,
      montant_ht: Number(montant_ht.toFixed(2)),
      montant_tva: Number(montant_tva.toFixed(2)),
      montant_ttc: Number(montant_ttc.toFixed(2)),
    };
  };

  const calculateTotalFromLignes = () => {
    if (lignes.length === 0) {
      return { montant_ht: 0, montant_tva: 0, montant_ttc: 0 };
    }
    // Calculer depuis les valeurs réelles, pas les montants stockés
    let total_ht = 0;
    let total_tva = 0;
    let total_ttc = 0;
    
    lignes.forEach(ligne => {
      // Conversion explicite - gérer string et number
      const quantite = typeof ligne.quantite === 'number' ? ligne.quantite : (ligne.quantite === '' ? 0 : parseFloat(String(ligne.quantite)) || 0);
      const prixUnitaire = typeof ligne.prix_unitaire_ht === 'number' ? ligne.prix_unitaire_ht : (ligne.prix_unitaire_ht === '' ? 0 : parseFloat(String(ligne.prix_unitaire_ht)) || 0);
      const tauxTVA = typeof ligne.taux_tva === 'number' ? ligne.taux_tva : (ligne.taux_tva === '' ? 0 : parseFloat(String(ligne.taux_tva)) || 0);
      
      const montantHT = quantite * prixUnitaire;
      const montantTVA = montantHT * (tauxTVA / 100);
      const montantTTC = montantHT + montantTVA;
      
      total_ht += montantHT;
      total_tva += montantTVA;
      total_ttc += montantTTC;
    });
    
    return {
      montant_ht: Number(total_ht.toFixed(2)),
      montant_tva: Number(total_tva.toFixed(2)),
      montant_ttc: Number(total_ttc.toFixed(2)),
    };
  };

  const generateNumero = async (type: 'facture' | 'proforma' | 'avoir' = 'facture') => {
    if (!selectedEntreprise) return type === 'proforma' ? 'PROFORMA-001' : type === 'avoir' ? 'AVOIR-001' : 'FAC-001';

    const prefix = type === 'proforma' ? 'PROFORMA' : type === 'avoir' ? 'AVOIR' : 'FAC';
    const table = type === 'avoir' ? 'avoirs' : 'factures';

    try {
      // Chercher les numéros avec FAC- ou FACT- (pour compatibilité avec anciennes factures)
      const { data } = await supabase
        .from(table)
        .select('numero')
        .eq('entreprise_id', selectedEntreprise)
        .or(`numero.ilike.${prefix}-%,numero.ilike.FACT-%`)
        .order('numero', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        // Extraire le numéro (gérer FAC-001, FACT-001, FAIT-001)
        const numeroStr = data[0].numero || '';
        const match = numeroStr.match(/-(\d+)$/);
        const lastNum = match ? parseInt(match[1]) : 0;
        return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
      }
      return `${prefix}-001`;
    } catch (error) {
      console.error('Erreur génération numéro:', error);
      return `${prefix}-001`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !formData.client_id) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Vérifier si on a des lignes ou un montant manuel
    if (lignes.length > 0) {
      // Valider que toutes les lignes ont une description
      const lignesInvalides = lignes.filter(l => !l.description || l.description.trim() === '');
      if (lignesInvalides.length > 0) {
        alert('Veuillez remplir la description pour toutes les lignes d\'articles');
        return;
      }
    }

    try {
      // Calculer les totaux à partir des lignes si présentes, sinon utiliser les montants du formulaire
      const totals = lignes.length > 0 
        ? calculateTotalFromLignes()
        : {
            montant_ht: Number(formData.montant_ht) || 0,
            montant_tva: (Number(formData.montant_ht) || 0) * (Number(formData.taux_tva) || 20) / 100,
            montant_ttc: (Number(formData.montant_ht) || 0) * (1 + (Number(formData.taux_tva) || 20) / 100),
          };

      const dataToSave = {
        numero: formData.numero || (await generateNumero(formData.type)),
        type: formData.type,
        client_id: formData.client_id,
        entreprise_id: selectedEntreprise,
        date_emission: formData.date_facturation,
        date_echeance: formData.date_echeance || null,
        montant_ht: totals.montant_ht,
        tva: totals.montant_tva,
        montant_ttc: totals.montant_ttc,
        statut: formData.statut,
        notes: formData.notes || null,
        source: isClient ? 'client' : 'client', // Les factures créées manuellement sont toujours 'client'
        updated_at: new Date().toISOString(),
      };

      let factureId = editingId;

      if (editingId) {
        const { error, data } = await supabase
          .from('factures')
          .update(dataToSave)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;
        factureId = data?.id || editingId;
      } else {
        const { data, error } = await supabase
          .from('factures')
          .insert([dataToSave])
          .select()
          .single();
        
        if (error) throw error;
        factureId = data?.id;
      }

      // Sauvegarder les lignes si présentes
      if (factureId && lignes.length > 0) {
        // Supprimer les anciennes lignes si modification
        if (editingId) {
          const { error: deleteError } = await supabase.from('facture_lignes').delete().eq('facture_id', factureId);
          if (deleteError) {
            console.warn('⚠️ Erreur suppression anciennes lignes (non bloquant):', deleteError);
          }
        }

        // Préparer les lignes à sauvegarder avec les calculs
        const lignesToSave = lignes.map((ligne, index) => {
          const ligneCalculee = calculateLigneTotals(ligne);
          return {
            facture_id: factureId,
            description: ligneCalculee.description,
            quantite: ligneCalculee.quantite,
            prix_unitaire_ht: ligneCalculee.prix_unitaire_ht,
            taux_tva: ligneCalculee.taux_tva,
            montant_ht: ligneCalculee.montant_ht,
            tva: ligneCalculee.montant_tva,
            montant_ttc: ligneCalculee.montant_ttc,
            ordre: index,
          };
        });

        const { error: lignesError } = await supabase
          .from('facture_lignes')
          .insert(lignesToSave);

        if (lignesError) throw lignesError;
      } else if (factureId && lignes.length === 0 && editingId) {
        // Supprimer les lignes si on modifie et qu'il n'y en a plus
        const { error: deleteError } = await supabase.from('facture_lignes').delete().eq('facture_id', factureId);
        if (deleteError) {
          console.warn('⚠️ Erreur suppression lignes (non bloquant):', deleteError);
        }
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      await loadFactures();
      await loadAvoirs();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde facture:', error);
      alert('Erreur lors de la sauvegarde: ' + errorMessage);
    }
  };

  const loadFactureLignes = async (factureId: string) => {
    try {
      const { data, error } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', factureId)
        .order('ordre');

      if (error) throw error;
      return (data || []).map(ligne => ({
        id: ligne.id,
        description: ligne.description,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva || 20,
        montant_ht: ligne.montant_ht,
        montant_tva: ligne.tva || ligne.montant_tva || 0,
        montant_ttc: ligne.montant_ttc,
        ordre: ligne.ordre || 0,
      }));
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
      return [];
    }
  };

  const handleEdit = async (facture: Facture) => {
    setEditingId(facture.id);
    setFormData({
      numero: facture.numero,
      type: (facture.type || 'facture') as 'facture' | 'proforma',
      client_id: facture.client_id,
      entreprise_id: facture.entreprise_id,
      date_facturation: (facture.date_facturation || facture.date_emission || facture.created_at).split('T')[0],
      date_echeance: facture.date_echeance?.split('T')[0] || '',
      montant_ht: facture.montant_ht,
      taux_tva: facture.taux_tva || (facture.montant_tva ? (facture.montant_tva / facture.montant_ht) * 100 : 20),
      statut: facture.statut,
      motif: '',
      notes: (facture as any).notes || '',
    });
    
    // Charger les lignes de la facture
    const factureLignes = await loadFactureLignes(facture.id);
    setLignes(factureLignes);
    
    setShowForm(true);
  };

  const generateAvoirNumero = (factureNumero: string): string => {
    // Convertir FACT-001 -> AVOIR-001, PROFORMA-001 -> AVOIR-001
    const num = factureNumero.split('-')[1];
    return `AVOIR-${num || '001'}`;
  };

  const handleCreateAvoir = (facture: Facture) => {
    setFacturePourAvoir(facture);
    const numeroAvoir = generateAvoirNumero(facture.numero);
    setFormData({
      numero: numeroAvoir,
      type: 'facture' as 'facture' | 'proforma',
      client_id: facture.client_id,
      entreprise_id: facture.entreprise_id,
      date_facturation: new Date().toISOString().split('T')[0],
      date_echeance: '',
      montant_ht: facture.montant_ht,
      taux_tva: facture.taux_tva || 20,
      statut: 'valide',
      motif: '',
      notes: '',
    });
    setShowAvoirForm(true);
  };

  const handleSubmitAvoir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !facturePourAvoir || !formData.client_id) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const montant_ht = Number(formData.montant_ht) || 0;
      const taux_tva = Number(formData.taux_tva) || 20;
      const montant_tva = montant_ht * (taux_tva / 100);
      const montant_ttc = montant_ht + montant_tva;

      // Générer le numéro d'avoir basé sur la facture
      const numeroAvoir = formData.numero || generateAvoirNumero(facturePourAvoir.numero);

      // Créer l'avoir
      const { error: avoirError } = await supabase.from('avoirs').insert([{
        numero: numeroAvoir,
        entreprise_id: selectedEntreprise,
        client_id: facturePourAvoir.client_id,
        facture_id: facturePourAvoir.id,
        date_emission: formData.date_facturation,
        montant_ht,
        tva: montant_tva,
        montant_ttc,
        motif: formData.motif || 'Avoir sur facture',
        statut: 'valide',
      }]);

      if (avoirError) throw avoirError;

      // Supprimer la facture après création de l'avoir
      const { error: deleteError } = await supabase
        .from('factures')
        .delete()
        .eq('id', facturePourAvoir.id);

      if (deleteError) {
        console.warn('Avertissement: L\'avoir a été créé mais la facture n\'a pas pu être supprimée:', deleteError);
      }

      setShowAvoirForm(false);
      setFacturePourAvoir(null);
      resetForm();
      await loadFactures();
      await loadAvoirs();
      alert('✅ Avoir créé avec succès et facture supprimée!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur création avoir:', error);
      alert('❌ Erreur lors de la création de l\'avoir: ' + errorMessage);
    }
  };

  const handleDelete = async (id: string, isAvoir: boolean = false) => {
    const type = isAvoir ? 'avoir' : 'facture';
    if (!confirm(`Supprimer ce ${type} ?`)) return;

    try {
      const table = isAvoir ? 'avoirs' : 'factures';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      if (isAvoir) {
        await loadAvoirs();
      } else {
        await loadFactures();
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleChangeStatut = async (doc: Facture & { docType?: string }, nouveauStatut: string) => {
    try {
      const isAvoir = doc.docType === 'avoir';
      const table = isAvoir ? 'avoirs' : 'factures';
      const updateData = isAvoir ? { statut: nouveauStatut } : { statut: nouveauStatut };

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', doc.id);

      if (error) throw error;

      await loadFactures();
      await loadAvoirs();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur changement statut:', error);
      alert('❌ Erreur lors du changement de statut: ' + errorMessage);
    }
  };


  const handleGeneratePDF = async (doc: Facture & { docType?: string }) => {
    try {
      // Charger les données complètes
      const isAvoir = doc.docType === 'avoir';
      const table = isAvoir ? 'avoirs' : 'factures';
      
      const { data: documentData, error: docError } = await supabase
        .from(table)
        .select('*')
        .eq('id', doc.id)
        .single();

      if (docError || !documentData) throw docError;

      // Charger les données du client
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', doc.client_id)
        .single();

      // Charger les données de l'entreprise
      const { data: entrepriseData } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', doc.entreprise_id)
        .single();

      // Charger les lignes de la facture
      const { data: lignesData } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', doc.id)
        .order('ordre');
      
      interface LigneFacture {
        description: string;
        quantite: number;
        prix_unitaire_ht: number;
        taux_tva?: number;
      }
      const lignesArray = (lignesData || []).map((ligne: LigneFacture) => ({
        description: ligne.description,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva || 20,
        montant_ht: ligne.montant_ht,
        montant_tva: ligne.tva || ligne.montant_tva || 0,
        montant_ttc: ligne.montant_ttc,
        ordre: ligne.ordre || 0,
      }));

      // Générer le PDF
      generatePDF({
        type: (doc.type || (isAvoir ? 'avoir' : 'facture')) as 'facture' | 'proforma' | 'avoir',
        numero: doc.numero,
        date_emission: doc.date_facturation || (doc as any).date_emission || doc.created_at,
        date_echeance: doc.date_echeance,
        client: {
          nom: clientData?.nom,
          prenom: clientData?.prenom,
          entreprise_nom: clientData?.entreprise_nom,
          adresse: clientData?.adresse,
          code_postal: clientData?.code_postal,
          ville: clientData?.ville,
          email: clientData?.email,
        },
        entreprise: {
          nom: entrepriseData?.nom || 'Entreprise',
          adresse: entrepriseData?.adresse,
          code_postal: entrepriseData?.code_postal,
          ville: entrepriseData?.ville,
          siret: entrepriseData?.siret,
          email: entrepriseData?.email,
          telephone: entrepriseData?.telephone,
        },
        montant_ht: doc.montant_ht,
        montant_tva: doc.montant_tva || 0,
        montant_ttc: doc.montant_ttc,
        taux_tva: doc.taux_tva || 20,
        lignes: lignesArray.length > 0 ? lignesArray : undefined,
        motif: isAvoir && 'motif' in documentData ? (documentData as { motif?: string }).motif : undefined,
        notes: documentData.notes,
        statut: doc.statut,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur génération PDF:', error);
      alert('❌ Erreur lors de la génération du PDF: ' + errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      numero: '',
      type: 'facture' as 'facture' | 'proforma',
      client_id: '',
      entreprise_id: selectedEntreprise,
      date_facturation: new Date().toISOString().split('T')[0],
      date_echeance: '',
      montant_ht: 0,
      taux_tva: 20,
      statut: 'brouillon',
      motif: '',
      notes: '',
    });
    setLignes([]);
    setEditingId(null);
  };

  const addLigne = () => {
    const nouvelleLigne: FactureLigne = {
      description: '',
      quantite: '', // Commencer avec string vide
      prix_unitaire_ht: '',
      taux_tva: formData.taux_tva || 20,
      montant_ht: 0,
      montant_tva: 0,
      montant_ttc: 0,
      ordre: lignes.length,
    };
    setLignes([...lignes, nouvelleLigne]);
  };

  const removeLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index).map((ligne, i) => ({ ...ligne, ordre: i })));
  };

  const updateLigne = (index: number, updates: Partial<FactureLigne>) => {
    setLignes(prevLignes => {
      // Créer un nouveau tableau avec map() pour garantir que React détecte le changement
      const newLignes = prevLignes.map((ligne, i) => {
        if (i === index) {
          // Créer un nouvel objet pour cette ligne - garder les valeurs telles quelles
          const updated = { ...ligne, ...updates };
          return updated;
        }
        return ligne;
      });
      return newLignes;
    });
  };

  // Calculer les totaux en temps réel quand les lignes changent
  useEffect(() => {
    if (lignes.length > 0) {
      // Calculer les totaux à partir des valeurs actuelles (pas les montants stockés)
      let totalHT = 0;
      let totalTVA = 0;
      let totalTTC = 0;
      
      lignes.forEach(ligne => {
        // Conversion explicite comme pour l'affichage
        const quantite = parseFloat(String(ligne.quantite || 0)) || 0;
        const prixUnitaire = parseFloat(String(ligne.prix_unitaire_ht || 0)) || 0;
        const tauxTVA = parseFloat(String(ligne.taux_tva || 0)) || 0;
        const montantHT = quantite * prixUnitaire;
        const montantTVA = montantHT * (tauxTVA / 100);
        const montantTTC = montantHT + montantTVA;
        
        totalHT += montantHT;
        totalTVA += montantTVA;
        totalTTC += montantTTC;
      });
      
      setFormData(prev => ({ 
        ...prev, 
        montant_ht: Number(totalHT.toFixed(2)),
        taux_tva: prev.taux_tva || 20
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes]);

  const allDocuments: Array<Facture & { docType: string; date_emission?: string }> = [
    ...factures.map(f => ({ ...f, docType: 'facture' })),
    ...avoirs.map(a => ({ ...a, docType: 'avoir', date_facturation: a.date_facturation || (a as any).date_emission || new Date().toISOString() }))
  ];

  const filteredDocuments = allDocuments.filter((doc) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      doc.numero.toLowerCase().includes(search) ||
      doc.client_nom?.toLowerCase().includes(search) ||
      doc.statut.toLowerCase().includes(search)
    );
    
    let matchesType = false;
    
    if (isClient === true && filterType === 'recues') {
      // Pour les clients : filtre "Factures reçues" = uniquement les factures créées par la plateforme
      matchesType = doc.docType === 'facture' && doc.source === 'plateforme';
    } else {
      // Pour tous les autres filtres (Tous, Factures, Proforma, Avoirs) : filtres normaux
      matchesType = filterType === 'all' || 
        (filterType === 'facture' && doc.docType === 'facture' && doc.type === 'facture') ||
        (filterType === 'proforma' && doc.docType === 'facture' && doc.type === 'proforma') ||
        (filterType === 'avoir' && doc.docType === 'avoir');
    }
    
    return matchesSearch && matchesType;
  });

  const facturesEnRetard = factures.filter(f => isFactureEnRetard(f));

  const calculateMontantTTC = () => {
    const ht = Number(formData.montant_ht) || 0;
    const tva = ht * (Number(formData.taux_tva) / 100);
    return (ht + tva).toFixed(2);
  };

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
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant de créer des factures</p>
          <button
            onClick={() => {
              window.location.hash = '#entreprises';
            }}
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
          <h1 className="text-3xl font-bold text-white mb-2">Facturation</h1>
          <p className="text-gray-300">Gérez vos factures et devis</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArticlesForm(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all border border-white/20"
          >
            <FileText className="w-4 h-4" />
            Articles
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔵 Bouton Facture vocale cliqué');
              resetForm();
              setVoiceTranscript('');
              setParsedVoiceData(null); // Réinitialiser les données parsées
              setShowVoiceInput(true);
              console.log('🔵 showVoiceInput mis à true');
            }}
            className="flex items-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-medium transition-all border border-green-500/30"
            title="Créer une facture vocalement"
          >
            <Mic className="w-4 h-4" />
            Facture vocale
          </button>
          <button
            onClick={async () => {
              resetForm();
              const numero = await generateNumero('facture');
              setFormData((prev) => ({ ...prev, numero, type: 'facture' }));
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvelle facture
          </button>
        </div>
      </div>
      
      {/* Section Factures en retard */}
      {facturesEnRetard.length > 0 && (
        <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-bold text-white">
                Factures en retard ({facturesEnRetard.length})
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-300">
            {facturesEnRetard.length} facture{facturesEnRetard.length > 1 ? 's' : ''} nécessite{facturesEnRetard.length > 1 ? 'nt' : ''} une relance MRA
          </div>
        </div>
      )}

      {/* Filtres par type */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filterType === 'all'
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          Tous
        </button>
        {isClient === true && (
          <button
            onClick={() => setFilterType('recues')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filterType === 'recues'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            Factures reçues
          </button>
        )}
        <button
          onClick={() => setFilterType('facture')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filterType === 'facture'
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          Factures
        </button>
        <button
          onClick={() => setFilterType('proforma')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filterType === 'proforma'
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          Proforma
        </button>
        <button
          onClick={() => setFilterType('avoir')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filterType === 'avoir'
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          Avoirs
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
          placeholder="Rechercher une facture..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Liste des documents */}
      <div className="space-y-4">
        {filteredDocuments.map((doc) => {
          const isAvoir = doc.docType === 'avoir';
          const isProforma = doc.type === 'proforma';
          const Icon = isAvoir ? CreditCard : isProforma ? Receipt : FileText;
          const iconColor = isAvoir ? 'text-orange-400' : isProforma ? 'text-yellow-400' : 'text-purple-400';
          const bgColor = isAvoir ? 'bg-orange-500/20' : isProforma ? 'bg-yellow-500/20' : 'bg-purple-500/20';

          return (
            <div
              key={doc.id}
              className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border ${
                isAvoir ? 'border-orange-500/30' : isProforma ? 'border-yellow-500/30' : 'border-white/20'
              } hover:bg-white/15 transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-3 ${bgColor} rounded-lg`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-bold text-white">{doc.numero}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isAvoir
                            ? 'bg-orange-500/20 text-orange-400'
                            : isProforma
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : doc.statut === 'payee'
                            ? 'bg-green-500/20 text-green-400'
                            : doc.statut === 'envoyee' || doc.statut === 'valide'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {isAvoir ? 'Avoir' : isProforma ? 'Proforma' : doc.statut}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">Client: {doc.client_nom}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Date: {new Date(doc.date_facturation || (doc as any).date_emission || doc.created_at).toLocaleDateString('fr-FR')}</span>
                      {doc.date_echeance && (
                        <span>Échéance: {new Date(doc.date_echeance).toLocaleDateString('fr-FR')}</span>
                      )}
                      {isAvoir && doc.facture_id && (
                        <span className="text-xs text-orange-400">Sur facture: {doc.numero?.replace('AVOIR', 'FAC')}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold mb-1 ${isAvoir ? 'text-orange-400' : 'text-white'}`}>
                      {isAvoir ? '-' : ''}{doc.montant_ttc.toFixed(2)}€
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>TTC</div>
                      <div className="text-xs">HT: {doc.montant_ht.toFixed(2)}€</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-wrap">
                  {/* Boutons changement de statut (uniquement pour factures/proforma) */}
                  {!isAvoir && (
                    <div className="flex items-center gap-1">
                      {doc.statut === 'brouillon' && (
                        <button
                          onClick={() => handleChangeStatut(doc, 'envoyee')}
                          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-xs font-medium"
                          title="Marquer comme envoyé"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {doc.statut === 'envoyee' && (
                        <button
                          onClick={() => handleChangeStatut(doc, 'en_attente')}
                          className="px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all text-xs font-medium"
                          title="Marquer comme en attente"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      {doc.statut === 'en_attente' && (
                        <button
                          onClick={() => handleChangeStatut(doc, 'payee')}
                          className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all text-xs font-medium"
                          title="Marquer comme payé"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Bouton MRA pour factures en retard */}
                      {!isAvoir && isFactureEnRetard(doc as Facture) && (
                        <button
                          onClick={() => handleCreateMRA(doc as Facture)}
                          className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-all text-xs font-medium"
                          title="Créer une relance MRA"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {!isAvoir && (
                    <button
                      onClick={() => handleCreateAvoir(doc as Facture)}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-all"
                      title="Créer un avoir"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  )}
                  {!isAvoir && (
                    <button
                      onClick={() => handleEdit(doc as Facture)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleGeneratePDF(doc)}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                    title="Télécharger PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, isAvoir)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">
            {searchTerm ? 'Aucune facture trouvée' : 'Aucune facture créée'}
          </p>
          {!searchTerm && (
            <button
              onClick={async () => {
                resetForm();
                const numero = await generateNumero('facture');
                setFormData((prev) => ({ ...prev, numero, type: 'facture' }));
                setShowForm(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Créer votre première facture
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
                {editingId ? 'Modifier la facture' : 'Nouvelle facture'}
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
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value as 'facture' | 'proforma';
                      setFormData({ ...formData, type: newType, numero: '' });
                    }}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="facture">Facture</option>
                    <option value="proforma">Proforma</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Numéro *
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.type === 'proforma' ? 'PROFORMA-001' : 'FAC-001'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Statut *
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="envoyee">Envoyée</option>
                  <option value="en_attente">En attente</option>
                  <option value="payee">Payée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client *
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.entreprise_nom || `${client.nom || ''}`.trim() || 'Client'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date de facturation *
                  </label>
                  <input
                    type="date"
                    value={formData.date_facturation}
                    onChange={(e) => setFormData({ ...formData, date_facturation: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date d'échéance
                  </label>
                  <input
                    type="date"
                    value={formData.date_echeance}
                    onChange={(e) => setFormData({ ...formData, date_echeance: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Lignes d'articles */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-300">
                    Lignes d'articles
                  </label>
                  <button
                    type="button"
                    onClick={addLigne}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une ligne
                  </button>
                </div>

                {lignes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Aucune ligne d'article. Cliquez sur "Ajouter une ligne" pour commencer.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lignes.map((ligne, index) => (
                      <div key={`ligne-${index}-${String(ligne.quantite)}-${String(ligne.prix_unitaire_ht)}-${String(ligne.taux_tva)}`} className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 md:col-span-5 relative">
                            <input
                              type="text"
                              value={ligne.description}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateLigne(index, { description: value });
                                
                                // Rechercher un article par code ou libellé
                                if (value && selectedEntreprise) {
                                  const articleTrouve = articles.find(
                                    a => a.code.toUpperCase() === value.toUpperCase().trim() ||
                                         a.code.toUpperCase().startsWith(value.toUpperCase().trim())
                                  );
                                  
                                  if (articleTrouve) {
                                    // Remplir automatiquement les champs
                                    updateLigne(index, {
                                      description: articleTrouve.libelle,
                                      prix_unitaire_ht: articleTrouve.prix_unitaire_ht,
                                      taux_tva: articleTrouve.taux_tva,
                                    });
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                // Si on appuie sur Tab ou Enter après avoir tapé un code, chercher l'article
                                if ((e.key === 'Tab' || e.key === 'Enter') && ligne.description && selectedEntreprise) {
                                  const articleTrouve = articles.find(
                                    a => a.code.toUpperCase() === ligne.description.toUpperCase().trim()
                                  );
                                  
                                  if (articleTrouve) {
                                    e.preventDefault();
                                    updateLigne(index, {
                                      description: articleTrouve.libelle,
                                      prix_unitaire_ht: articleTrouve.prix_unitaire_ht,
                                      taux_tva: articleTrouve.taux_tva,
                                    });
                                  }
                                }
                              }}
                              placeholder="Code (ex: MO1) ou Description"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {ligne.description && articles.some(a => a.code.toUpperCase() === ligne.description.toUpperCase().trim()) && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 z-10">
                                Article trouvé : {articles.find(a => a.code.toUpperCase() === ligne.description.toUpperCase().trim())?.libelle}
                              </div>
                            )}
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              value={ligne.quantite !== undefined && ligne.quantite !== null ? String(ligne.quantite) : ''}
                              onChange={(e) => {
                                // Garder la valeur comme string pendant la saisie pour éviter que le curseur bouge
                                const value = e.target.value;
                                updateLigne(index, { quantite: value === '' ? '' : value });
                              }}
                              onBlur={(e) => {
                                // Convertir en nombre seulement au blur
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                updateLigne(index, { quantite: value });
                              }}
                              placeholder="Qté"
                              min="0"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              value={ligne.prix_unitaire_ht !== undefined && ligne.prix_unitaire_ht !== null ? String(ligne.prix_unitaire_ht) : ''}
                              onChange={(e) => {
                                // Garder la valeur comme string pendant la saisie pour éviter que le curseur bouge
                                const value = e.target.value;
                                updateLigne(index, { prix_unitaire_ht: value === '' ? '' : value });
                              }}
                              onBlur={(e) => {
                                // Convertir en nombre seulement au blur
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                updateLigne(index, { prix_unitaire_ht: value });
                              }}
                              placeholder="P.U. HT"
                              min="0"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-3 md:col-span-2">
                            <input
                              type="number"
                              step="0.1"
                              value={ligne.taux_tva !== undefined && ligne.taux_tva !== null ? String(ligne.taux_tva) : ''}
                              onChange={(e) => {
                                // Garder la valeur comme string pendant la saisie pour éviter que le curseur bouge
                                const value = e.target.value;
                                updateLigne(index, { taux_tva: value === '' ? '' : value });
                              }}
                              onBlur={(e) => {
                                // Convertir en nombre seulement au blur
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                updateLigne(index, { taux_tva: value });
                              }}
                              placeholder="TVA %"
                              min="0"
                              max="100"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1">
                            <button
                              type="button"
                              onClick={() => removeLigne(index)}
                              className="w-full px-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 text-right text-xs text-gray-400 space-x-3">
                          {(() => {
                            // Calcul direct dans le JSX pour garantir le re-render
                            const quantite = typeof ligne.quantite === 'number' ? ligne.quantite : (ligne.quantite === '' ? 0 : parseFloat(String(ligne.quantite)) || 0);
                            const prixUnitaire = typeof ligne.prix_unitaire_ht === 'number' ? ligne.prix_unitaire_ht : (ligne.prix_unitaire_ht === '' ? 0 : parseFloat(String(ligne.prix_unitaire_ht)) || 0);
                            const tauxTVA = typeof ligne.taux_tva === 'number' ? ligne.taux_tva : (ligne.taux_tva === '' ? 0 : parseFloat(String(ligne.taux_tva)) || 0);
                            const montantHT = quantite * prixUnitaire;
                            const montantTVA = montantHT * (tauxTVA / 100);
                            const montantTTC = montantHT + montantTVA;
                            
                            return (
                              <>
                                <span>P.U. HT: {prixUnitaire.toFixed(2)}€</span>
                                <span>|</span>
                                <span>HT: {montantHT.toFixed(2)}€</span>
                                <span>|</span>
                                <span>TVA: {montantTVA.toFixed(2)}€</span>
                                <span>|</span>
                                <span>TTC: {montantTTC.toFixed(2)}€</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totaux - Calcul en temps réel */}
                {lignes.length > 0 && (() => {
                  // Calcul direct dans le JSX pour garantir le re-render
                  let totalHT = 0;
                  let totalTVA = 0;
                  let totalTTC = 0;
                  
                  lignes.forEach((ligne) => {
                    const quantite = typeof ligne.quantite === 'number' ? ligne.quantite : (ligne.quantite === '' ? 0 : parseFloat(String(ligne.quantite)) || 0);
                    const prixUnitaire = typeof ligne.prix_unitaire_ht === 'number' ? ligne.prix_unitaire_ht : (ligne.prix_unitaire_ht === '' ? 0 : parseFloat(String(ligne.prix_unitaire_ht)) || 0);
                    const tauxTVA = typeof ligne.taux_tva === 'number' ? ligne.taux_tva : (ligne.taux_tva === '' ? 0 : parseFloat(String(ligne.taux_tva)) || 0);
                    const montantHT = quantite * prixUnitaire;
                    const montantTVA = montantHT * (tauxTVA / 100);
                    const montantTTC = montantHT + montantTVA;
                    
                    totalHT += montantHT;
                    totalTVA += montantTVA;
                    totalTTC += montantTTC;
                  });
                  
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">Total HT:</span>
                          <span className="text-white font-medium">{totalHT.toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">Total TVA:</span>
                          <span className="text-white font-medium">{totalTVA.toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-white/10">
                          <span className="text-white">Total TTC:</span>
                          <span className="text-white">{totalTTC.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Montants manuels (si pas de lignes) */}
              {lignes.length === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Montant HT (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.montant_ht}
                        onChange={(e) => setFormData({ ...formData, montant_ht: Number(e.target.value) })}
                        required
                        min="0"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1000.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Taux TVA (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.taux_tva}
                        onChange={(e) => setFormData({ ...formData, taux_tva: Number(e.target.value) })}
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="20"
                      />
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between text-lg font-semibold text-white">
                      <span>Montant TTC:</span>
                      <span>{calculateMontantTTC()}€</span>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notes additionnelles pour la facture..."
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

      {/* Formulaire Modal Avoir */}
      {showAvoirForm && facturePourAvoir && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Créer un avoir sur {facturePourAvoir.numero}
              </h2>
              <button
                onClick={() => {
                  setShowAvoirForm(false);
                  setFacturePourAvoir(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitAvoir} className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-300">
                  <strong>Facture:</strong> {facturePourAvoir.numero} - Montant TTC: {facturePourAvoir.montant_ttc.toFixed(2)}€
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Numéro de l'avoir * (généré automatiquement)
                </label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                  readOnly
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-not-allowed"
                  placeholder="AVOIR-001"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Le numéro est automatiquement généré à partir de la facture {facturePourAvoir?.numero}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date d'émission *
                </label>
                <input
                  type="date"
                  value={formData.date_facturation}
                  onChange={(e) => setFormData({ ...formData, date_facturation: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motif de l'avoir
                </label>
                <textarea
                  value={formData.motif}
                  onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="Raison de l'avoir (ex: Retour produit, Erreur de facturation...)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Montant HT (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.montant_ht}
                    onChange={(e) => setFormData({ ...formData, montant_ht: Number(e.target.value) })}
                    required
                    min="0"
                    max={facturePourAvoir.montant_ht}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-400 mt-1">Max: {facturePourAvoir.montant_ht.toFixed(2)}€</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Taux TVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.taux_tva}
                    onChange={(e) => setFormData({ ...formData, taux_tva: Number(e.target.value) })}
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                <div className="flex items-center justify-between text-lg font-semibold text-white">
                  <span>Montant TTC de l'avoir:</span>
                  <span className="text-orange-400">-{calculateMontantTTC()}€</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-red-700 transition-all"
                >
                  Créer l'avoir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAvoirForm(false);
                    setFacturePourAvoir(null);
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

      {/* Formulaire Modal MRA */}
      {showMRAForm && facturePourMRA && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Créer une relance MRA pour {facturePourMRA.numero}
              </h2>
              <button
                onClick={() => {
                  setShowMRAForm(false);
                  setFacturePourMRA(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitMRA} className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-300 mb-2">
                  <strong>Facture:</strong> {facturePourMRA.numero}
                </p>
                <p className="text-sm text-orange-300 mb-2">
                  <strong>Montant dû:</strong> {facturePourMRA.montant_ttc.toFixed(2)}€ TTC
                </p>
                {facturePourMRA.date_echeance && (
                  <p className="text-sm text-orange-300">
                    <strong>Date d'échéance:</strong> {new Date(facturePourMRA.date_echeance).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type de relance *
                </label>
                <select
                  value={getNextRelanceType(facturePourMRA.id)}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-not-allowed"
                >
                  <option value="premiere">1ère relance</option>
                  <option value="deuxieme">2ème relance</option>
                  <option value="mise_en_demeure">Mise en demeure</option>
                  <option value="injonction_de_payer">Injonction de payer</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Le type de relance est déterminé automatiquement selon les relances déjà envoyées
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date de relance *
                </label>
                <input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Montant dû (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={facturePourMRA.montant_ttc.toFixed(2)}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-not-allowed"
                />
              </div>

              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                <div className="flex items-center justify-between text-lg font-semibold text-white">
                  <span>Total à recouvrer:</span>
                  <span className="text-orange-400">{facturePourMRA.montant_ttc.toFixed(2)}€</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-red-700 transition-all"
                >
                  Créer la relance MRA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMRAForm(false);
                    setFacturePourMRA(null);
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

      {/* Modal Gestion Articles */}
      {showArticlesForm && selectedEntreprise && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Gestion des articles</h2>
              <button
                onClick={() => {
                  setShowArticlesForm(false);
                  setEditingArticleId(null);
                  setArticleFormData({
                    code: '',
                    libelle: '',
                    prix_unitaire_ht: '',
                    taux_tva: '20',
                    unite: 'unité',
                    notes: '',
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Formulaire article */}
            <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingArticleId ? 'Modifier l\'article' : 'Nouvel article'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Code *</label>
                  <input
                    type="text"
                    value={articleFormData.code}
                    onChange={(e) => setArticleFormData({ ...articleFormData, code: e.target.value.toUpperCase() })}
                    placeholder="MO1, APP, etc."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Libellé *</label>
                  <input
                    type="text"
                    value={articleFormData.libelle}
                    onChange={(e) => setArticleFormData({ ...articleFormData, libelle: e.target.value })}
                    placeholder="Main d'œuvre, Application, etc."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prix unitaire HT (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={articleFormData.prix_unitaire_ht}
                    onChange={(e) => setArticleFormData({ ...articleFormData, prix_unitaire_ht: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Taux TVA (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={articleFormData.taux_tva}
                    onChange={(e) => setArticleFormData({ ...articleFormData, taux_tva: e.target.value })}
                    placeholder="20"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Unité</label>
                  <input
                    type="text"
                    value={articleFormData.unite}
                    onChange={(e) => setArticleFormData({ ...articleFormData, unite: e.target.value })}
                    placeholder="unité, heure, jour, etc."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <input
                    type="text"
                    value={articleFormData.notes}
                    onChange={(e) => setArticleFormData({ ...articleFormData, notes: e.target.value })}
                    placeholder="Notes optionnelles"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedEntreprise || !articleFormData.code || !articleFormData.libelle) {
                      alert('Veuillez remplir le code et le libellé');
                      return;
                    }
                    try {
                      const dataToInsert = {
                        entreprise_id: selectedEntreprise,
                        code: articleFormData.code.toUpperCase(),
                        libelle: articleFormData.libelle,
                        prix_unitaire_ht: parseFloat(articleFormData.prix_unitaire_ht) || 0,
                        taux_tva: parseFloat(articleFormData.taux_tva) || 20,
                        unite: articleFormData.unite || 'unité',
                        notes: articleFormData.notes || null,
                      };
                      
                      if (editingArticleId) {
                        const { error } = await supabase
                          .from('facture_articles')
                          .update(dataToInsert)
                          .eq('id', editingArticleId);
                        if (error) throw error;
                      } else {
                        const { error } = await supabase
                          .from('facture_articles')
                          .insert(dataToInsert);
                        if (error) throw error;
                      }
                      
                      await loadArticles(selectedEntreprise);
                      setEditingArticleId(null);
                      setArticleFormData({
                        code: '',
                        libelle: '',
                        prix_unitaire_ht: '',
                        taux_tva: '20',
                        unite: 'unité',
                        notes: '',
                      });
                    } catch (error: any) {
                      console.error('Erreur sauvegarde article:', error);
                      alert('Erreur: ' + (error.message || 'Erreur inconnue'));
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                >
                  {editingArticleId ? 'Modifier' : 'Ajouter'}
                </button>
                {editingArticleId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingArticleId(null);
                      setArticleFormData({
                        code: '',
                        libelle: '',
                        prix_unitaire_ht: '',
                        taux_tva: '20',
                        unite: 'unité',
                        notes: '',
                      });
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>

            {/* Liste des articles */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Articles existants</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {articles.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Aucun article créé</p>
                ) : (
                  articles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-blue-400">{article.code}</span>
                          <span className="text-white">-</span>
                          <span className="text-gray-300">{article.libelle}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {article.prix_unitaire_ht.toFixed(2)}€ HT | TVA {article.taux_tva}% | {article.unite}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingArticleId(article.id);
                            setArticleFormData({
                              code: article.code,
                              libelle: article.libelle,
                              prix_unitaire_ht: String(article.prix_unitaire_ht),
                              taux_tva: String(article.taux_tva),
                              unite: article.unite,
                              notes: '',
                            });
                          }}
                          className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-all text-sm"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Supprimer cet article ?')) {
                              try {
                                const { error } = await supabase
                                  .from('facture_articles')
                                  .update({ actif: false })
                                  .eq('id', article.id);
                                if (error) throw error;
                                await loadArticles(selectedEntreprise);
                              } catch (error: any) {
                                console.error('Erreur suppression article:', error);
                                alert('Erreur: ' + (error.message || 'Erreur inconnue'));
                              }
                            }
                          }}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Saisie Vocale */}
      {showVoiceInput && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          // NE PAS fermer le modal en cliquant sur le backdrop
          // Le modal ne se ferme QUE via le bouton X explicite
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => {
            // DEBUG: Log pour voir si le backdrop reçoit un clic
            console.log('🔴 Backdrop cliqué - target:', e.target, 'currentTarget:', e.currentTarget);
            // NE RIEN FAIRE - le modal ne se ferme PAS en cliquant sur le backdrop
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full border border-white/20"
            // Empêcher tous les événements de remonter au backdrop
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Créer une facture vocalement</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔴 Bouton X cliqué - fermeture du modal');
                  setIsInteracting(false); // Réinitialiser avant de fermer
                  setShowVoiceInput(false);
                  setVoiceTranscript('');
                  setParsedVoiceData(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div 
              className="space-y-4"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
                <p className="text-sm text-blue-300 mb-2">
                  💡 <strong>Exemples de commandes :</strong>
                </p>
                <ul className="text-xs text-blue-200 space-y-1 list-disc list-inside">
                  <li>"Facture pour [nom client] montant 750 euros TVA 20%"</li>
                  <li>"Créer facture pour [nom client] 1500€ aujourd'hui"</li>
                  <li>"Facture [nom client] pour développement application 2000 euros"</li>
                  <li>"Article main d'œuvre quantité 10 prix 75 euros"</li>
                </ul>
              </div>

              {/* Mode Test avec champ texte */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                <p className="text-sm text-green-300 mb-2">
                  ✍️ <strong>Mode Test (Tapez votre commande) :</strong>
                </p>
                <textarea
                  value={voiceTranscript}
                  onChange={(e) => {
                    const text = e.target.value;
                    setVoiceTranscript(text);
                  }}
                  placeholder="Tapez votre commande ici... Ex: Facture pour Groupe MCLEM 1000 euros TVA 20%"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (voiceTranscript.trim().length === 0) {
                        alert('Veuillez d\'abord taper votre commande');
                        return;
                      }
                      
                      console.log('🤖 Analyse avec IA...');
                      try {
                        // Utiliser l'Edge Function pour l'IA
                        const { data, error } = await supabase.functions.invoke('parse-invoice-ai', {
                          body: {
                            text: voiceTranscript,
                            clients,
                            articles,
                          },
                        });

                        if (error) {
                          console.error('❌ Erreur IA:', error);
                          // Fallback sur le parsing local
                          const parsed = parseVoiceInput(voiceTranscript, clients, articles);
                          setParsedVoiceData(parsed);
                          console.log('📝 Parsing local (fallback):', parsed);
                          alert('IA non disponible, utilisation du parsing local');
                        } else if (data?.success && data.parsed) {
                          console.log('✅ Données parsées par IA:', data.parsed);
                          setParsedVoiceData(data.parsed);
                          alert('✅ Analyse IA terminée ! Cliquez sur "Continuer avec le formulaire"');
                        }
                      } catch (error) {
                        console.error('❌ Erreur appel IA:', error);
                        // Fallback sur le parsing local
                        const parsed = parseVoiceInput(voiceTranscript, clients, articles);
                        setParsedVoiceData(parsed);
                        console.log('📝 Parsing local (fallback):', parsed);
                        alert('IA non disponible, utilisation du parsing local');
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    🤖 Analyser avec IA (Gratuit)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceTranscript.trim().length > 0) {
                        const parsed = parseVoiceInput(voiceTranscript, clients, articles);
                        setParsedVoiceData(parsed);
                        console.log('📝 Données parsées (local):', parsed);
                        alert('✅ Analyse locale terminée !');
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    📝 Analyser (Local)
                  </button>
                </div>
              </div>

              <div 
                onClick={(e) => {
                  e.stopPropagation();
                }} 
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                }}
              >
                <VoiceInput
                  onStart={() => {
                    // Marquer qu'on interagit quand la reconnaissance démarre
                    console.log('🎤 Démarrage de la reconnaissance vocale');
                    setIsInteracting(true);
                    // NE PAS réinitialiser isInteracting - le garder actif pendant toute la session
                  }}
                  onTranscript={async (text) => {
                  console.log('📝 onTranscript appelé avec:', text);
                  console.log('📝 Longueur du texte:', text.length);
                  
                  // Mettre à jour le transcript
                  setVoiceTranscript(text);
                  
                  // Debouncer les appels à l'IA pour éviter trop d'appels
                  if (aiTimeoutRef.current) {
                    clearTimeout(aiTimeoutRef.current);
                  }
                  
                  // Attendre 1 seconde après le dernier changement avant d'appeler l'IA
                  aiTimeoutRef.current = setTimeout(async () => {
                    // Ne pas appeler l'IA si le texte est trop court
                    if (text.trim().length < 10) {
                      console.log('⏳ Texte trop court, attente...');
                      return;
                    }
                    console.log('🤖 Analyse avec IA (debounced)...');
                    try {
                      const { data, error } = await supabase.functions.invoke('parse-invoice-ai', {
                        body: {
                          text: text,
                          clients: clients,
                          articles: articles,
                        },
                      });

                    if (error) {
                      console.error('❌ Erreur IA:', error);
                      // Fallback sur le parsing local
                      console.log('📝 Fallback sur parsing local...');
                      const parsed = parseVoiceInput(text, clients, articles);
                      setParsedVoiceData(parsed);
                      console.log('📝 Données parsées (local):', parsed);
                    } else if (data?.success && data.parsed) {
                      console.log('✅ Données parsées par IA:', JSON.stringify(data.parsed, null, 2));
                      setParsedVoiceData(data.parsed);
                      
                      // Mettre à jour le formulaire en temps réel avec les données de l'IA
                      const updates: Partial<typeof formData> = {};
                      
                      if (data.parsed.client_id) {
                        updates.client_id = data.parsed.client_id;
                      }
                      
                      if (data.parsed.taux_tva) {
                        updates.taux_tva = data.parsed.taux_tva;
                      }
                      
                      if (data.parsed.date) {
                        updates.date_facturation = data.parsed.date;
                      }
                      
                      if (data.parsed.date_echeance) {
                        updates.date_echeance = data.parsed.date_echeance;
                      }
                      
                      if (data.parsed.notes) {
                        updates.notes = data.parsed.notes;
                      }
                      
                      // Mettre à jour le formulaire
                      if (Object.keys(updates).length > 0) {
                        setFormData(prev => ({ ...prev, ...updates }));
                      }
                      
                      // Gérer les lignes d'articles
                      if (data.parsed.lignes && data.parsed.lignes.length > 0) {
                        const newLignes = data.parsed.lignes.map((ligne: any, index: number) => ({
                          description: ligne.description,
                          quantite: String(ligne.quantite),
                          prix_unitaire_ht: String(ligne.prix),
                          taux_tva: String(ligne.tva || data.parsed.taux_tva || 20),
                          montant_ht: 0,
                          montant_tva: 0,
                          montant_ttc: 0,
                          ordre: index,
                        }));
                        setLignes(newLignes);
                      } else if (data.parsed.description) {
                        setLignes([{
                          description: data.parsed.description,
                          quantite: '1',
                          prix_unitaire_ht: data.parsed.montant ? String(data.parsed.montant) : '',
                          taux_tva: String(data.parsed.taux_tva || 20),
                          montant_ht: 0,
                          montant_tva: 0,
                          montant_ttc: 0,
                          ordre: 0,
                        }]);
                      }
                      
                      // Si on a un montant mais pas de lignes
                      if (data.parsed.montant && (!data.parsed.lignes || data.parsed.lignes.length === 0)) {
                        setFormData(prev => ({ ...prev, montant_ht: data.parsed.montant }));
                      }
                    } else {
                      // Fallback sur le parsing local
                      console.log('📝 Pas de données IA, fallback sur parsing local...');
                      const parsed = parseVoiceInput(text, clients, articles);
                      setParsedVoiceData(parsed);
                      console.log('📝 Données parsées (local):', parsed);
                    }
                    } catch (error) {
                      console.error('❌ Erreur appel IA:', error);
                      // Fallback sur le parsing local
                      console.log('📝 Fallback sur parsing local (erreur)...');
                      const parsed = parseVoiceInput(text, clients, articles);
                      setParsedVoiceData(parsed);
                      console.log('📝 Données parsées (local):', parsed);
                    }
                  }, 1000); // Attendre 1 seconde après le dernier changement
                }}
                onComplete={async () => {
                  // Cette fonction n'est plus appelée automatiquement
                  // Elle est gardée pour compatibilité mais ne fait rien
                  console.log('onComplete appelé (ignoré - utilisez le bouton "Continuer")');
                }}
                />
              </div>

              <div 
                className="flex gap-3 mt-6"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    
                    console.log('🔄 ===== BOUTON CONTINUER CLIQUÉ =====');
                    console.log('📝 voiceTranscript:', voiceTranscript);
                    console.log('📝 Longueur:', voiceTranscript?.length || 0);
                    console.log('📝 clients:', clients.length);
                    console.log('📝 articles:', articles.length);
                    
                    const finalTranscript = voiceTranscript || '';
                    
                    if (!finalTranscript || finalTranscript.trim().length === 0) {
                      console.error('❌ Pas de transcript !');
                      alert('Aucune transcription disponible. Veuillez d\'abord parler votre facture.');
                      return;
                    }
                    
                    console.log('🔄 Re-parsing transcription finale...');
                    const parsed = parseVoiceInput(finalTranscript, clients, articles);
                    setParsedVoiceData(parsed);
                    
                    console.log('📝 Données parsées:', JSON.stringify(parsed, null, 2));
                    console.log('📝 Client:', parsed.client ? 'TROUVÉ' : 'NON TROUVÉ');
                    console.log('📝 Lignes:', parsed.lignes?.length || 0);
                    console.log('📝 Description:', parsed.description || 'AUCUNE');
                    console.log('📝 Montant:', parsed.montant || 'AUCUN');
                    
                    // Générer le numéro de facture
                    console.log('📝 Génération numéro...');
                    const numero = await generateNumero('facture');
                    console.log('📝 Numéro:', numero);
                    
                    // Appliquer les données
                    console.log('📝 Application au formulaire...');
                    setFormData(prev => {
                      const newData = {
                        ...prev,
                        numero,
                        client_id: parsed.client || prev.client_id,
                        taux_tva: parsed.taux_tva || prev.taux_tva || 20,
                        date_facturation: parsed.date || prev.date_facturation || new Date().toISOString().split('T')[0],
                        date_echeance: parsed.date_echeance || prev.date_echeance,
                        notes: parsed.notes || prev.notes,
                        montant_ht: parsed.montant && (!parsed.lignes || parsed.lignes.length === 0) ? parsed.montant : prev.montant_ht,
                      };
                      console.log('📝 formData mis à jour:', newData);
                      return newData;
                    });
                    
                    // Appliquer les lignes
                    if (parsed.lignes && parsed.lignes.length > 0) {
                      console.log('📝 Application de', parsed.lignes.length, 'lignes');
                      const newLignes = parsed.lignes.map((ligne, index) => ({
                        description: ligne.description,
                        quantite: String(ligne.quantite),
                        prix_unitaire_ht: String(ligne.prix),
                        taux_tva: String(ligne.tva || parsed.taux_tva || 20),
                        montant_ht: 0,
                        montant_tva: 0,
                        montant_ttc: 0,
                        ordre: index,
                      }));
                      console.log('📝 Lignes créées:', newLignes);
                      setLignes(newLignes);
                    } else if (parsed.description) {
                      console.log('📝 Création ligne avec description');
                      setLignes([{
                        description: parsed.description,
                        quantite: '1',
                        prix_unitaire_ht: parsed.montant ? String(parsed.montant) : '',
                        taux_tva: String(parsed.taux_tva || 20),
                        montant_ht: 0,
                        montant_tva: 0,
                        montant_ttc: 0,
                        ordre: 0,
                      }]);
                    }
                    
                    console.log('⏳ Attente 200ms...');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    console.log('✅ Ouverture du formulaire');
                    
                    setShowVoiceInput(false);
                    setShowForm(true);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                  }}
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!voiceTranscript || voiceTranscript.trim().length === 0}
                >
                  Continuer avec le formulaire {voiceTranscript && `(${voiceTranscript.length} caractères)`}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setShowVoiceInput(false);
                    setVoiceTranscript('');
                    resetForm();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
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
    </div>
  );
}

