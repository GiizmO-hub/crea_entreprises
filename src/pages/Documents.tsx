import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Edit,
  Trash2,
  Search,
  Building2,
  X,
  Download,
  Upload,
  Folder,
  FolderPlus,
  Tag,
  Calendar,
  Image as ImageIcon,
  File,
  FileSpreadsheet,
  Archive,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Plus,
} from 'lucide-react';

interface Document {
  id: string;
  nom: string;
  description?: string;
  categorie: string;
  type_fichier: string;
  taille?: number;
  chemin_fichier: string;
  tags?: string[];
  date_document: string;
  date_expiration?: string;
  statut: string;
  created_at: string;
  updated_at: string;
  entreprise_id: string;
  created_by?: string;
  folder_id?: string;
  client_id?: string;
  client?: {
    id: string;
    nom?: string;
    prenom?: string;
    entreprise_nom?: string;
  };
}

interface DocumentFolder {
  id: string;
  nom: string;
  description?: string;
  entreprise_id: string;
  client_id?: string;
  parent_id?: string;
  couleur?: string;
  ordre?: number;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    nom?: string;
    prenom?: string;
    entreprise_nom?: string;
  };
}

interface Client {
  id: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
  email?: string;
}

interface DocumentsProps {
  onNavigate: (page: string) => void;
}

const CATEGORIES = [
  { value: 'facture', label: 'Facture', icon: FileText, color: 'purple' },
  { value: 'devis', label: 'Devis', icon: File, color: 'blue' },
  { value: 'contrat', label: 'Contrat', icon: FileText, color: 'green' },
  { value: 'administratif', label: 'Administratif', icon: Folder, color: 'gray' },
  { value: 'juridique', label: 'Juridique', icon: FileText, color: 'red' },
  { value: 'fiscal', label: 'Fiscal', icon: FileSpreadsheet, color: 'yellow' },
  { value: 'rh', label: 'RH', icon: Folder, color: 'orange' },
  { value: 'autre', label: 'Autre', icon: File, color: 'slate' },
];

const TYPES_FICHIER = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'word', label: 'Word', icon: FileText },
  { value: 'autre', label: 'Autre', icon: File },
];

