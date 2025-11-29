import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  Building2,
  X,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Download,
  Upload,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface StockItem {
  id: string;
  entreprise_id: string;
  categorie_id?: string;
  reference: string;
  nom: string;
  description?: string;
  unite_mesure: string;
  quantite_stock: number;
  quantite_minimale: number;
  quantite_maximale?: number;
  prix_achat_unitaire: number;
  prix_vente_unitaire: number;
  emplacement?: string;
  fournisseur?: string;
  date_peremption?: string;
  statut: 'actif' | 'inactif' | 'epuise' | 'rupture';
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  categorie?: {
    id: string;
    nom: string;
    couleur?: string;
  };
}

interface StockCategorie {
  id: string;
  entreprise_id: string;
  nom: string;
  description?: string;
  couleur: string;
  ordre: number;
}

interface StockMouvement {
  id: string;
  entreprise_id: string;
  stock_item_id: string;
  type_mouvement: 'entree' | 'sortie' | 'transfert' | 'inventaire' | 'perte' | 'retour';
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  motif?: string;
  reference_externe?: string;
  facture_id?: string;
  client_id?: string;
  emplacement_source?: string;
  emplacement_destination?: string;
  cout_unitaire?: number;
  cout_total?: number;
  date_mouvement: string;
  created_at: string;
  notes?: string;
  stock_item?: {
    reference: string;
    nom: string;
  };
}

