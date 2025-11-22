import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Shield,
  Folder,
  Edit,
  Trash2,
  X,
  Plus,
  Search,
  Building2,
  Settings,
  UserPlus,
} from 'lucide-react';

interface GestionEquipeProps {
  onNavigate: (page: string) => void;
}

interface Equipe {
  id: string;
  nom: string;
  description?: string;
  entreprise_id: string;
  responsable_id?: string;
  couleur?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  responsable?: {
    id: string;
    nom?: string;
    prenom?: string;
    email: string;
  };
  membres_count?: number;
}

interface Collaborateur {
  id: string;
  user_id: string;
  email: string;
  role: string;
  nom?: string;
  prenom?: string;
  poste?: string;
  statut: string;
}

interface PermissionDossier {
  id: string;
  entreprise_id: string;
  folder_id?: string;
  role: string;
  niveau_acces: string;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_share: boolean;
  folder?: {
    id: string;
    nom: string;
    client_id?: string;
  };
}

const ROLES = [
  { value: 'collaborateur', label: 'Collaborateur', color: 'blue' },
  { value: 'admin', label: 'Admin', color: 'purple' },
  { value: 'manager', label: 'Manager', color: 'green' },
  { value: 'comptable', label: 'Comptable', color: 'yellow' },
  { value: 'commercial', label: 'Commercial', color: 'orange' },
  { value: 'super_admin', label: 'Super Admin', color: 'red' },
];

const NIVEAUX_ACCES = [
  { value: 'aucun', label: 'Aucun accès', icon: X, color: 'red' },
  { value: 'lecture', label: 'Lecture seule', icon: Folder, color: 'blue' },
  { value: 'ecriture', label: 'Lecture et écriture', icon: Edit, color: 'green' },
  { value: 'administration', label: 'Administration complète', icon: Settings, color: 'purple' },
];