export default function Documents({ onNavigate: _onNavigate }: DocumentsProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    categorie: 'autre',
    date_document: new Date().toISOString().split('T')[0],
    date_expiration: '',
    statut: 'actif',
    tags: [] as string[],
    tagInput: '',
    client_id: '',
    folder_id: '',
  });
  const [folderFormData, setFolderFormData] = useState({
    nom: '',
    description: '',
    client_id: '',
    parent_id: '',
    couleur: '#3B82F6',
  });

  useEffect(() => {
    if (user) {
      loadEntreprises();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadDocuments();
      loadFolders();
      loadClients();
    }
  }, [selectedEntreprise]);

  useEffect(() => {
    if (selectedEntreprise && selectedFolderId !== undefined) {
      loadDocuments();
    }
  }, [selectedFolderId]);

  const loadEntreprises = async () => {
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom')
        .order('nom');

      if (error) throw error;

      setEntreprises(data || []);
      if (data && data.length > 0) {
        setSelectedEntreprise(data[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
      setLoading(false);
    }
  };

  const loadClients = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, prenom, entreprise_nom, email')
        .eq('entreprise_id', selectedEntreprise)
        .order('nom');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadFolders = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select(`
          *,
          client:clients(id, nom, prenom, entreprise_nom)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('ordre, nom');

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
    }
  };

  const loadDocuments = async () => {
    if (!selectedEntreprise) return;

    try {
      let query = supabase
        .from('documents')
        .select(`
          *,
          client:clients(id, nom, prenom, entreprise_nom)
        `)
        .eq('entreprise_id', selectedEntreprise);

      // Filtrer par dossier sélectionné
      if (selectedFolderId) {
        query = query.eq('folder_id', selectedFolderId);
      } else if (selectedFolderId === null) {
        // Si selectedFolderId est explicitement null, afficher seulement les documents sans dossier
        query = query.is('folder_id', null);
      }
      // Si selectedFolderId est undefined, afficher tous les documents

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (['doc', 'docx'].includes(ext)) return 'word';
    return 'autre';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const fileType = getFileType(file.name);
      setFormData((prev) => ({
        ...prev,
        nom: file.name.replace(/\.[^/.]+$/, ''),
        categorie: fileType === 'pdf' ? 'facture' : prev.categorie,
      }));
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `documents/${selectedEntreprise}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erreur upload fichier:', error);
      // En cas d'erreur, on retourne une URL temporaire
      return URL.createObjectURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !formData.nom) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      let fileUrl = formData.nom;
      
      // Si on édite et qu'il y a un nouveau fichier
      if (selectedFile) {
        setUploading(true);
        fileUrl = await uploadFile(selectedFile);
        setUploading(false);
      }

      // Préparer les données du document - TOUTES les colonnes avec valeurs par défaut
      // Note: La table peut avoir des colonnes "url" et "mime_type" en plus de "chemin_fichier"
      const documentData: Record<string, any> = {
        entreprise_id: selectedEntreprise,
        nom: formData.nom,
        description: formData.description && formData.description.trim() ? formData.description.trim() : null,
        categorie: formData.categorie || 'autre',
        type_fichier: 'autre', // Valeur par défaut, sera mise à jour si fichier sélectionné
        taille: 0, // Valeur par défaut, sera mise à jour si fichier sélectionné
        chemin_fichier: '', // Valeur par défaut, sera mise à jour si fichier sélectionné
        url: '', // Colonne existante dans la table, valeur par défaut
        mime_type: null, // Colonne existante dans la table, nullable
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : [],
        date_document: formData.date_document,
        date_expiration: formData.date_expiration && formData.date_expiration.trim() ? formData.date_expiration : null,
        statut: formData.statut || 'actif',
        folder_id: formData.folder_id || selectedFolderId || null,
        client_id: formData.client_id || null,
      };

      // Gestion du fichier
      if (selectedFile && fileUrl) {
        // Fichier sélectionné et uploadé
        documentData.type_fichier = getFileType(selectedFile.name);
        documentData.taille = selectedFile.size;
        documentData.chemin_fichier = fileUrl;
        documentData.url = fileUrl; // Colonne url également requise (NOT NULL)
        documentData.mime_type = selectedFile.type || null; // Type MIME du fichier
      } else if (!editingId) {
        // Nouveau document sans fichier = erreur
        alert('Veuillez sélectionner un fichier');
        return;
      } else {
        // En édition sans nouveau fichier, utiliser les valeurs existantes
        const currentDoc = documents.find(d => d.id === editingId);
        if (currentDoc) {
          // Utiliser les valeurs existantes du document
          documentData.chemin_fichier = currentDoc.chemin_fichier || '';
          documentData.url = (currentDoc as any).url || currentDoc.chemin_fichier || '';
          documentData.type_fichier = currentDoc.type_fichier || 'autre';
          documentData.taille = currentDoc.taille || 0;
          documentData.mime_type = (currentDoc as any).mime_type || null;
        }
        // Sinon, garder les valeurs par défaut définies ci-dessus
      }

      // S'assurer que created_by est défini (seulement pour nouveau document)
      if (!editingId && user?.id) {
        documentData.created_by = user.id;
      }

      // S'assurer que toutes les colonnes obligatoires (NOT NULL) ont des valeurs
      documentData.type_fichier = documentData.type_fichier || 'autre';
      documentData.chemin_fichier = documentData.chemin_fichier || '';
      documentData.url = documentData.url || documentData.chemin_fichier || ''; // url est NOT NULL
      documentData.taille = documentData.taille || 0;

      // S'assurer que toutes les colonnes NOT NULL ont des valeurs
      documentData.nom = documentData.nom || '';
      documentData.entreprise_id = documentData.entreprise_id || selectedEntreprise;
      documentData.categorie = documentData.categorie || 'autre';
      documentData.statut = documentData.statut || 'actif';
      documentData.type_fichier = documentData.type_fichier || 'autre';
      documentData.chemin_fichier = documentData.chemin_fichier || '';
      documentData.url = documentData.url || documentData.chemin_fichier || '';
      documentData.date_document = documentData.date_document || new Date().toISOString().split('T')[0];
      
      if (editingId) {
        const { error } = await supabase
          .from('documents')
          .update(documentData)
          .eq('id', editingId);

        if (error) {
          console.error('Erreur détaillée:', error);
          throw error;
        }
      } else {
        if (!selectedFile) {
          alert('Veuillez sélectionner un fichier');
          return;
        }
        
        // Vérification finale avant insertion
        if (!documentData.url || documentData.url.trim() === '') {
          documentData.url = documentData.chemin_fichier || '';
        }
        
        const { error } = await supabase
          .from('documents')
          .insert([documentData]);

        if (error) {
          console.error('Erreur détaillée:', error);
          console.error('Données envoyées:', JSON.stringify(documentData, null, 2));
          throw error;
        }
      }

      setShowForm(false);
      setShowUploadForm(false);
      setEditingId(null);
      resetForm();
      await loadDocuments();
    } catch (error: any) {
      console.error('Erreur sauvegarde document:', error);
      alert('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
      setUploading(false);
    }
  };

  const handleEdit = (document: Document) => {
    setEditingId(document.id);
    setFormData({
      nom: document.nom,
      description: document.description || '',
      categorie: document.categorie,
      date_document: document.date_document,
      date_expiration: document.date_expiration || '',
      statut: document.statut,
      tags: document.tags || [],
      tagInput: '',
      client_id: document.client_id || '',
      folder_id: document.folder_id || '',
    });
    setSelectedFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      if (doc.chemin_fichier.startsWith('http')) {
        window.open(doc.chemin_fichier, '_blank');
      } else {
        // Si c'est un fichier dans le storage Supabase
        const { data, error } = await supabase.storage
          .from('documents')
          .download(doc.chemin_fichier);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${doc.nom}.${doc.chemin_fichier.split('.').pop()}`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ statut: 'archive' })
        .eq('id', id);

      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      console.error('Erreur archivage:', error);
      alert('Erreur lors de l\'archivage');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ statut: 'actif' })
        .eq('id', id);

      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      console.error('Erreur restauration:', error);
      alert('Erreur lors de la restauration');
    }
  };

  const addTag = () => {
    if (formData.tagInput.trim() && !formData.tags.includes(formData.tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: '',
      }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      description: '',
      categorie: 'autre',
      date_document: new Date().toISOString().split('T')[0],
      date_expiration: '',
      statut: 'actif',
      tags: [],
      tagInput: '',
      client_id: '',
      folder_id: selectedFolderId || '',
    });
    setSelectedFile(null);
    setEditingId(null);
  };

  const handleSubmitFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !folderFormData.nom) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const folderData: Record<string, any> = {
        entreprise_id: selectedEntreprise,
        nom: folderFormData.nom,
        description: folderFormData.description || null,
        client_id: folderFormData.client_id || null,
        parent_id: folderFormData.parent_id || null,
        couleur: folderFormData.couleur || '#3B82F6',
        created_by: user?.id || null,
      };

      if (editingFolderId) {
        const { error } = await supabase
          .from('document_folders')
          .update(folderData)
          .eq('id', editingFolderId);

        if (error) throw error;
      } else {
        // Obtenir le dernier ordre pour le placer à la fin
        const { data: lastFolder } = await supabase
          .from('document_folders')
          .select('ordre')
          .eq('entreprise_id', selectedEntreprise)
          .eq('parent_id', folderFormData.parent_id || null)
          .order('ordre', { ascending: false })
          .limit(1)
          .single();

        folderData.ordre = lastFolder?.ordre ? lastFolder.ordre + 1 : 0;

        const { error } = await supabase
          .from('document_folders')
          .insert([folderData]);

        if (error) throw error;
      }

      setShowFolderForm(false);
      setEditingFolderId(null);
      setFolderFormData({
        nom: '',
        description: '',
        client_id: '',
        parent_id: selectedFolderId || '',
        couleur: '#3B82F6',
      });
      await loadFolders();
    } catch (error: any) {
      console.error('Erreur sauvegarde dossier:', error);
      alert('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleEditFolder = (folder: DocumentFolder) => {
    setEditingFolderId(folder.id);
    setFolderFormData({
      nom: folder.nom,
      description: folder.description || '',
      client_id: folder.client_id || '',
      parent_id: folder.parent_id || '',
      couleur: folder.couleur || '#3B82F6',
    });
    setShowFolderForm(true);
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Supprimer ce dossier et tous ses sous-dossiers ? Les documents ne seront pas supprimés mais seront déplacés sans dossier.')) return;

    try {
      // Mettre à jour les documents pour les retirer du dossier
      await supabase
        .from('documents')
        .update({ folder_id: null })
        .eq('folder_id', id);

      // Supprimer le dossier (les sous-dossiers seront supprimés via CASCADE)
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }

      await loadFolders();
      await loadDocuments();
    } catch (error) {
      console.error('Erreur suppression dossier:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getRootFolders = () => {
    return folders.filter((f) => !f.parent_id);
  };

  // getChildFolders est utilisé dans FolderTreeComponent via children

  const getFolderPath = (folder: DocumentFolder): string => {
    const path: string[] = [];
    let currentFolder: DocumentFolder | undefined = folder;

    while (currentFolder) {
      path.unshift(currentFolder.nom);
      if (currentFolder.parent_id) {
        currentFolder = folders.find((f) => f.id === currentFolder!.parent_id);
      } else {
        break;
      }
    }

    return path.join(' / ');
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = searchTerm === '' || 
      doc.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategorie = filterCategorie === 'all' || doc.categorie === filterCategorie;
    const matchesStatut = filterStatut === 'all' || doc.statut === filterStatut;
    
    return matchesSearch && matchesCategorie && matchesStatut;
  });

  const isExpired = (dateExpiration?: string): boolean => {
    if (!dateExpiration) return false;
    return new Date(dateExpiration) < new Date();
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
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant de gérer des documents</p>
          <button
            onClick={() => _onNavigate('entreprises')}
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
          <h1 className="text-3xl font-bold text-white mb-2">Gestion de Documents</h1>
          <p className="text-gray-300">Gérez tous vos documents d'entreprise</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFolderFormData({
                nom: '',
                description: '',
                client_id: '',
                parent_id: selectedFolderId || '',
                couleur: '#3B82F6',
              });
              setEditingFolderId(null);
              setShowFolderForm(true);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all border border-white/20"
          >
            <FolderPlus className="w-5 h-5" />
            Nouveau dossier
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowUploadForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            <Upload className="w-5 h-5" />
            Ajouter un document
          </button>
        </div>
      </div>

      {/* Sélection Entreprise */}
      {entreprises.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedEntreprise}
            onChange={(e) => setSelectedEntreprise(e.target.value)}
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

      {/* Navigation Dossiers */}
      <div className="mb-6 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Dossiers
          </h2>
          {selectedFolderId && (
            <button
              onClick={() => setSelectedFolderId(null)}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Voir tous les documents
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {/* Tous les documents */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left ${
              selectedFolderId === null
                ? 'bg-blue-500/30 text-white'
                : 'text-gray-300 hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">Tous les documents</span>
          </button>
          
          {/* Liste des dossiers racines */}
          {getRootFolders().map((folder) => (
            <FolderTreeComponent
              key={folder.id}
              folder={folder}
              folders={folders}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelect={(id: string) => setSelectedFolderId(id)}
              onToggle={toggleFolder}
              onEdit={handleEditFolder}
              onDelete={handleDeleteFolder}
              onAddSubfolder={(parentId: string) => {
                setFolderFormData({
                  nom: '',
                  description: '',
                  client_id: '',
                  parent_id: parentId,
                  couleur: '#3B82F6',
                });
                setEditingFolderId(null);
                setShowFolderForm(true);
              }}
              getFolderPath={getFolderPath}
            />
          ))}
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            value={filterCategorie}
            onChange={(e) => setFilterCategorie(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les catégories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="archive">Archivé</option>
            <option value="expire">Expiré</option>
          </select>
        </div>
      </div>

      {/* Liste des documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocuments.map((doc) => {
          const categorie = CATEGORIES.find((c) => c.value === doc.categorie);
          const typeIcon = TYPES_FICHIER.find((t) => t.value === doc.type_fichier);
          const Icon = categorie?.icon || FileText;
          const TypeIcon = typeIcon?.icon || File;
          const expired = isExpired(doc.date_expiration);

          return (
            <div
              key={doc.id}
              className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border hover:bg-white/15 transition-all ${
                doc.statut === 'archive'
                  ? 'border-gray-500/30 opacity-60'
                  : expired
                  ? 'border-red-500/30'
                  : 'border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    categorie?.color === 'purple' ? 'bg-purple-500/20' :
                    categorie?.color === 'blue' ? 'bg-blue-500/20' :
                    categorie?.color === 'green' ? 'bg-green-500/20' :
                    categorie?.color === 'red' ? 'bg-red-500/20' :
                    categorie?.color === 'yellow' ? 'bg-yellow-500/20' :
                    categorie?.color === 'orange' ? 'bg-orange-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      categorie?.color === 'purple' ? 'text-purple-400' :
                      categorie?.color === 'blue' ? 'text-blue-400' :
                      categorie?.color === 'green' ? 'text-green-400' :
                      categorie?.color === 'red' ? 'text-red-400' :
                      categorie?.color === 'yellow' ? 'text-yellow-400' :
                      categorie?.color === 'orange' ? 'text-orange-400' :
                      'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{doc.nom}</h3>
                    <p className="text-xs text-gray-400">{categorie?.label}</p>
                  </div>
                </div>
                {expired && (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
              </div>

              {doc.description && (
                <p className="text-sm text-gray-300 mb-3 line-clamp-2">{doc.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <TypeIcon className="w-4 h-4" />
                  <span>{doc.type_fichier.toUpperCase()}</span>
                </div>
                {doc.taille && (
                  <span>{formatFileSize(doc.taille)}</span>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(doc.date_document).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {doc.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {doc.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                      +{doc.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {doc.date_expiration && (
                <div className={`text-xs mb-3 ${expired ? 'text-red-400' : 'text-yellow-400'}`}>
                  {expired ? '⚠️ Expiré le ' : 'Expire le '}
                  {new Date(doc.date_expiration).toLocaleDateString('fr-FR')}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={() => handleDownload(doc)}
                  className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-sm font-medium"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4 inline mr-1" />
                </button>
                {doc.statut === 'archive' ? (
                  <button
                    onClick={() => handleRestore(doc.id)}
                    className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all text-sm font-medium"
                    title="Restaurer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleArchive(doc.id)}
                    className="px-3 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded-lg transition-all text-sm font-medium"
                    title="Archiver"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(doc)}
                  className="px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all text-sm font-medium"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm font-medium"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucun document trouvé</p>
        </div>
      )}

      {/* Formulaire Modal Upload/Edit */}
      {(showForm || showUploadForm) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Modifier le document' : 'Ajouter un document'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setShowUploadForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fichier *
                  </label>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      required={!editingId}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-300">
                        {selectedFile ? selectedFile.name : 'Cliquez pour sélectionner un fichier'}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom du document"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description du document..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aucun client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nom} {client.prenom} {client.entreprise_nom ? `(${client.entreprise_nom})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dossier
                  </label>
                  <select
                    value={formData.folder_id}
                    onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aucun dossier</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {getFolderPath(folder)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Catégorie *
                  </label>
                  <select
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
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
                    <option value="actif">Actif</option>
                    <option value="archive">Archivé</option>
                    <option value="expire">Expiré</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date du document *
                  </label>
                  <input
                    type="date"
                    value={formData.date_document}
                    onChange={(e) => setFormData({ ...formData, date_document: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date d'expiration
                  </label>
                  <input
                    type="date"
                    value={formData.date_expiration}
                    onChange={(e) => setFormData({ ...formData, date_expiration: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.tagInput}
                    onChange={(e) => setFormData({ ...formData, tagInput: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ajouter un tag (Entrée)"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-blue-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                >
                  {uploading ? 'Upload en cours...' : editingId ? 'Modifier' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowUploadForm(false);
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

      {/* Formulaire Modal Dossier */}
      {showFolderForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingFolderId ? 'Modifier le dossier' : 'Créer un dossier'}
              </h2>
              <button
                onClick={() => {
                  setShowFolderForm(false);
                  setEditingFolderId(null);
                  setFolderFormData({
                    nom: '',
                    description: '',
                    client_id: '',
                    parent_id: '',
                    couleur: '#3B82F6',
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du dossier *
                </label>
                <input
                  type="text"
                  value={folderFormData.nom}
                  onChange={(e) => setFolderFormData({ ...folderFormData, nom: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Salariés, Contrats, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={folderFormData.description}
                  onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description du dossier..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client (optionnel)
                </label>
                <select
                  value={folderFormData.client_id}
                  onChange={(e) => setFolderFormData({ ...folderFormData, client_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun client (dossier général)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nom} {client.prenom} {client.entreprise_nom ? `(${client.entreprise_nom})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dossier parent (pour créer un sous-dossier)
                </label>
                <select
                  value={folderFormData.parent_id}
                  onChange={(e) => setFolderFormData({ ...folderFormData, parent_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Racine (aucun parent)</option>
                  {folders
                    .filter((f) => !f.parent_id || f.id !== editingFolderId)
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {getFolderPath(folder)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Couleur
                </label>
                <input
                  type="color"
                  value={folderFormData.couleur}
                  onChange={(e) => setFolderFormData({ ...folderFormData, couleur: e.target.value })}
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingFolderId ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFolderForm(false);
                    setEditingFolderId(null);
                    setFolderFormData({
                      nom: '',
                      description: '',
                      client_id: '',
                      parent_id: '',
                      couleur: '#3B82F6',
                    });
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
    </div>
  );
}

// Composant récursif pour afficher la hiérarchie des dossiers
function FolderTreeComponent({
  folder,
  folders,
  selectedFolderId,
  expandedFolders,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onAddSubfolder,
  getFolderPath,
  level = 0,
}: {
  folder: DocumentFolder;
  folders: DocumentFolder[];
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (folder: DocumentFolder) => void;
  onDelete: (id: string) => void;
  onAddSubfolder: (parentId: string) => void;
  getFolderPath: (folder: DocumentFolder) => string;
  level?: number;
}) {
  const children = folders.filter((f) => f.parent_id === folder.id);
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all group ${
          isSelected
            ? 'bg-blue-500/30 text-white'
            : 'text-gray-300 hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            className="p-1 hover:bg-white/10 rounded transition-all"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}
        <button
          onClick={() => onSelect(folder.id)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <Folder
            className="w-4 h-4"
            style={{ color: folder.couleur || '#3B82F6' }}
          />
          <span className="text-sm font-medium truncate">{folder.nom}</span>
          {folder.client && (
            <span className="text-xs text-gray-400 truncate">
              ({folder.client.nom || folder.client.entreprise_nom})
            </span>
          )}
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddSubfolder(folder.id);
            }}
            className="p-1 hover:bg-white/10 rounded transition-all"
            title="Ajouter un sous-dossier"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(folder);
            }}
            className="p-1 hover:bg-white/10 rounded transition-all"
            title="Modifier"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder.id);
            }}
            className="p-1 hover:bg-red-500/20 rounded transition-all"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
      {isExpanded &&
        children.map((child) => (
          <FolderTreeComponent
            key={child.id}
            folder={child}
            folders={folders}
            selectedFolderId={selectedFolderId}
            expandedFolders={expandedFolders}
            onSelect={onSelect}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddSubfolder={onAddSubfolder}
            getFolderPath={getFolderPath}
            level={level + 1}
          />
        ))}
    </div>
  );
}