export default function GestionStock() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<StockCategorie[]>([]);
  const [mouvements, setMouvements] = useState<StockMouvement[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategorieForm, setShowCategorieForm] = useState(false);
  const [showMouvementForm, setShowMouvementForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editingCategorie, setEditingCategorie] = useState<StockCategorie | null>(null);
  const [selectedItemForMouvement, setSelectedItemForMouvement] = useState<StockItem | null>(null);
  const [alertes, setAlertes] = useState<StockItem[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'mouvements' | 'alertes' | 'categories'>('items');

  const [itemFormData, setItemFormData] = useState({
    reference: '',
    nom: '',
    description: '',
    categorie_id: '',
    unite_mesure: 'unité',
    quantite_stock: 0,
    quantite_minimale: 0,
    quantite_maximale: '',
    prix_achat_unitaire: 0,
    prix_vente_unitaire: 0,
    emplacement: '',
    fournisseur: '',
    date_peremption: '',
    statut: 'actif' as const,
    tags: [] as string[],
    notes: '',
  });

  const [categorieFormData, setCategorieFormData] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6',
    ordre: 0,
  });

  const [mouvementFormData, setMouvementFormData] = useState({
    type_mouvement: 'entree' as const,
    quantite: 0,
    motif: '',
    reference_externe: '',
    emplacement_source: '',
    emplacement_destination: '',
    cout_unitaire: '',
    date_mouvement: new Date().toISOString().split('T')[0],
    notes: '',
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
  }, [selectedEntreprise]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data: isPlatformAdmin } = await supabase.rpc('is_platform_super_admin');
      
      if (isPlatformAdmin === true) {
        // Super admin : voir toutes les entreprises
        const { data, error } = await supabase
          .from('entreprises')
          .select('id, nom')
          .order('nom');
        
        if (error) throw error;
        setEntreprises(data || []);
      } else {
        // Client : voir uniquement son entreprise
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
        loadItems(),
        loadCategories(),
        loadMouvements(),
        loadAlertes(),
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement données:', error);
      alert('Erreur: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select(`
          *,
          categorie:stock_categories(id, nom, couleur)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('nom');

      if (error) throw error;
      setItems(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement articles:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadCategories = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('stock_categories')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('ordre, nom');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement catégories:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadMouvements = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('stock_mouvements')
        .select(`
          *,
          stock_item:stock_items(reference, nom)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMouvements(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement mouvements:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const loadAlertes = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data: result, error } = await supabase.rpc('get_stock_alertes', {
        p_entreprise_id: selectedEntreprise,
      });

      if (error) throw error;
      
      if (result?.success && result?.data) {
        // Charger les articles complets depuis les IDs
        const itemIds = (result.data as Array<{ id: string }>).map((item) => item.id);
        if (itemIds.length > 0) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('stock_items')
            .select(`
              *,
              categorie:stock_categories(id, nom, couleur)
            `)
            .in('id', itemIds)
            .eq('entreprise_id', selectedEntreprise);

          if (itemsError) throw itemsError;
          setAlertes(itemsData || []);
        } else {
          setAlertes([]);
        }
      } else {
        setAlertes([]);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement alertes:', error);
      // Ne pas bloquer si les alertes ne peuvent pas être chargées
      setAlertes([]);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    if (!itemFormData.reference || !itemFormData.nom) {
      alert('Veuillez remplir la référence et le nom');
      return;
    }

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        reference: itemFormData.reference.trim(),
        nom: itemFormData.nom.trim(),
        description: itemFormData.description || null,
        categorie_id: itemFormData.categorie_id || null,
        unite_mesure: itemFormData.unite_mesure,
        quantite_stock: parseFloat(itemFormData.quantite_stock.toString()) || 0,
        quantite_minimale: parseFloat(itemFormData.quantite_minimale.toString()) || 0,
        quantite_maximale: itemFormData.quantite_maximale ? parseFloat(itemFormData.quantite_maximale.toString()) : null,
        prix_achat_unitaire: parseFloat(itemFormData.prix_achat_unitaire.toString()) || 0,
        prix_vente_unitaire: parseFloat(itemFormData.prix_vente_unitaire.toString()) || 0,
        emplacement: itemFormData.emplacement || null,
        fournisseur: itemFormData.fournisseur || null,
        date_peremption: itemFormData.date_peremption || null,
        statut: itemFormData.statut,
        tags: itemFormData.tags.length > 0 ? itemFormData.tags : null,
        notes: itemFormData.notes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('stock_items')
          .update(dataToSave)
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stock_items')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await loadItems();
      setShowItemForm(false);
      setEditingItem(null);
      resetItemForm();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde article:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleSaveCategorie = async () => {
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    if (!categorieFormData.nom) {
      alert('Veuillez remplir le nom de la catégorie');
      return;
    }

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        nom: categorieFormData.nom.trim(),
        description: categorieFormData.description || null,
        couleur: categorieFormData.couleur,
        ordre: parseInt(categorieFormData.ordre.toString()) || 0,
      };

      if (editingCategorie) {
        const { error } = await supabase
          .from('stock_categories')
          .update(dataToSave)
          .eq('id', editingCategorie.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stock_categories')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await loadCategories();
      setShowCategorieForm(false);
      setEditingCategorie(null);
      resetCategorieForm();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde catégorie:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleSaveMouvement = async () => {
    if (!selectedEntreprise || !selectedItemForMouvement) {
      alert('Veuillez sélectionner un article');
      return;
    }

    if (!mouvementFormData.quantite || mouvementFormData.quantite <= 0) {
      alert('Veuillez saisir une quantité valide');
      return;
    }

    try {
      const { data: result, error } = await supabase.rpc('create_stock_mouvement', {
        p_entreprise_id: selectedEntreprise,
        p_stock_item_id: selectedItemForMouvement.id,
        p_type_mouvement: mouvementFormData.type_mouvement,
        p_quantite: parseFloat(mouvementFormData.quantite.toString()),
        p_motif: mouvementFormData.motif || null,
        p_reference_externe: mouvementFormData.reference_externe || null,
        p_emplacement_source: mouvementFormData.emplacement_source || null,
        p_emplacement_destination: mouvementFormData.emplacement_destination || null,
        p_cout_unitaire: mouvementFormData.cout_unitaire ? parseFloat(mouvementFormData.cout_unitaire.toString()) : null,
        p_date_mouvement: mouvementFormData.date_mouvement,
        p_notes: mouvementFormData.notes || null,
      });

      if (error) throw error;

      if (result?.success) {
        await Promise.all([loadItems(), loadMouvements(), loadAlertes()]);
        setShowMouvementForm(false);
        setSelectedItemForMouvement(null);
        resetMouvementForm();
      } else {
        throw new Error(result?.error || 'Erreur lors de la création du mouvement');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur sauvegarde mouvement:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleDeleteItem = async (item: StockItem) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'article "${item.nom}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      await loadItems();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression article:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const handleDeleteCategorie = async (categorie: StockCategorie) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categorie.nom}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_categories')
        .delete()
        .eq('id', categorie.id);

      if (error) throw error;
      await loadCategories();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur suppression catégorie:', error);
      alert('Erreur: ' + errorMessage);
    }
  };

  const resetItemForm = () => {
    setItemFormData({
      reference: '',
      nom: '',
      description: '',
      categorie_id: '',
      unite_mesure: 'unité',
      quantite_stock: 0,
      quantite_minimale: 0,
      quantite_maximale: '',
      prix_achat_unitaire: 0,
      prix_vente_unitaire: 0,
      emplacement: '',
      fournisseur: '',
      date_peremption: '',
      statut: 'actif',
      tags: [],
      notes: '',
    });
  };

  const resetCategorieForm = () => {
    setCategorieFormData({
      nom: '',
      description: '',
      couleur: '#3B82F6',
      ordre: 0,
    });
  };

  const resetMouvementForm = () => {
    setMouvementFormData({
      type_mouvement: 'entree',
      quantite: 0,
      motif: '',
      reference_externe: '',
      emplacement_source: '',
      emplacement_destination: '',
      cout_unitaire: '',
      date_mouvement: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const openEditItem = (item: StockItem) => {
    setEditingItem(item);
    setItemFormData({
      reference: item.reference,
      nom: item.nom,
      description: item.description || '',
      categorie_id: item.categorie_id || '',
      unite_mesure: item.unite_mesure,
      quantite_stock: item.quantite_stock,
      quantite_minimale: item.quantite_minimale,
      quantite_maximale: item.quantite_maximale?.toString() || '',
      prix_achat_unitaire: item.prix_achat_unitaire,
      prix_vente_unitaire: item.prix_vente_unitaire,
      emplacement: item.emplacement || '',
      fournisseur: item.fournisseur || '',
      date_peremption: item.date_peremption || '',
      statut: item.statut,
      tags: item.tags || [],
      notes: item.notes || '',
    });
    setShowItemForm(true);
  };

  const openEditCategorie = (categorie: StockCategorie) => {
    setEditingCategorie(categorie);
    setCategorieFormData({
      nom: categorie.nom,
      description: categorie.description || '',
      couleur: categorie.couleur,
      ordre: categorie.ordre,
    });
    setShowCategorieForm(true);
  };

  const openMouvementForm = (item: StockItem) => {
    setSelectedItemForMouvement(item);
    resetMouvementForm();
    setShowMouvementForm(true);
  };

  // Filtrage des articles
  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = filterStatut === 'all' || item.statut === filterStatut;
    const matchesCategorie = filterCategorie === 'all' || item.categorie_id === filterCategorie;

    return matchesSearch && matchesStatut && matchesCategorie;
  });

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
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant de gérer le stock</p>
          <button
            onClick={() => window.location.hash = '#entreprises'}
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
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Package className="w-8 h-8" />
              Gestion de Stock
            </h1>
            <p className="text-gray-300">Gérez votre stock, vos articles et vos mouvements</p>
          </div>
          <div className="flex gap-3">
            {entreprises.length > 1 && (
              <select
                value={selectedEntreprise}
                onChange={(e) => setSelectedEntreprise(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                {entreprises.map((e) => (
                  <option key={e.id} value={e.id} className="bg-gray-800">
                    {e.nom}
                  </option>
                ))}
              </select>
            )}
            {activeTab === 'items' && (
              <button
                onClick={() => {
                  resetItemForm();
                  setEditingItem(null);
                  setShowItemForm(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Ajouter un article
              </button>
            )}
            {activeTab === 'categories' && (
              <button
                onClick={() => {
                  resetCategorieForm();
                  setEditingCategorie(null);
                  setShowCategorieForm(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Ajouter une catégorie
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 border-b border-white/20">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'items'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Articles ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('mouvements')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'mouvements'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Mouvements ({mouvements.length})
          </button>
          <button
            onClick={() => setActiveTab('alertes')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'alertes'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Alertes ({alertes.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'categories'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Catégories ({categories.length})
          </button>
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === 'items' && (
        <div>
          {/* Filtres */}
          <div className="mb-6 flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            >
              <option value="all" className="bg-gray-800">Tous les statuts</option>
              <option value="actif" className="bg-gray-800">Actif</option>
              <option value="inactif" className="bg-gray-800">Inactif</option>
              <option value="rupture" className="bg-gray-800">Rupture</option>
              <option value="epuise" className="bg-gray-800">Épuisé</option>
            </select>
            <select
              value={filterCategorie}
              onChange={(e) => setFilterCategorie(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            >
              <option value="all" className="bg-gray-800">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-gray-800">
                  {cat.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Liste des articles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 hover:border-blue-500 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">{item.nom}</h3>
                      {item.statut === 'rupture' && (
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs">
                          Rupture
                        </span>
                      )}
                      {item.statut === 'epuise' && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                          Épuisé
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Réf: {item.reference}</p>
                    {item.categorie && (
                      <span
                        className="inline-block px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: item.categorie.couleur + '20', color: item.categorie.couleur }}
                      >
                        {item.categorie.nom}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openMouvementForm(item)}
                      className="p-2 hover:bg-white/10 rounded transition-all"
                      title="Mouvement"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => openEditItem(item)}
                      className="p-2 hover:bg-white/10 rounded transition-all"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4 text-yellow-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="p-2 hover:bg-white/10 rounded transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stock:</span>
                    <span className={`font-semibold ${
                      item.quantite_stock <= item.quantite_minimale ? 'text-orange-400' : 'text-white'
                    }`}>
                      {item.quantite_stock} {item.unite_mesure}
                    </span>
                  </div>
                  {item.quantite_minimale > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Seuil min:</span>
                      <span className="text-gray-300">{item.quantite_minimale} {item.unite_mesure}</span>
                    </div>
                  )}
                  {item.prix_vente_unitaire > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Prix vente:</span>
                      <span className="text-green-400">{item.prix_vente_unitaire.toFixed(2)} €</span>
                    </div>
                  )}
                  {item.emplacement && (
                    <div className="text-sm text-gray-400">
                      📍 {item.emplacement}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucun article trouvé</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mouvements' && (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="px-6 py-4 text-left text-white font-semibold">Date</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Article</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Type</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Quantité</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Avant</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Après</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Motif</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((mouvement) => (
                <tr key={mouvement.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-6 py-4 text-gray-300">
                    {new Date(mouvement.date_mouvement).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-white">
                    {mouvement.stock_item?.nom || 'N/A'}
                    <div className="text-xs text-gray-400">{mouvement.stock_item?.reference}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      mouvement.type_mouvement === 'entree' || mouvement.type_mouvement === 'retour'
                        ? 'bg-green-500/20 text-green-300'
                        : mouvement.type_mouvement === 'sortie' || mouvement.type_mouvement === 'perte'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {mouvement.type_mouvement === 'entree' && 'Entrée'}
                      {mouvement.type_mouvement === 'sortie' && 'Sortie'}
                      {mouvement.type_mouvement === 'transfert' && 'Transfert'}
                      {mouvement.type_mouvement === 'inventaire' && 'Inventaire'}
                      {mouvement.type_mouvement === 'perte' && 'Perte'}
                      {mouvement.type_mouvement === 'retour' && 'Retour'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white font-semibold">
                    {mouvement.quantite > 0 ? '+' : ''}{mouvement.quantite}
                  </td>
                  <td className="px-6 py-4 text-gray-400">{mouvement.quantite_avant}</td>
                  <td className="px-6 py-4 text-white">{mouvement.quantite_apres}</td>
                  <td className="px-6 py-4 text-gray-300">{mouvement.motif || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mouvements.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">Aucun mouvement enregistré</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alertes' && (
        <div>
          {alertes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alertes.map((item) => (
                <div
                  key={item.id}
                  className="bg-orange-500/10 backdrop-blur-lg rounded-xl border border-orange-500/20 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        <h3 className="text-lg font-semibold text-white">{item.nom}</h3>
                      </div>
                      <p className="text-sm text-gray-400 mb-1">Réf: {item.reference}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stock actuel:</span>
                      <span className="font-semibold text-orange-400">
                        {item.quantite_stock} {item.unite_mesure}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Seuil minimum:</span>
                      <span className="text-gray-300">{item.quantite_minimale} {item.unite_mesure}</span>
                    </div>
                    <button
                      onClick={() => {
                        openMouvementForm(item);
                        setActiveTab('items');
                      }}
                      className="w-full mt-4 px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-all"
                    >
                      Réapprovisionner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-400">Aucune alerte de stock</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((categorie) => (
            <div
              key={categorie.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: categorie.couleur }}
                  />
                  <h3 className="text-lg font-semibold text-white">{categorie.nom}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditCategorie(categorie)}
                    className="p-2 hover:bg-white/10 rounded transition-all"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4 text-yellow-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategorie(categorie)}
                    className="p-2 hover:bg-white/10 rounded transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              {categorie.description && (
                <p className="text-gray-400 text-sm">{categorie.description}</p>
              )}
              <div className="mt-4 text-sm text-gray-400">
                {items.filter((item) => item.categorie_id === categorie.id).length} article(s)
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
              <Tag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucune catégorie créée</p>
            </div>
          )}
        </div>
      )}

      {/* Formulaire Article */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingItem ? 'Modifier l\'article' : 'Nouvel article'}
              </h2>
              <button
                onClick={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="p-2 hover:bg-white/10 rounded transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Référence *
                  </label>
                  <input
                    type="text"
                    value={itemFormData.reference}
                    onChange={(e) => setItemFormData({ ...itemFormData, reference: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={itemFormData.nom}
                    onChange={(e) => setItemFormData({ ...itemFormData, nom: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={itemFormData.categorie_id}
                    onChange={(e) => setItemFormData({ ...itemFormData, categorie_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="" className="bg-gray-800">Aucune catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-gray-800">
                        {cat.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Unité de mesure
                  </label>
                  <select
                    value={itemFormData.unite_mesure}
                    onChange={(e) => setItemFormData({ ...itemFormData, unite_mesure: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="unité" className="bg-gray-800">Unité</option>
                    <option value="kg" className="bg-gray-800">Kilogramme</option>
                    <option value="g" className="bg-gray-800">Gramme</option>
                    <option value="L" className="bg-gray-800">Litre</option>
                    <option value="mL" className="bg-gray-800">Millilitre</option>
                    <option value="m" className="bg-gray-800">Mètre</option>
                    <option value="cm" className="bg-gray-800">Centimètre</option>
                    <option value="m²" className="bg-gray-800">Mètre carré</option>
                    <option value="m³" className="bg-gray-800">Mètre cube</option>
                    <option value="lot" className="bg-gray-800">Lot</option>
                    <option value="paquet" className="bg-gray-800">Paquet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantité en stock
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={itemFormData.quantite_stock}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantite_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Seuil minimum
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={itemFormData.quantite_minimale}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantite_minimale: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Stock maximum
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={itemFormData.quantite_maximale}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantite_maximale: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prix d'achat unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemFormData.prix_achat_unitaire}
                    onChange={(e) => setItemFormData({ ...itemFormData, prix_achat_unitaire: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prix de vente unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemFormData.prix_vente_unitaire}
                    onChange={(e) => setItemFormData({ ...itemFormData, prix_vente_unitaire: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Emplacement
                  </label>
                  <input
                    type="text"
                    value={itemFormData.emplacement}
                    onChange={(e) => setItemFormData({ ...itemFormData, emplacement: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Rayon A, Étagère 3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fournisseur
                  </label>
                  <input
                    type="text"
                    value={itemFormData.fournisseur}
                    onChange={(e) => setItemFormData({ ...itemFormData, fournisseur: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date de péremption
                </label>
                <input
                  type="date"
                  value={itemFormData.date_peremption}
                  onChange={(e) => setItemFormData({ ...itemFormData, date_peremption: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Statut
                </label>
                <select
                  value={itemFormData.statut}
                  onChange={(e) => setItemFormData({ ...itemFormData, statut: e.target.value as 'actif' | 'inactif' | 'epuise' | 'rupture' })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="actif" className="bg-gray-800">Actif</option>
                  <option value="inactif" className="bg-gray-800">Inactif</option>
                  <option value="rupture" className="bg-gray-800">Rupture</option>
                  <option value="epuise" className="bg-gray-800">Épuisé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={itemFormData.notes}
                  onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveItem}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                {editingItem ? 'Modifier' : 'Créer'}
              </button>
              <button
                onClick={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Catégorie */}
      {showCategorieForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingCategorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h2>
              <button
                onClick={() => {
                  setShowCategorieForm(false);
                  setEditingCategorie(null);
                  resetCategorieForm();
                }}
                className="p-2 hover:bg-white/10 rounded transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={categorieFormData.nom}
                  onChange={(e) => setCategorieFormData({ ...categorieFormData, nom: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={categorieFormData.description}
                  onChange={(e) => setCategorieFormData({ ...categorieFormData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Couleur
                  </label>
                  <input
                    type="color"
                    value={categorieFormData.couleur}
                    onChange={(e) => setCategorieFormData({ ...categorieFormData, couleur: e.target.value })}
                    className="w-full h-10 bg-white/10 border border-white/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ordre
                  </label>
                  <input
                    type="number"
                    value={categorieFormData.ordre}
                    onChange={(e) => setCategorieFormData({ ...categorieFormData, ordre: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveCategorie}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                {editingCategorie ? 'Modifier' : 'Créer'}
              </button>
              <button
                onClick={() => {
                  setShowCategorieForm(false);
                  setEditingCategorie(null);
                  resetCategorieForm();
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Mouvement */}
      {showMouvementForm && selectedItemForMouvement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Nouveau mouvement
              </h2>
              <button
                onClick={() => {
                  setShowMouvementForm(false);
                  setSelectedItemForMouvement(null);
                  resetMouvementForm();
                }}
                className="p-2 hover:bg-white/10 rounded transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Article</p>
              <p className="text-white font-semibold">{selectedItemForMouvement.nom}</p>
              <p className="text-xs text-gray-400">Stock actuel: {selectedItemForMouvement.quantite_stock} {selectedItemForMouvement.unite_mesure}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type de mouvement *
                </label>
                <select
                  value={mouvementFormData.type_mouvement}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, type_mouvement: e.target.value as 'entree' | 'sortie' | 'transfert' | 'inventaire' | 'perte' | 'retour' })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="entree" className="bg-gray-800">Entrée</option>
                  <option value="sortie" className="bg-gray-800">Sortie</option>
                  <option value="transfert" className="bg-gray-800">Transfert</option>
                  <option value="inventaire" className="bg-gray-800">Inventaire</option>
                  <option value="perte" className="bg-gray-800">Perte</option>
                  <option value="retour" className="bg-gray-800">Retour</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantité *
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={mouvementFormData.quantite}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, quantite: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Unité: {selectedItemForMouvement.unite_mesure}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date du mouvement
                </label>
                <input
                  type="date"
                  value={mouvementFormData.date_mouvement}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, date_mouvement: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motif
                </label>
                <input
                  type="text"
                  value={mouvementFormData.motif}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, motif: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Réception commande, Vente client..."
                />
              </div>

              {mouvementFormData.type_mouvement === 'transfert' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Emplacement source
                    </label>
                    <input
                      type="text"
                      value={mouvementFormData.emplacement_source}
                      onChange={(e) => setMouvementFormData({ ...mouvementFormData, emplacement_source: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Emplacement destination
                    </label>
                    <input
                      type="text"
                      value={mouvementFormData.emplacement_destination}
                      onChange={(e) => setMouvementFormData({ ...mouvementFormData, emplacement_destination: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Coût unitaire (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={mouvementFormData.cout_unitaire}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, cout_unitaire: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Référence externe
                </label>
                <input
                  type="text"
                  value={mouvementFormData.reference_externe}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, reference_externe: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Facture #123, Commande #456..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={mouvementFormData.notes}
                  onChange={(e) => setMouvementFormData({ ...mouvementFormData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveMouvement}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setShowMouvementForm(false);
                  setSelectedItemForMouvement(null);
                  resetMouvementForm();
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