export default function GestionEquipe({ onNavigate: _onNavigate }: GestionEquipeProps) {
  const { user } = useAuth();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [dossiers, setDossiers] = useState<Array<{ id: string; nom: string; client_id?: string }>>([]);
  const [permissions, setPermissions] = useState<PermissionDossier[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [showEquipeForm, setShowEquipeForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [showMembreForm, setShowMembreForm] = useState(false);
  const [showAjoutMembresForm, setShowAjoutMembresForm] = useState(false);
  const [equipePourAjoutMembres, setEquipePourAjoutMembres] = useState<string | null>(null);
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState<string[]>([]);
  const [editingEquipeId, setEditingEquipeId] = useState<string | null>(null);
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'equipes' | 'permissions'>('equipes');
  const [searchTerm, setSearchTerm] = useState('');
  const [creatingMembre, setCreatingMembre] = useState(false);
  const [ajoutMembresLoading, setAjoutMembresLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    responsable_id: '',
    couleur: '#3B82F6',
    actif: true,
  });
  const [permissionFormData, setPermissionFormData] = useState({
    folder_id: '',
    role: 'collaborateur',
    niveau_acces: 'lecture',
    can_create: false,
    can_update: false,
    can_delete: false,
    can_share: false,
  });
  const [membreFormData, setMembreFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'collaborateur' as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial',
    entreprise_id: '',
    departement: '',
    poste: '',
    selectedDossiers: [] as string[], // IDs des dossiers sélectionnés
    permissionsParDossier: {} as Record<string, { niveau_acces: string; can_create: boolean; can_update: boolean; can_delete: boolean; can_share: boolean }>,
  });

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    if (isSuperAdmin && user) {
      loadEntreprises();
    }
  }, [isSuperAdmin, user]);

  useEffect(() => {
    if (selectedEntreprise) {
      loadEquipes();
      loadCollaborateurs();
      loadDossiers();
      loadPermissions();
    }
  }, [selectedEntreprise]);

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
        setIsSuperAdmin(utilisateur.role === 'super_admin');
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      setIsSuperAdmin(role === 'super_admin');
    } catch (error) {
      console.error('Erreur vérification super admin:', error);
      setIsSuperAdmin(false);
    }
  };

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

  const loadEquipes = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('equipes')
        .select(`
          *,
          responsable:collaborateurs(id, nom, prenom, email)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('nom');

      if (error) throw error;

      // Compter les membres pour chaque équipe
      const equipesWithCounts = await Promise.all(
        (data || []).map(async (equipe) => {
          const { count } = await supabase
            .from('collaborateurs_equipes')
            .select('*', { count: 'exact', head: true })
            .eq('equipe_id', equipe.id)
            .is('date_sortie', null);

          return {
            ...equipe,
            membres_count: count || 0,
          };
        })
      );

      setEquipes(equipesWithCounts);
    } catch (error) {
      console.error('Erreur chargement équipes:', error);
    }
  };

  const loadCollaborateurs = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('collaborateurs')
        .select('id, user_id, email, role, nom, prenom, poste, statut')
        .eq('statut', 'active')
        .order('nom');

      if (error) throw error;
      setCollaborateurs(data || []);
    } catch (error) {
      console.error('Erreur chargement collaborateurs:', error);
    }
  };

  const loadDossiers = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('id, nom, client_id')
        .eq('entreprise_id', selectedEntreprise)
        .order('nom');

      if (error) throw error;
      setDossiers(data || []);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
    }
  };

  const loadPermissions = async () => {
    if (!selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('permissions_dossiers')
        .select(`
          *,
          folder:document_folders(id, nom, client_id)
        `)
        .eq('entreprise_id', selectedEntreprise)
        .order('role, folder_id');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
    }
  };

  const handleSubmitEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !formData.nom) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const equipeData: Record<string, any> = {
        entreprise_id: selectedEntreprise,
        nom: formData.nom,
        description: formData.description || null,
        responsable_id: formData.responsable_id || null,
        couleur: formData.couleur || '#3B82F6',
        actif: formData.actif,
        created_by: user?.id || null,
      };

      if (editingEquipeId) {
        const { error } = await supabase
          .from('equipes')
          .update(equipeData)
          .eq('id', editingEquipeId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('equipes')
          .insert([equipeData]);

        if (error) throw error;
      }

      setShowEquipeForm(false);
      setEditingEquipeId(null);
      setFormData({
        nom: '',
        description: '',
        responsable_id: '',
        couleur: '#3B82F6',
        actif: true,
      });
      await loadEquipes();
    } catch (error: any) {
      console.error('Erreur sauvegarde équipe:', error);
      alert('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleSubmitPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      const permissionData: Record<string, any> = {
        entreprise_id: selectedEntreprise,
        folder_id: permissionFormData.folder_id || null,
        role: permissionFormData.role,
        niveau_acces: permissionFormData.niveau_acces,
        can_create: permissionFormData.can_create,
        can_update: permissionFormData.can_update,
        can_delete: permissionFormData.can_delete,
        can_share: permissionFormData.can_share,
        created_by: user?.id || null,
      };

      if (editingPermissionId) {
        const { error } = await supabase
          .from('permissions_dossiers')
          .update(permissionData)
          .eq('id', editingPermissionId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('permissions_dossiers')
          .insert([permissionData]);

        if (error) throw error;
      }

      setShowPermissionForm(false);
      setEditingPermissionId(null);
      setPermissionFormData({
        folder_id: '',
        role: 'collaborateur',
        niveau_acces: 'lecture',
        can_create: false,
        can_update: false,
        can_delete: false,
        can_share: false,
      });
      await loadPermissions();
    } catch (error: any) {
      console.error('Erreur sauvegarde permission:', error);
      alert('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleEditEquipe = (equipe: Equipe) => {
    setEditingEquipeId(equipe.id);
    setFormData({
      nom: equipe.nom,
      description: equipe.description || '',
      responsable_id: equipe.responsable_id || '',
      couleur: equipe.couleur || '#3B82F6',
      actif: equipe.actif,
    });
    setShowEquipeForm(true);
  };

  const handleEditPermission = (permission: PermissionDossier) => {
    setEditingPermissionId(permission.id);
    setPermissionFormData({
      folder_id: permission.folder_id || '',
      role: permission.role,
      niveau_acces: permission.niveau_acces,
      can_create: permission.can_create,
      can_update: permission.can_update,
      can_delete: permission.can_delete,
      can_share: permission.can_share,
    });
    setShowPermissionForm(true);
  };

  const handleDeleteEquipe = async (id: string) => {
    if (!confirm('Supprimer cette équipe ? Les membres seront retirés mais pas supprimés.')) return;

    try {
      // Retirer tous les membres de l'équipe
      await supabase
        .from('collaborateurs_equipes')
        .update({ date_sortie: new Date().toISOString().split('T')[0] })
        .eq('equipe_id', id)
        .is('date_sortie', null);

      // Supprimer l'équipe
      const { error } = await supabase
        .from('equipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadEquipes();
    } catch (error) {
      console.error('Erreur suppression équipe:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleDeletePermission = async (id: string) => {
    if (!confirm('Supprimer cette permission ?')) return;

    try {
      const { error } = await supabase
        .from('permissions_dossiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPermissions();
    } catch (error) {
      console.error('Erreur suppression permission:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleSubmitMembre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membreFormData.email || !membreFormData.password || !membreFormData.nom || !membreFormData.prenom) {
      alert('Veuillez remplir tous les champs obligatoires (email, mot de passe, nom, prénom)');
      return;
    }

    if (!membreFormData.entreprise_id) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    setCreatingMembre(true);

    try {
      // 1. Créer le collaborateur via la fonction RPC
      const { data: createResult, error: createError } = await supabase.rpc('create_collaborateur', {
        p_email: membreFormData.email,
        p_password: membreFormData.password,
        p_nom: membreFormData.nom,
        p_prenom: membreFormData.prenom,
        p_telephone: membreFormData.telephone || null,
        p_role: membreFormData.role,
        p_entreprise_id: membreFormData.entreprise_id,
        p_departement: membreFormData.departement || null,
        p_poste: membreFormData.poste || null,
        p_date_embauche: null,
        p_salaire: null,
      });

      if (createError) throw createError;

      if (createResult && !createResult.success) {
        throw new Error(createResult.error || 'Erreur lors de la création du collaborateur');
      }

      const collaborateurId = createResult?.collaborateur_id;

      // 2. Créer les permissions pour chaque dossier sélectionné
      if (membreFormData.selectedDossiers.length > 0 && collaborateurId) {
        // Utiliser le rôle du collaborateur créé
        const roleDuCollaborateur = membreFormData.role;

        // Créer les permissions pour chaque dossier
        const permissionsToCreate = membreFormData.selectedDossiers.map((folderId) => {
          const perms = membreFormData.permissionsParDossier[folderId] || {
            niveau_acces: 'lecture',
            can_create: false,
            can_update: false,
            can_delete: false,
            can_share: false,
          };

          return {
            entreprise_id: membreFormData.entreprise_id,
            folder_id: folderId,
            role: roleDuCollaborateur,
            niveau_acces: perms.niveau_acces,
            can_create: perms.can_create,
            can_update: perms.can_update,
            can_delete: perms.can_delete,
            can_share: perms.can_share,
            created_by: user?.id || null,
          };
        });

        // Insérer toutes les permissions en une seule fois
        const { error: permError } = await supabase
          .from('permissions_dossiers')
          .insert(permissionsToCreate);

        if (permError) {
          console.error('Erreur création permissions:', permError);
          // Ne pas bloquer si les permissions échouent, on a quand même créé le collaborateur
          alert('⚠️ Collaborateur créé mais erreur lors de la création des permissions. Vous pouvez les ajouter manuellement.');
        }
      }

      alert('✅ Membre créé avec succès !');
      setShowMembreForm(false);
      setMembreFormData({
        email: '',
        password: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'collaborateur',
        entreprise_id: membreFormData.entreprise_id, // Garder l'entreprise sélectionnée
        departement: '',
        poste: '',
        selectedDossiers: [],
        permissionsParDossier: {},
      });
      await loadCollaborateurs();
      await loadPermissions();
    } catch (error: any) {
      console.error('Erreur création membre:', error);
      alert('❌ Erreur lors de la création: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setCreatingMembre(false);
    }
  };

  const handleToggleDossier = (folderId: string) => {
    setMembreFormData((prev) => {
      const isSelected = prev.selectedDossiers.includes(folderId);
      const newSelectedDossiers = isSelected
        ? prev.selectedDossiers.filter((id) => id !== folderId)
        : [...prev.selectedDossiers, folderId];

      // Si on désélectionne, retirer aussi les permissions
      const newPermissions = { ...prev.permissionsParDossier };
      if (isSelected) {
        delete newPermissions[folderId];
      } else {
        // Par défaut, donner lecture seule
        newPermissions[folderId] = {
          niveau_acces: 'lecture',
          can_create: false,
          can_update: false,
          can_delete: false,
          can_share: false,
        };
      }

      return {
        ...prev,
        selectedDossiers: newSelectedDossiers,
        permissionsParDossier: newPermissions,
      };
    });
  };

  const handleUpdateDossierPermissions = (folderId: string, field: string, value: any) => {
    setMembreFormData((prev) => {
      const currentPerms = prev.permissionsParDossier[folderId] || {
        niveau_acces: 'lecture',
        can_create: false,
        can_update: false,
        can_delete: false,
        can_share: false,
      };

      return {
        ...prev,
        permissionsParDossier: {
          ...prev.permissionsParDossier,
          [folderId]: {
            ...currentPerms,
            [field]: value,
            // Si on change le niveau d'accès, ajuster automatiquement les permissions
            ...(field === 'niveau_acces' && {
              can_create: value === 'ecriture' || value === 'administration',
              can_update: value === 'ecriture' || value === 'administration',
              can_delete: value === 'administration',
              can_share: value === 'administration',
            }),
          },
        },
      };
    });
  };

  // Fonctions pour gérer les membres d'équipe
  const loadMembresEquipe = async (equipeId: string) => {
    try {
      const { data, error } = await supabase
        .from('collaborateurs_equipes')
        .select('collaborateur_id')
        .eq('equipe_id', equipeId)
        .is('date_sortie', null);

      if (error) throw error;
      return (data || []).map((m) => m.collaborateur_id);
    } catch (error) {
      console.error('Erreur chargement membres équipe:', error);
      return [];
    }
  };

  const handleAjouterMembres = async (equipeId: string) => {
    setEquipePourAjoutMembres(equipeId);
    setSelectedCollaborateurs([]); // Réinitialiser la sélection
    setShowAjoutMembresForm(true);
  };

  const handleSubmitAjoutMembres = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!equipePourAjoutMembres || selectedCollaborateurs.length === 0) {
      alert('Veuillez sélectionner au moins un collaborateur');
      return;
    }

    setAjoutMembresLoading(true);

    try {
      // 1. Retirer les doublons de selectedCollaborateurs (sécurité supplémentaire)
      const selectedUnique = [...new Set(selectedCollaborateurs)];
      
      // 2. Vérifier les membres actuels pour éviter les doublons
      const membresActuels = await loadMembresEquipe(equipePourAjoutMembres);
      
      // 3. Filtrer uniquement les collaborateurs qui ne sont pas déjà membres
      const collaborateursAInserer = selectedUnique.filter(
        (collabId) => !membresActuels.includes(collabId)
      );

      if (collaborateursAInserer.length === 0) {
        alert('⚠️ Tous les collaborateurs sélectionnés sont déjà membres de cette équipe');
        setAjoutMembresLoading(false);
        return;
      }

      if (collaborateursAInserer.length < selectedUnique.length) {
        const dejaMembres = selectedUnique.length - collaborateursAInserer.length;
        alert(`ℹ️ ${dejaMembres} collaborateur(s) déjà membre(s) de cette équipe. ${collaborateursAInserer.length} membre(s) seront ajouté(s).`);
      }

      // 4. Vérifier une dernière fois en interrogeant la base de données pour les membres actifs
      const { data: membresActifs, error: checkError } = await supabase
        .from('collaborateurs_equipes')
        .select('collaborateur_id')
        .eq('equipe_id', equipePourAjoutMembres)
        .is('date_sortie', null)
        .in('collaborateur_id', collaborateursAInserer);

      if (checkError) {
        console.warn('Erreur vérification membres actifs:', checkError);
      }

      // 5. Filtrer à nouveau en excluant ceux trouvés dans la DB
      const membresActifsIds = (membresActifs || []).map((m: any) => m.collaborateur_id);
      const collaborateursFinal = collaborateursAInserer.filter(
        (collabId) => !membresActifsIds.includes(collabId)
      );

      if (collaborateursFinal.length === 0) {
        alert('⚠️ Tous les collaborateurs sélectionnés sont déjà membres de cette équipe');
        setAjoutMembresLoading(false);
        return;
      }

      // 6. Insérer les nouveaux membres dans la table collaborateurs_equipes
      const membresToInsert = collaborateursFinal.map((collaborateurId) => ({
        collaborateur_id: collaborateurId,
        equipe_id: equipePourAjoutMembres,
        role_equipe: 'membre',
        date_entree: new Date().toISOString().split('T')[0],
      }));

      const { error } = await supabase
        .from('collaborateurs_equipes')
        .insert(membresToInsert);

      if (error) {
        // Gérer spécifiquement l'erreur de contrainte unique
        if (error.code === '23505' || error.message?.includes('unique constraint')) {
          throw new Error('Certains collaborateurs sont déjà membres de cette équipe. Veuillez rafraîchir la page et réessayer.');
        }
        throw error;
      }

      alert(`✅ ${collaborateursFinal.length} membre(s) ajouté(s) avec succès à l'équipe !`);
      setShowAjoutMembresForm(false);
      setEquipePourAjoutMembres(null);
      setSelectedCollaborateurs([]);
      await loadEquipes(); // Recharger les équipes pour mettre à jour le compteur de membres
      await loadCollaborateurs(); // Recharger aussi les collaborateurs pour mettre à jour la liste disponible
    } catch (error: any) {
      console.error('Erreur ajout membres:', error);
      alert('❌ Erreur lors de l\'ajout des membres: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setAjoutMembresLoading(false);
    }
  };

  // Obtenir les collaborateurs disponibles (non membres de l'équipe)
  const [collaborateursDisponibles, setCollaborateursDisponibles] = useState<Collaborateur[]>([]);

  useEffect(() => {
    const loadCollaborateursDisponibles = async () => {
      if (!showAjoutMembresForm || !equipePourAjoutMembres || !selectedEntreprise) {
        setCollaborateursDisponibles([]);
        return;
      }

      try {
        // Charger les membres actuels de l'équipe
        const membresActuels = await loadMembresEquipe(equipePourAjoutMembres);
        
        // Filtrer les collaborateurs pour exclure ceux déjà dans l'équipe
        const disponibles = collaborateurs.filter((collab) => !membresActuels.includes(collab.id));
        
        // Également retirer les doublons basés sur l'ID (sécurité supplémentaire)
        const uniques = disponibles.filter((collab, index, self) => 
          index === self.findIndex((c) => c.id === collab.id)
        );
        
        setCollaborateursDisponibles(uniques);
        
        // Réinitialiser la sélection si des collaborateurs sélectionnés ne sont plus disponibles
        setSelectedCollaborateurs((prev) => {
          const availableIds = new Set(uniques.map((c) => c.id));
          return prev.filter((id) => availableIds.has(id));
        });
      } catch (error) {
        console.error('Erreur chargement collaborateurs disponibles:', error);
        // En cas d'erreur, afficher tous les collaborateurs (meilleur que rien)
        const uniques = collaborateurs.filter((collab, index, self) => 
          index === self.findIndex((c) => c.id === collab.id)
        );
        setCollaborateursDisponibles(uniques);
      }
    };

    loadCollaborateursDisponibles();
  }, [showAjoutMembresForm, equipePourAjoutMembres, selectedEntreprise, collaborateurs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">Accès réservé aux super administrateurs</p>
        </div>
      </div>
    );
  }

  if (entreprises.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant de gérer des équipes</p>
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

  const filteredEquipes = equipes.filter((equipe) =>
    searchTerm === '' ||
    equipe.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipe.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPermissions = permissions.filter((perm) =>
    searchTerm === '' ||
    perm.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.folder?.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestion d'Équipe</h1>
          <p className="text-gray-300">Gérez les équipes et les permissions d'accès aux dossiers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMembreFormData({
                email: '',
                password: '',
                nom: '',
                prenom: '',
                telephone: '',
                role: 'collaborateur',
                entreprise_id: selectedEntreprise || '',
                departement: '',
                poste: '',
                selectedDossiers: [],
                permissionsParDossier: {},
              });
              setShowMembreForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
          >
            <UserPlus className="w-5 h-5" />
            Créer un membre
          </button>
          {activeTab === 'equipes' && (
            <button
              onClick={() => {
                setFormData({
                  nom: '',
                  description: '',
                  responsable_id: '',
                  couleur: '#3B82F6',
                  actif: true,
                });
                setEditingEquipeId(null);
                setShowEquipeForm(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nouvelle équipe
            </button>
          )}
          {activeTab === 'permissions' && (
            <button
              onClick={() => {
                setPermissionFormData({
                  folder_id: '',
                  role: 'collaborateur',
                  niveau_acces: 'lecture',
                  can_create: false,
                  can_update: false,
                  can_delete: false,
                  can_share: false,
                });
                setEditingPermissionId(null);
                setShowPermissionForm(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              <Shield className="w-5 h-5" />
              Nouvelle permission
            </button>
          )}
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

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('equipes')}
          className={`px-6 py-3 font-semibold transition-all border-b-2 ${
            activeTab === 'equipes'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          <Users className="w-5 h-5 inline mr-2" />
          Équipes
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-6 py-3 font-semibold transition-all border-b-2 ${
            activeTab === 'permissions'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          <Shield className="w-5 h-5 inline mr-2" />
          Permissions Dossiers
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'equipes' ? 'Rechercher une équipe...' : 'Rechercher une permission...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Contenu selon l'onglet actif */}
      {activeTab === 'equipes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipes.map((equipe) => (
            <div
              key={equipe.id}
              className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border transition-all ${
                equipe.actif ? 'border-white/20' : 'border-gray-500/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${equipe.couleur || '#3B82F6'}20` }}
                  >
                    <Users
                      className="w-6 h-6"
                      style={{ color: equipe.couleur || '#3B82F6' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{equipe.nom}</h3>
                    {equipe.responsable && (
                      <p className="text-xs text-gray-400">
                        Responsable: {equipe.responsable.nom} {equipe.responsable.prenom}
                      </p>
                    )}
                  </div>
                </div>
                {!equipe.actif && (
                  <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                    Inactive
                  </span>
                )}
              </div>

              {equipe.description && (
                <p className="text-sm text-gray-300 mb-4 line-clamp-2">{equipe.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{equipe.membres_count || 0} membre(s)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleAjouterMembres(equipe.id)}
                  className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all text-sm font-medium"
                  title="Ajouter des membres à cette équipe"
                >
                  <UserPlus className="w-4 h-4 inline mr-1" />
                  Ajouter
                </button>
                <button
                  onClick={() => handleEditEquipe(equipe)}
                  className="px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteEquipe(equipe.id)}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white font-semibold">Rôle</th>
                <th className="text-left py-3 px-4 text-white font-semibold">Dossier</th>
                <th className="text-left py-3 px-4 text-white font-semibold">Niveau d'accès</th>
                <th className="text-left py-3 px-4 text-white font-semibold">Permissions</th>
                <th className="text-left py-3 px-4 text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.map((perm) => {
                const roleInfo = ROLES.find((r) => r.value === perm.role);
                const niveauInfo = NIVEAUX_ACCES.find((n) => n.value === perm.niveau_acces);
                const NiveauIcon = niveauInfo?.icon || Folder;

                return (
                  <tr key={perm.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        roleInfo?.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                        roleInfo?.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                        roleInfo?.color === 'green' ? 'bg-green-500/20 text-green-400' :
                        roleInfo?.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                        roleInfo?.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {roleInfo?.label || perm.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {perm.folder ? (
                        <span className="flex items-center gap-1">
                          <Folder className="w-4 h-4" />
                          {perm.folder.nom}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Tous les dossiers</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        perm.niveau_acces === 'aucun' ? 'bg-red-500/20 text-red-400' :
                        perm.niveau_acces === 'lecture' ? 'bg-blue-500/20 text-blue-400' :
                        perm.niveau_acces === 'ecriture' ? 'bg-green-500/20 text-green-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        <NiveauIcon className="w-3 h-3" />
                        {niveauInfo?.label || perm.niveau_acces}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {perm.can_create && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Créer</span>
                        )}
                        {perm.can_update && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Modifier</span>
                        )}
                        {perm.can_delete && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Supprimer</span>
                        )}
                        {perm.can_share && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">Partager</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPermission(perm)}
                          className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-all text-sm"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePermission(perm.id)}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredPermissions.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucune permission configurée</p>
            </div>
          )}
        </div>
      )}

      {/* Formulaire Modal Équipe */}
      {showEquipeForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingEquipeId ? 'Modifier l\'équipe' : 'Créer une équipe'}
              </h2>
              <button
                onClick={() => {
                  setShowEquipeForm(false);
                  setEditingEquipeId(null);
                  setFormData({
                    nom: '',
                    description: '',
                    responsable_id: '',
                    couleur: '#3B82F6',
                    actif: true,
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitEquipe} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de l'équipe *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Équipe Commerciale, Direction, etc."
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
                  placeholder="Description de l'équipe..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Responsable
                </label>
                <select
                  value={formData.responsable_id}
                  onChange={(e) => setFormData({ ...formData, responsable_id: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun responsable</option>
                  {collaborateurs.map((collab) => (
                    <option key={collab.id} value={collab.id}>
                      {collab.nom} {collab.prenom} ({collab.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Couleur
                  </label>
                  <input
                    type="color"
                    value={formData.couleur}
                    onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Statut
                  </label>
                  <select
                    value={formData.actif ? 'actif' : 'inactif'}
                    onChange={(e) => setFormData({ ...formData, actif: e.target.value === 'actif' })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingEquipeId ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEquipeForm(false);
                    setEditingEquipeId(null);
                    setFormData({
                      nom: '',
                      description: '',
                      responsable_id: '',
                      couleur: '#3B82F6',
                      actif: true,
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

      {/* Formulaire Modal Permission */}
      {showPermissionForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingPermissionId ? 'Modifier la permission' : 'Créer une permission'}
              </h2>
              <button
                onClick={() => {
                  setShowPermissionForm(false);
                  setEditingPermissionId(null);
                  setPermissionFormData({
                    folder_id: '',
                    role: 'collaborateur',
                    niveau_acces: 'lecture',
                    can_create: false,
                    can_update: false,
                    can_delete: false,
                    can_share: false,
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitPermission} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rôle *
                  </label>
                  <select
                    value={permissionFormData.role}
                    onChange={(e) => setPermissionFormData({ ...permissionFormData, role: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dossier (optionnel - vide = tous les dossiers)
                  </label>
                  <select
                    value={permissionFormData.folder_id}
                    onChange={(e) => setPermissionFormData({ ...permissionFormData, folder_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous les dossiers</option>
                    {dossiers.map((dossier) => (
                      <option key={dossier.id} value={dossier.id}>
                        {dossier.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Niveau d'accès *
                </label>
                <select
                  value={permissionFormData.niveau_acces}
                  onChange={(e) => {
                    const niveau = e.target.value;
                    setPermissionFormData({
                      ...permissionFormData,
                      niveau_acces: niveau,
                      // Définir automatiquement les permissions selon le niveau
                      can_create: niveau === 'ecriture' || niveau === 'administration',
                      can_update: niveau === 'ecriture' || niveau === 'administration',
                      can_delete: niveau === 'administration',
                      can_share: niveau === 'administration',
                    });
                  }}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {NIVEAUX_ACCES.map((niveau) => (
                    <option key={niveau.value} value={niveau.value}>
                      {niveau.label}
                    </option>
                  ))}
                </select>
              </div>

              {(permissionFormData.niveau_acces === 'ecriture' || permissionFormData.niveau_acces === 'administration') && (
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Permissions détaillées
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionFormData.can_create}
                        onChange={(e) => setPermissionFormData({ ...permissionFormData, can_create: e.target.checked })}
                        className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Créer des documents</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionFormData.can_update}
                        onChange={(e) => setPermissionFormData({ ...permissionFormData, can_update: e.target.checked })}
                        className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Modifier des documents</span>
                    </label>
                    {permissionFormData.niveau_acces === 'administration' && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissionFormData.can_delete}
                            onChange={(e) => setPermissionFormData({ ...permissionFormData, can_delete: e.target.checked })}
                            className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Supprimer des documents</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissionFormData.can_share}
                            onChange={(e) => setPermissionFormData({ ...permissionFormData, can_share: e.target.checked })}
                            className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Partager des documents</span>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingPermissionId ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPermissionForm(false);
                    setEditingPermissionId(null);
                    setPermissionFormData({
                      folder_id: '',
                      role: 'collaborateur',
                      niveau_acces: 'lecture',
                      can_create: false,
                      can_update: false,
                      can_delete: false,
                      can_share: false,
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

      {/* Formulaire Modal Créer Membre */}
      {showMembreForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-4xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Créer un nouveau membre
              </h2>
              <button
                onClick={() => {
                  setShowMembreForm(false);
                  setMembreFormData({
                    email: '',
                    password: '',
                    nom: '',
                    prenom: '',
                    telephone: '',
                    role: 'collaborateur',
                    entreprise_id: selectedEntreprise || '',
                    departement: '',
                    poste: '',
                    selectedDossiers: [],
                    permissionsParDossier: {},
                  });
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitMembre} className="space-y-6">
              {/* Informations personnelles */}
              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Informations personnelles
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={membreFormData.email}
                      onChange={(e) => setMembreFormData({ ...membreFormData, email: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mot de passe *
                    </label>
                    <input
                      type="password"
                      value={membreFormData.password}
                      onChange={(e) => setMembreFormData({ ...membreFormData, password: e.target.value })}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Minimum 8 caractères"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={membreFormData.nom}
                      onChange={(e) => setMembreFormData({ ...membreFormData, nom: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      value={membreFormData.prenom}
                      onChange={(e) => setMembreFormData({ ...membreFormData, prenom: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={membreFormData.telephone}
                      onChange={(e) => setMembreFormData({ ...membreFormData, telephone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rôle *
                    </label>
                    <select
                      value={membreFormData.role}
                      onChange={(e) => setMembreFormData({ ...membreFormData, role: e.target.value as any })}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.filter((r) => r.value !== 'super_admin').map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Département
                    </label>
                    <input
                      type="text"
                      value={membreFormData.departement}
                      onChange={(e) => setMembreFormData({ ...membreFormData, departement: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Commercial, RH, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Poste
                    </label>
                    <input
                      type="text"
                      value={membreFormData.poste}
                      onChange={(e) => setMembreFormData({ ...membreFormData, poste: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Manager, Assistant, etc."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Entreprise *
                  </label>
                  <select
                    value={membreFormData.entreprise_id}
                    onChange={(e) => setMembreFormData({ ...membreFormData, entreprise_id: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner une entreprise</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions dossiers */}
              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Permissions d'accès aux dossiers
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Sélectionnez les dossiers auxquels ce membre aura accès et définissez ses permissions pour chaque dossier.
                </p>
                
                {dossiers.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Aucun dossier disponible. Créez d'abord des dossiers dans le module Documents.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {dossiers.map((dossier) => {
                      const isSelected = membreFormData.selectedDossiers.includes(dossier.id);
                      const perms = membreFormData.permissionsParDossier[dossier.id] || {
                        niveau_acces: 'lecture',
                        can_create: false,
                        can_update: false,
                        can_delete: false,
                        can_share: false,
                      };

                      return (
                        <div
                          key={dossier.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleDossier(dossier.id)}
                                className="w-5 h-5 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <Folder className="w-5 h-5 text-blue-400" />
                              <span className="text-white font-medium">{dossier.nom}</span>
                              {dossier.client_id && (
                                <span className="text-xs text-gray-400">(Client spécifique)</span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <div className="ml-8 space-y-3 pt-3 border-t border-white/10">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Niveau d'accès
                                </label>
                                <select
                                  value={perms.niveau_acces}
                                  onChange={(e) => handleUpdateDossierPermissions(dossier.id, 'niveau_acces', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {NIVEAUX_ACCES.map((niveau) => (
                                    <option key={niveau.value} value={niveau.value}>
                                      {niveau.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {(perms.niveau_acces === 'ecriture' || perms.niveau_acces === 'administration') && (
                                <div className="space-y-2">
                                  <label className="block text-sm font-medium text-gray-300">
                                    Permissions détaillées
                                  </label>
                                  <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={perms.can_create}
                                        onChange={(e) => handleUpdateDossierPermissions(dossier.id, 'can_create', e.target.checked)}
                                        className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-300">Créer des documents</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={perms.can_update}
                                        onChange={(e) => handleUpdateDossierPermissions(dossier.id, 'can_update', e.target.checked)}
                                        className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-300">Modifier des documents</span>
                                    </label>
                                    {perms.niveau_acces === 'administration' && (
                                      <>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={perms.can_delete}
                                            onChange={(e) => handleUpdateDossierPermissions(dossier.id, 'can_delete', e.target.checked)}
                                            className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-300">Supprimer des documents</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={perms.can_share}
                                            onChange={(e) => handleUpdateDossierPermissions(dossier.id, 'can_share', e.target.checked)}
                                            className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-300">Partager des documents</span>
                                        </label>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={creatingMembre}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
                >
                  {creatingMembre ? 'Création en cours...' : 'Créer le membre'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMembreForm(false);
                    setMembreFormData({
                      email: '',
                      password: '',
                      nom: '',
                      prenom: '',
                      telephone: '',
                      role: 'collaborateur',
                      entreprise_id: selectedEntreprise || '',
                      departement: '',
                      poste: '',
                      selectedDossiers: [],
                      permissionsParDossier: {},
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

      {/* Modal Ajouter Membres à l'Équipe */}
      {showAjoutMembresForm && equipePourAjoutMembres && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-3xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Ajouter des membres à l'équipe
              </h2>
              <button
                onClick={() => {
                  setShowAjoutMembresForm(false);
                  setEquipePourAjoutMembres(null);
                  setSelectedCollaborateurs([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitAjoutMembres} className="space-y-6">
              {/* Liste des collaborateurs disponibles */}
              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Collaborateurs disponibles
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Sélectionnez les collaborateurs de l'entreprise à ajouter à cette équipe.
                </p>
                
                {collaborateursDisponibles.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">
                    {collaborateurs.length === 0
                      ? 'Aucun collaborateur disponible dans cette entreprise. Créez d\'abord des collaborateurs.'
                      : 'Tous les collaborateurs sont déjà membres de cette équipe.'}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {collaborateursDisponibles.map((collab) => {
                      const roleInfo = ROLES.find((r) => r.value === collab.role);
                      const isSelected = selectedCollaborateurs.includes(collab.id);

                      return (
                        <div
                          key={collab.id}
                          className={`border rounded-lg p-4 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => {
                            setSelectedCollaborateurs((prev) => {
                              if (isSelected) {
                                // Retirer de la sélection (sans doublons)
                                return prev.filter((id) => id !== collab.id);
                              } else {
                                // Ajouter à la sélection uniquement s'il n'est pas déjà présent (éviter doublons)
                                if (!prev.includes(collab.id)) {
                                  return [...prev, collab.id];
                                }
                                return prev;
                              }
                            });
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedCollaborateurs((prev) => {
                                  if (isSelected) {
                                    // Retirer de la sélection (sans doublons)
                                    return prev.filter((id) => id !== collab.id);
                                  } else {
                                    // Ajouter à la sélection uniquement s'il n'est pas déjà présent (éviter doublons)
                                    if (!prev.includes(collab.id)) {
                                      return [...prev, collab.id];
                                    }
                                    return prev;
                                  }
                                });
                              }}
                              className="w-5 h-5 rounded bg-white/5 border-white/10 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-white font-medium">
                                    {collab.prenom} {collab.nom}
                                  </p>
                                  <p className="text-sm text-gray-400">{collab.email}</p>
                                </div>
                                {roleInfo && (
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      roleInfo.color === 'blue'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : roleInfo.color === 'purple'
                                        ? 'bg-purple-500/20 text-purple-400'
                                        : roleInfo.color === 'green'
                                        ? 'bg-green-500/20 text-green-400'
                                        : roleInfo.color === 'yellow'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : roleInfo.color === 'orange'
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                    }`}
                                  >
                                    {roleInfo.label}
                                  </span>
                                )}
                              </div>
                              {collab.poste && (
                                <p className="text-xs text-gray-500 mt-1">{collab.poste}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedCollaborateurs.length > 0 && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400">
                      {new Set(selectedCollaborateurs).size} collaborateur(s) sélectionné(s)
                      {new Set(selectedCollaborateurs).size !== selectedCollaborateurs.length && (
                        <span className="ml-2 text-yellow-400 text-xs">
                          ({selectedCollaborateurs.length - new Set(selectedCollaborateurs).size} doublon(s) retiré(s))
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={ajoutMembresLoading || selectedCollaborateurs.length === 0 || collaborateursDisponibles.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ajoutMembresLoading ? 'Ajout en cours...' : `Ajouter ${new Set(selectedCollaborateurs).size > 0 ? `(${new Set(selectedCollaborateurs).size})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAjoutMembresForm(false);
                    setEquipePourAjoutMembres(null);
                    setSelectedCollaborateurs([]);
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

