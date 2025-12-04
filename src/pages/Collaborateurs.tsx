import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Users, Shield, Plus, X, Building2, Mail, Trash2, Crown, Search, Filter, Edit, Ban, CheckCircle, Download, FileText } from 'lucide-react';
import { generatePDFContrat } from '../lib/pdfGeneratorContrat';
import { generatePDFCollaborateur } from '../lib/pdfGeneratorCollaborateur';

interface Collaborateur {
  id: string;
  user_id: string;
  email: string;
  role: string;
  entreprise_id?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  departement?: string;
  poste?: string;
  statut: string;
  date_embauche?: string;
  salaire?: number;
  created_at: string;
  entreprise_nom?: string;
}

export default function Collaborateurs() {
  const { user } = useAuth();
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientEntrepriseId, setClientEntrepriseId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCollaborateur, setEditingCollaborateur] = useState<Collaborateur | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('all');
  const [conventionsCollectives, setConventionsCollectives] = useState<Array<{ code_idcc: string; libelle: string }>>([]);
  const [filteredConventions, setFilteredConventions] = useState<Array<{ code_idcc: string; libelle: string }>>([]);
  const [showConventionsList, setShowConventionsList] = useState(false);
  const [showConventionsListEdit, setShowConventionsListEdit] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'collaborateur' as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial' | 'super_admin',
    entreprise_id: '',
    departement: '',
    poste: '',
    date_embauche: '',
    salaire: '',
    numero_securite_sociale: '',
    code_urssaf: '',
    emploi: '',
    statut_professionnel: 'CDI',
    echelon: '',
    date_entree: '',
    anciennete_annees: '',
    convention_collective_numero: '',
    convention_collective_nom: '',
    matricule: '',
    coefficient: '',
    // Nouveaux champs
    nombre_heures_hebdo: '35',
    nombre_heures_mensuelles: '',
    type_contrat: 'CDI' as 'CDI' | 'CDD' | 'Stage' | 'Alternance' | 'Freelance' | 'Interim' | 'Autre',
    forfait_jours: '',
    est_cadre: false,
    a_mutuelle: false,
    generer_contrat: false,
    mutuelle_nom: '',
    mutuelle_numero_adherent: '',
    date_naissance: '',
    adresse: '',
    code_postal: '',
    ville: '',
    iban: '',
    bic: '',
    contact_urgence_nom: '',
    contact_urgence_prenom: '',
    contact_urgence_telephone: '',
    contact_urgence_lien: '',
    a_permis_conduire: false,
    permis_categorie: '',
    permis_date_obtention: '',
  });

  useEffect(() => {
    checkAccess();
    loadConventionsCollectives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadConventionsCollectives = async () => {
    try {
      const { data, error } = await supabase
        .from('conventions_collectives')
        .select('code_idcc, libelle')
        .eq('est_actif', true)
        .eq('annee', new Date().getFullYear())
        .order('libelle');

      if (error) throw error;
      setConventionsCollectives(data || []);
      setFilteredConventions(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement conventions collectives:', error);
    }
  };

  useEffect(() => {
    if (hasAccess && user) {
      if (isSuperAdmin) {
        loadEntreprises();
      }
      // Pour les clients, charger leur entreprise et définir automatiquement l'entreprise_id
      if (isClient && clientEntrepriseId) {
        loadClientEntreprise();
        if (!formData.entreprise_id) {
          setFormData((prev) => ({ ...prev, entreprise_id: clientEntrepriseId }));
        }
      }
      loadCollaborateurs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isSuperAdmin, isClient, clientEntrepriseId, user]);

  const loadClientEntreprise = async () => {
    if (!clientEntrepriseId) return;
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom')
        .eq('id', clientEntrepriseId)
        .maybeSingle();

      if (!error && data) {
        setEntreprises([data]);
      }
    } catch (error) {
      console.error('Erreur chargement entreprise client:', error);
    }
  };

  useEffect(() => {
    if (entreprises.length > 0 && !formData.entreprise_id && isSuperAdmin) {
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprises, isSuperAdmin]);

  const checkAccess = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      setHasAccess(false);
      setIsClient(false);
      return;
    }

    try {
      // 1. Vérifier si c'est un super admin plateforme
      const { data: utilisateur, error } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        console.log('✅ Rôle vérifié dans utilisateurs:', utilisateur.role, '-> isSuperAdmin:', isAdmin);
        
        if (isAdmin) {
          setIsSuperAdmin(true);
          setHasAccess(true);
          setIsClient(false);
          return;
        }
      }

      // 2. Si pas super admin, vérifier si c'est un client avec le module activé
      const { data: espaceClient, error: espaceError } = await supabase
        .from('espaces_membres_clients')
        .select('modules_actifs, entreprise_id')
        .eq('user_id', user.id)
        .eq('actif', true)
        .maybeSingle();

      if (!espaceError && espaceClient) {
        setIsClient(true);
        setClientEntrepriseId(espaceClient.entreprise_id || null);
        
        // Vérifier si le module "collaborateurs" ou "salaries" est activé (toutes les variantes)
        const modulesActifs = espaceClient.modules_actifs || {};
        const moduleKeys = Object.keys(modulesActifs);
        const hasModule = 
          moduleKeys.some(key => 
            (key.toLowerCase().includes('collaborateur') || 
             key.toLowerCase().includes('salarie') ||
             key.toLowerCase().includes('collaborator')) &&
            (modulesActifs[key] === true || 
             modulesActifs[key] === 'true' ||
             String(modulesActifs[key]).toLowerCase() === 'true')
          ) ||
          modulesActifs.collaborateurs === true ||
          modulesActifs['collaborateurs'] === true ||
          modulesActifs.salaries === true ||
          modulesActifs['salaries'] === true ||
          modulesActifs['gestion-collaborateurs'] === true ||
          modulesActifs['gestion_collaborateurs'] === true ||
          modulesActifs['gestion-des-collaborateurs'] === true ||
          modulesActifs['gestion_des_collaborateurs'] === true;

        console.log('👤 Client détecté, modules actifs:', modulesActifs, '-> hasModule:', hasModule);
        
        if (hasModule) {
          setHasAccess(true);
          setIsSuperAdmin(false);
          console.log('✅ Accès autorisé : client avec module collaborateurs activé');
          return;
        } else {
          setHasAccess(false);
          console.warn('❌ Accès refusé : client sans module collaborateurs activé');
          return;
        }
      }

      // 3. Fallback: vérifier dans user_metadata pour super admin
      console.warn('⚠️ Impossible de lire utilisateurs/espace client, fallback sur user_metadata');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      console.log('✅ Rôle vérifié dans user_metadata:', role, '-> isSuperAdmin:', isAdmin);
      setIsSuperAdmin(isAdmin);
      setHasAccess(isAdmin);
      setIsClient(false);
    } catch (error) {
      console.error('❌ Erreur vérification accès:', error);
      setIsSuperAdmin(false);
      setHasAccess(false);
      setIsClient(false);
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
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const loadCollaborateurs = async () => {
    try {
      setLoading(true);
      console.log('🔄 Chargement des collaborateurs...', { isSuperAdmin, isClient, clientEntrepriseId });
      
      let data, error;

      // Utiliser la table collaborateurs_entreprise pour tous (clients et super admins)
      if (isClient && clientEntrepriseId) {
        // Client : utiliser collaborateurs_entreprise filtré par son entreprise
        console.log('👤 Client : chargement depuis collaborateurs_entreprise');
        const result = await supabase
          .from('collaborateurs_entreprise')
          .select(`
            *,
            entreprise:entreprises(id, nom)
          `)
          .eq('entreprise_id', clientEntrepriseId)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      } else if (isSuperAdmin) {
        // Super Admin : charger TOUS les collaborateurs de toutes les entreprises
        console.log('🔧 Super Admin : chargement depuis collaborateurs_entreprise (toutes les entreprises)');
        const result = await supabase
          .from('collaborateurs_entreprise')
          .select(`
            *,
            entreprise:entreprises(id, nom)
          `)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      } else {
        // Aucune table adaptée
        console.warn('⚠️ Aucun rôle adapté pour charger les collaborateurs');
        setCollaborateurs([]);
        setLoading(false);
        return;
      }

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        
        // Gestion spécifique des erreurs
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          console.warn('⚠️ Table collaborateurs n\'existe pas encore. Appliquez la migration SQL.');
          setCollaborateurs([]);
          return;
        }
        
        if (error.message?.includes('permission denied') || error.code === '42501') {
          console.error('❌ Erreur de permissions RLS. Appliquez la migration de correction.');
          alert('Erreur de permissions. Veuillez appliquer la migration SQL de correction des permissions RLS.');
          setCollaborateurs([]);
          return;
        }
        
        throw error;
      }

      console.log('✅ Collaborateurs chargés:', data?.length || 0);

      interface CollaborateurData {
        id: string;
        email: string;
        entreprise?: { nom: string };
        [key: string]: unknown;
      }
      
      // Enrichir avec le nom de l'entreprise et normaliser les données
      const collaborateursEnriched = (data || []).map((c: CollaborateurData) => ({
        ...c,
        entreprise_nom: c.entreprise?.nom,
      }));

      // Normaliser les données selon la table utilisée
      const enrichedWithDefaults = (collaborateursEnriched || []).map(c => {
        // Si c'est de collaborateurs_entreprise, convertir actif en statut
        const statut = c.statut || (c.actif === true || c.actif === undefined ? 'active' : 'inactif');
        
        return {
          ...c,
          user_id: c.user_id || '',
          role: c.role || 'collaborateur',
          statut: statut,
          created_at: c.created_at || new Date().toISOString(),
          // Pour collaborateurs_entreprise, ces champs existent déjà
          departement: c.departement || '',
          poste: c.poste || '',
          date_embauche: c.date_entree || c.date_embauche || '',
          salaire: c.salaire || undefined,
        };
      });
      console.log('✅ Collaborateurs normalisés:', enrichedWithDefaults.length, enrichedWithDefaults);
      setCollaborateurs(enrichedWithDefaults);
    } catch (error: unknown) {
      console.error('❌ Erreur chargement collaborateurs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Détails erreur:', error);
      alert('Erreur lors du chargement des collaborateurs: ' + errorMessage);
      setCollaborateurs([]);
    } finally {
      setLoading(false);
    }
  };

  const createCollaborateur = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Déterminer l'entreprise_id : client utilise automatiquement son entreprise
      const entrepriseId = isClient && clientEntrepriseId 
        ? clientEntrepriseId 
        : formData.entreprise_id || null;

      if (!entrepriseId) {
        alert('❌ Erreur : Aucune entreprise sélectionnée');
        return;
      }

      // Appeler la fonction RPC qui crée automatiquement dans auth.users, utilisateurs et collaborateurs
      const { data, error } = await supabase.rpc('create_collaborateur', {
        p_email: formData.email,
        p_password: formData.password,
        p_nom: formData.nom || null,
        p_prenom: formData.prenom || null,
        p_telephone: formData.telephone || null,
        p_role: formData.role,
        p_entreprise_id: entrepriseId,
        p_departement: formData.departement || null,
        p_poste: formData.poste || null,
        p_date_embauche: formData.date_embauche || null,
        p_salaire: formData.salaire ? parseFloat(formData.salaire) : null,
        p_numero_securite_sociale: formData.numero_securite_sociale || null,
        p_code_urssaf: formData.code_urssaf || null,
        p_emploi: formData.emploi || null,
        p_statut_professionnel: formData.statut_professionnel || null,
        p_echelon: formData.echelon || null,
        p_date_entree: formData.date_entree || null,
        p_convention_collective_numero: formData.convention_collective_numero || null,
        p_convention_collective_nom: formData.convention_collective_nom || null,
        p_matricule: formData.matricule || null,
        p_coefficient: formData.coefficient ? parseInt(formData.coefficient) : null,
        // Nouveaux champs
        p_nombre_heures_hebdo: formData.nombre_heures_hebdo ? parseFloat(formData.nombre_heures_hebdo) : 35.00,
        p_nombre_heures_mensuelles: formData.nombre_heures_mensuelles ? parseFloat(formData.nombre_heures_mensuelles) : null,
        p_type_contrat: formData.type_contrat || null,
        p_forfait_jours: formData.forfait_jours ? parseInt(formData.forfait_jours) : null,
        p_est_cadre: formData.est_cadre,
        p_a_mutuelle: formData.a_mutuelle,
        p_mutuelle_nom: formData.mutuelle_nom || null,
        p_mutuelle_numero_adherent: formData.mutuelle_numero_adherent || null,
        p_date_naissance: formData.date_naissance || null,
        p_adresse: formData.adresse || null,
        p_code_postal: formData.code_postal || null,
        p_ville: formData.ville || null,
        p_iban: formData.iban || null,
        p_bic: formData.bic || null,
        p_contact_urgence_nom: formData.contact_urgence_nom || null,
        p_contact_urgence_prenom: formData.contact_urgence_prenom || null,
        p_contact_urgence_telephone: formData.contact_urgence_telephone || null,
        p_contact_urgence_lien: formData.contact_urgence_lien || null,
        p_a_permis_conduire: formData.a_permis_conduire,
        p_permis_categorie: formData.permis_categorie || null,
        p_permis_date_obtention: formData.permis_date_obtention || null,
        // Champs pour contrat détaillé
        p_fonctions_poste: formData.fonctions_poste || null,
        p_lieu_travail: formData.lieu_travail || null,
        p_periode_essai_jours: formData.periode_essai_jours ? parseInt(formData.periode_essai_jours) : null,
        p_horaires_travail: formData.horaires_travail || null,
      });

      if (error) {
        throw error;
      }

      // Vérifier le résultat
      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur créé avec succès!');
      
      // Générer le contrat si demandé
      if (formData.generer_contrat && data?.collaborateur_id) {
        try {
          // Récupérer les données complètes du collaborateur et de l'entreprise
          const { data: newCollaborateur, error: collabError } = await supabase
            .from('collaborateurs_entreprise')
            .select('*, entreprises(*)')
            .eq('id', data.collaborateur_id)
            .single();

          if (!collabError && newCollaborateur) {
            await handleGenererContrat(newCollaborateur);
          }
        } catch (error) {
          console.error('Erreur lors de la génération du contrat:', error);
          // Ne pas bloquer la création si la génération du contrat échoue
        }
      }
      
      setShowForm(false);
      setFormData({
        email: '',
        password: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'collaborateur',
        entreprise_id: formData.entreprise_id,
        departement: '',
        poste: '',
        date_embauche: '',
        salaire: '',
        numero_securite_sociale: '',
        code_urssaf: '',
        emploi: '',
        statut_professionnel: 'CDI',
        echelon: '',
        date_entree: '',
        anciennete_annees: '',
        convention_collective_numero: '',
        convention_collective_nom: '',
        matricule: '',
        coefficient: '',
        nombre_heures_hebdo: '35',
        nombre_heures_mensuelles: '',
        type_contrat: 'CDI',
        forfait_jours: '',
        est_cadre: false,
        a_mutuelle: false,
        mutuelle_nom: '',
        mutuelle_numero_adherent: '',
        date_naissance: '',
        adresse: '',
        code_postal: '',
        ville: '',
        iban: '',
        bic: '',
        contact_urgence_nom: '',
        contact_urgence_prenom: '',
        contact_urgence_telephone: '',
        contact_urgence_lien: '',
    a_permis_conduire: false,
    permis_categorie: '',
    permis_date_obtention: '',
    generer_contrat: false,
    // Champs pour le contrat détaillé
    fonctions_poste: '',
    lieu_travail: '',
    periode_essai_jours: '',
    horaires_travail: '',
  });
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur création collaborateur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la création: ' + errorMessage);
    }
  };

  const handleEdit = async (collaborateur: Collaborateur) => {
    console.log('✏️ Édition collaborateur:', collaborateur);
    if (!collaborateur || !collaborateur.id) {
      alert('❌ Erreur: Données du collaborateur invalides');
      return;
    }
    
    // Charger les données complètes du collaborateur depuis la base
    try {
      const { data: collabComplete, error } = await supabase
        .from('collaborateurs_entreprise')
        .select('*')
        .eq('id', collaborateur.id)
        .single();

      if (error) {
        console.error('❌ Erreur chargement collaborateur:', error);
        alert('Erreur lors du chargement des données du collaborateur');
        return;
      }

      setEditingCollaborateur(collaborateur);
      setFormData({
        email: collaborateur.email || '',
        password: '', // Ne pas afficher le mot de passe
        nom: collabComplete.nom || collaborateur.nom || '',
        prenom: collabComplete.prenom || collaborateur.prenom || '',
        telephone: collabComplete.telephone || collaborateur.telephone || '',
        role: collabComplete.role || collaborateur.role as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial' | 'super_admin',
        entreprise_id: collabComplete.entreprise_id || collaborateur.entreprise_id || '',
        departement: collabComplete.departement || collaborateur.departement || '',
        poste: collabComplete.poste || collaborateur.poste || '',
        date_embauche: collabComplete.date_entree || collaborateur.date_embauche || collaborateur.date_entree || '',
        date_entree: collabComplete.date_entree || collaborateur.date_entree || collaborateur.date_embauche || '',
        salaire: collabComplete.salaire?.toString() || collaborateur.salaire?.toString() || '',
        numero_securite_sociale: collabComplete.numero_securite_sociale || '',
        code_urssaf: collabComplete.code_urssaf || '',
        emploi: collabComplete.emploi || '',
        statut_professionnel: collabComplete.statut_professionnel || 'CDI',
        echelon: collabComplete.echelon || '',
        anciennete_annees: collabComplete.anciennete_annees?.toString() || '',
        convention_collective_numero: collabComplete.convention_collective_numero || '',
        convention_collective_nom: collabComplete.convention_collective_nom || '',
        matricule: collabComplete.matricule || '',
        coefficient: collabComplete.coefficient?.toString() || '',
        // Nouveaux champs
        nombre_heures_hebdo: collabComplete.nombre_heures_hebdo?.toString() || '35',
        nombre_heures_mensuelles: collabComplete.nombre_heures_mensuelles?.toString() || '',
        type_contrat: collabComplete.type_contrat || 'CDI',
        forfait_jours: collabComplete.forfait_jours?.toString() || '',
        est_cadre: collabComplete.est_cadre || false,
        a_mutuelle: collabComplete.a_mutuelle || false,
        mutuelle_nom: collabComplete.mutuelle_nom || '',
        mutuelle_numero_adherent: collabComplete.mutuelle_numero_adherent || '',
        date_naissance: collabComplete.date_naissance || '',
        adresse: collabComplete.adresse || '',
        code_postal: collabComplete.code_postal || '',
        ville: collabComplete.ville || '',
        iban: collabComplete.iban || '',
        bic: collabComplete.bic || '',
        contact_urgence_nom: collabComplete.contact_urgence_nom || '',
        contact_urgence_prenom: collabComplete.contact_urgence_prenom || '',
        contact_urgence_telephone: collabComplete.contact_urgence_telephone || '',
        contact_urgence_lien: collabComplete.contact_urgence_lien || '',
          a_permis_conduire: collabComplete.a_permis_conduire || false,
          permis_categorie: collabComplete.permis_categorie || '',
          permis_date_obtention: collabComplete.permis_date_obtention || '',
          // Champs pour contrat détaillé
          fonctions_poste: collabComplete.fonctions_poste || '',
          lieu_travail: collabComplete.lieu_travail || '',
          periode_essai_jours: collabComplete.periode_essai_jours?.toString() || '',
          horaires_travail: collabComplete.horaires_travail || '',
        });
        setShowEditForm(true);
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement du collaborateur:', error);
      alert(`Erreur: ${error.message || 'Impossible de charger les données du collaborateur'}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollaborateur) {
      alert('❌ Erreur: Aucun collaborateur sélectionné pour la modification');
      return;
    }

    console.log('🔄 Mise à jour collaborateur:', editingCollaborateur.id, formData);

    try {
      // Mettre à jour directement dans collaborateurs_entreprise
      // Note: 'departement' n'existe pas dans la table, utiliser 'emploi' à la place
      const updateData: Record<string, unknown> = {
        nom: formData.nom || null,
        prenom: formData.prenom || null,
        telephone: formData.telephone || null,
        role: formData.role || null,
        poste: formData.poste || null,
        emploi: formData.emploi || formData.departement || null, // Utiliser emploi ou departement
        date_entree: formData.date_entree || formData.date_embauche || null,
        numero_securite_sociale: formData.numero_securite_sociale || null,
        code_urssaf: formData.code_urssaf || null,
        statut_professionnel: formData.statut_professionnel || null,
        echelon: formData.echelon || null,
        convention_collective_numero: formData.convention_collective_numero || null,
        convention_collective_nom: formData.convention_collective_nom || null,
        matricule: formData.matricule || null,
        coefficient: formData.coefficient || null,
        // Nouveaux champs
        nombre_heures_hebdo: formData.nombre_heures_hebdo ? parseFloat(formData.nombre_heures_hebdo) : 35.00,
        nombre_heures_mensuelles: formData.nombre_heures_mensuelles ? parseFloat(formData.nombre_heures_mensuelles) : null,
        type_contrat: formData.type_contrat || null,
        forfait_jours: formData.forfait_jours ? parseInt(formData.forfait_jours) : null,
        est_cadre: formData.est_cadre,
        a_mutuelle: formData.a_mutuelle,
        mutuelle_nom: formData.mutuelle_nom || null,
        mutuelle_numero_adherent: formData.mutuelle_numero_adherent || null,
        date_naissance: formData.date_naissance || null,
        adresse: formData.adresse || null,
        code_postal: formData.code_postal || null,
        ville: formData.ville || null,
        iban: formData.iban || null,
        bic: formData.bic || null,
        contact_urgence_nom: formData.contact_urgence_nom || null,
        contact_urgence_prenom: formData.contact_urgence_prenom || null,
        contact_urgence_telephone: formData.contact_urgence_telephone || null,
        contact_urgence_lien: formData.contact_urgence_lien || null,
        a_permis_conduire: formData.a_permis_conduire,
        permis_categorie: formData.permis_categorie || null,
        permis_date_obtention: formData.permis_date_obtention || null,
        // Champs pour contrat détaillé
        fonctions_poste: formData.fonctions_poste || null,
        lieu_travail: formData.lieu_travail || null,
        periode_essai_jours: formData.periode_essai_jours ? parseInt(formData.periode_essai_jours) : null,
        horaires_travail: formData.horaires_travail || null,
      };

      // Si l'entreprise change, mettre à jour aussi
      if (formData.entreprise_id && formData.entreprise_id !== editingCollaborateur.entreprise_id) {
        updateData.entreprise_id = formData.entreprise_id;
      }

      // Vérifier d'abord que le collaborateur existe
      const { data: existingCollaborateur, error: checkError } = await supabase
        .from('collaborateurs_entreprise')
        .select('id')
        .eq('id', editingCollaborateur.id)
        .single();

      if (checkError || !existingCollaborateur) {
        throw new Error('Collaborateur non trouvé dans la base de données');
      }

      const { error } = await supabase
        .from('collaborateurs_entreprise')
        .update(updateData)
        .eq('id', editingCollaborateur.id);

      if (error) {
        console.error('❌ Erreur Supabase update:', error);
        throw error;
      }

      // Si un salaire est fourni, mettre à jour ou créer l'entrée dans salaries
      if (formData.salaire) {
        const salaireValue = parseFloat(formData.salaire);
        if (!isNaN(salaireValue)) {
          // Vérifier si un salaire existe déjà
          const { data: existingSalary } = await supabase
            .from('salaries')
            .select('id')
            .eq('collaborateur_id', editingCollaborateur.id)
            .single();

          if (existingSalary) {
            // Mettre à jour le salaire existant
            await supabase
              .from('salaries')
              .update({ salaire_brut: salaireValue, updated_at: new Date().toISOString() })
              .eq('id', existingSalary.id);
          } else {
            // Créer un nouveau salaire
            await supabase
              .from('salaries')
              .insert({
                collaborateur_id: editingCollaborateur.id,
                salaire_brut: salaireValue,
                date_debut: formData.date_entree || formData.date_embauche || new Date().toISOString().split('T')[0],
                actif: true,
              });
          }
        }
      }

      alert('✅ Collaborateur modifié avec succès!');
      setShowEditForm(false);
      setEditingCollaborateur(null);
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur modification:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la modification: ' + errorMessage);
    }
  };

  const handleSuspend = async (collaborateurId: string, collaborateurNom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir suspendre ${collaborateurNom} ? Il ne pourra plus accéder à l'application.`)) return;

    try {
      const { data, error } = await supabase.rpc('suspendre_collaborateur', {
        p_collaborateur_id: collaborateurId,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur suspendu avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur suspension:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la suspension: ' + errorMessage);
    }
  };

  const handleActivate = async (collaborateurId: string, collaborateurNom: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir activer ${collaborateurNom} ? Il pourra à nouveau accéder à l'application.`)) return;

    try {
      interface ActiverResult {
        success: boolean;
        error?: string;
      }
      
      const { data, error } = await supabase.rpc<ActiverResult>('activer_collaborateur', {
        p_collaborateur_id: collaborateurId,
      });

      if (error) throw error;

      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Collaborateur activé avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('Erreur activation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de l\'activation: ' + errorMessage);
    }
  };

  const handleGenererContrat = async (collaborateur: any) => {
    try {
      // Charger les données complètes de l'entreprise
      const entreprise = collaborateur.entreprises || (await supabase
        .from('entreprises')
        .select('*')
        .eq('id', collaborateur.entreprise_id)
        .single()).data;

      if (!entreprise) {
        throw new Error('Impossible de charger les données de l\'entreprise');
      }

      const contratData = {
        collaborateur: {
          nom: collaborateur.nom || '',
          prenom: collaborateur.prenom || '',
          email: collaborateur.email || '',
          telephone: collaborateur.telephone || '',
          adresse: collaborateur.adresse || '',
          code_postal: collaborateur.code_postal || '',
          ville: collaborateur.ville || '',
          date_naissance: collaborateur.date_naissance || '',
          numero_securite_sociale: collaborateur.numero_securite_sociale || '',
        },
        entreprise: {
          nom: entreprise.nom || '',
          adresse: entreprise.adresse || '',
          code_postal: entreprise.code_postal || '',
          ville: entreprise.ville || '',
          siret: entreprise.siret || '',
          email: entreprise.email || '',
          telephone: entreprise.telephone || '',
          forme_juridique: entreprise.forme_juridique || undefined,
          capital: entreprise.capital || undefined,
        },
        contrat: {
          type_contrat: collaborateur.type_contrat || collaborateur.statut_professionnel || 'CDI',
          poste: collaborateur.poste || '',
          date_entree: collaborateur.date_entree || '',
          salaire_brut: collaborateur.salaire || undefined,
          nombre_heures_hebdo: collaborateur.nombre_heures_hebdo || undefined,
          nombre_heures_mensuelles: collaborateur.nombre_heures_mensuelles || undefined,
          forfait_jours: collaborateur.forfait_jours || undefined,
          est_cadre: collaborateur.est_cadre || false,
          statut_professionnel: collaborateur.statut_professionnel || '',
          convention_collective_nom: collaborateur.convention_collective_nom || '',
          convention_collective_numero: collaborateur.convention_collective_numero || '',
          fonctions_poste: collaborateur.fonctions_poste || undefined,
          lieu_travail: collaborateur.lieu_travail || undefined,
          periode_essai_jours: collaborateur.periode_essai_jours || (collaborateur.est_cadre ? 90 : 30),
          horaires_travail: collaborateur.horaires_travail || undefined,
          a_mutuelle: collaborateur.a_mutuelle || false,
          mutuelle_nom: collaborateur.mutuelle_nom || undefined,
        },
      };

      await generatePDFContrat(contratData);
    } catch (error: any) {
      console.error('Erreur lors de la génération du contrat:', error);
      alert(`Erreur lors de la génération du contrat: ${error.message || 'Erreur inconnue'}`);
    }
  };

  const handleTelechargerInfos = async (collaborateur: Collaborateur) => {
    try {
      setLoading(true);

      // Charger les données complètes du collaborateur
      const { data: collabComplete, error: collabError } = await supabase
        .from('collaborateurs_entreprise')
        .select('*')
        .eq('id', collaborateur.id)
        .single();

      if (collabError || !collabComplete) {
        throw new Error('Impossible de charger les données du collaborateur');
      }

      // Charger les données de l'entreprise
      const { data: entreprise, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', collabComplete.entreprise_id)
        .single();

      if (entrepriseError || !entreprise) {
        throw new Error('Impossible de charger les données de l\'entreprise');
      }

      const collaborateurData = {
        collaborateur: {
          id: collabComplete.id,
          nom: collabComplete.nom || '',
          prenom: collabComplete.prenom || '',
          email: collabComplete.email || '',
          telephone: collabComplete.telephone || '',
          role: collabComplete.role || '',
          poste: collabComplete.poste || '',
          date_entree: collabComplete.date_entree || '',
          salaire: collabComplete.salaire || undefined,
          numero_securite_sociale: collabComplete.numero_securite_sociale || '',
          code_urssaf: collabComplete.code_urssaf || '',
          emploi: collabComplete.emploi || '',
          statut_professionnel: collabComplete.statut_professionnel || '',
          echelon: collabComplete.echelon || '',
          convention_collective_numero: collabComplete.convention_collective_numero || '',
          convention_collective_nom: collabComplete.convention_collective_nom || '',
          matricule: collabComplete.matricule || '',
          coefficient: collabComplete.coefficient || undefined,
          nombre_heures_hebdo: collabComplete.nombre_heures_hebdo || undefined,
          nombre_heures_mensuelles: collabComplete.nombre_heures_mensuelles || undefined,
          type_contrat: collabComplete.type_contrat || '',
          forfait_jours: collabComplete.forfait_jours || undefined,
          est_cadre: collabComplete.est_cadre || false,
          a_mutuelle: collabComplete.a_mutuelle || false,
          mutuelle_nom: collabComplete.mutuelle_nom || '',
          mutuelle_numero_adherent: collabComplete.mutuelle_numero_adherent || '',
          date_naissance: collabComplete.date_naissance || '',
          adresse: collabComplete.adresse || '',
          code_postal: collabComplete.code_postal || '',
          ville: collabComplete.ville || '',
          iban: collabComplete.iban || '',
          bic: collabComplete.bic || '',
          contact_urgence_nom: collabComplete.contact_urgence_nom || '',
          contact_urgence_prenom: collabComplete.contact_urgence_prenom || '',
          contact_urgence_telephone: collabComplete.contact_urgence_telephone || '',
          contact_urgence_lien: collabComplete.contact_urgence_lien || '',
          a_permis_conduire: collabComplete.a_permis_conduire || false,
          permis_categorie: collabComplete.permis_categorie || '',
          permis_date_obtention: collabComplete.permis_date_obtention || '',
        },
        entreprise: {
          nom: entreprise.nom || '',
          adresse: entreprise.adresse || '',
          code_postal: entreprise.code_postal || '',
          ville: entreprise.ville || '',
          siret: entreprise.siret || '',
          email: entreprise.email || '',
          telephone: entreprise.telephone || '',
        },
      };

      await generatePDFCollaborateur(collaborateurData);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement des informations:', error);
      alert(`Erreur lors du téléchargement: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (collaborateurId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce collaborateur ? Cette action supprimera également son compte utilisateur.')) return;

    try {
      // Vérifier d'abord que le collaborateur existe
      const { data: existingCollaborateur, error: checkError } = await supabase
        .from('collaborateurs_entreprise')
        .select('id, nom, prenom, user_id')
        .eq('id', collaborateurId)
        .single();

      if (checkError || !existingCollaborateur) {
        throw new Error('Collaborateur non trouvé');
      }

      // Supprimer le collaborateur (les triggers s'occuperont de supprimer l'auth.user si nécessaire)
      const { error: deleteError } = await supabase
        .from('collaborateurs_entreprise')
        .delete()
        .eq('id', collaborateurId);

      if (deleteError) {
        console.error('❌ Erreur Supabase delete:', deleteError);
        throw deleteError;
      }

      // Note: Les triggers de la base de données devraient automatiquement supprimer l'auth.user
      // Si ce n'est pas le cas, il faudra créer une Edge Function ou utiliser une RPC avec service_role

      alert('✅ Collaborateur supprimé avec succès');
      loadCollaborateurs();
    } catch (error: unknown) {
      console.error('❌ Erreur suppression:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la suppression: ' + errorMessage);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-8">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-gray-300">
            {isClient 
              ? 'Le module "Collaborateurs" n\'est pas activé dans votre abonnement. Contactez votre administrateur pour activer ce module.'
              : 'Vous devez être super administrateur ou avoir le module "Collaborateurs" activé pour accéder à cette page.'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  // Filtrer les collaborateurs
  const filteredCollaborateurs = collaborateurs.filter((c) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      // Priorité 1: Nom d'entreprise
      c.entreprise_nom?.toLowerCase().includes(searchLower) ||
      // Priorité 2: Nom et prénom du collaborateur
      `${c.prenom} ${c.nom}`.toLowerCase().includes(searchLower) ||
      // Priorité 3: Poste et département
      c.poste?.toLowerCase().includes(searchLower) ||
      c.departement?.toLowerCase().includes(searchLower) ||
      // Priorité 4: Email (en dernier)
      c.email.toLowerCase().includes(searchLower);
    
    const matchesRole = filterRole === 'all' || c.role === filterRole;
    const matchesStatut = filterStatut === 'all' || c.statut === filterStatut;
    const matchesEntreprise = selectedEntreprise === 'all' || c.entreprise_id === selectedEntreprise;
    
    return matchesSearch && matchesRole && matchesStatut && matchesEntreprise;
  });

  // Grouper les collaborateurs par entreprise
  const collaborateursParEntreprise = filteredCollaborateurs.reduce((acc, c) => {
    const entrepriseId = c.entreprise_id || 'sans-entreprise';
    const entrepriseNom = c.entreprise_nom || 'Sans entreprise';
    
    if (!acc[entrepriseId]) {
      acc[entrepriseId] = {
        entreprise_id: entrepriseId,
        entreprise_nom: entrepriseNom,
        collaborateurs: []
      };
    }
    acc[entrepriseId].collaborateurs.push(c);
    return acc;
  }, {} as Record<string, { entreprise_id: string; entreprise_nom: string; collaborateurs: Collaborateur[] }>);

  // Statistiques
  const stats = {
    total: collaborateurs.length,
    actifs: collaborateurs.filter(c => c.statut === 'active').length,
    parRole: {
      collaborateur: collaborateurs.filter(c => c.role === 'collaborateur').length,
      admin: collaborateurs.filter(c => c.role === 'admin' || c.role === 'super_admin').length,
      manager: collaborateurs.filter(c => c.role === 'manager').length,
      comptable: collaborateurs.filter(c => c.role === 'comptable').length,
      commercial: collaborateurs.filter(c => c.role === 'commercial').length,
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'collaborateur': 'Collaborateur',
      'manager': 'Manager',
      'comptable': 'Comptable',
      'commercial': 'Commercial'
    };
    return labels[role] || role;
  };

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Collaborateurs</h1>
          <p className="text-gray-300">Gestion des collaborateurs et administrateurs</p>
        </div>
        {(isSuperAdmin || (isClient && hasAccess)) && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Créer Collaborateur
          </button>
        )}
      </div>

      {/* Filtre par entreprise (uniquement pour super admin) */}
      {isSuperAdmin && entreprises.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Filtrer par entreprise</label>
          <select
            value={selectedEntreprise}
            onChange={(e) => setSelectedEntreprise(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les entreprises</option>
            {entreprises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total</p>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Actifs</p>
              <p className="text-3xl font-bold text-green-400">{stats.actifs}</p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Admins</p>
              <p className="text-3xl font-bold text-yellow-400">{stats.parRole.admin}</p>
            </div>
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Collaborateurs</p>
              <p className="text-3xl font-bold text-blue-400">{stats.parRole.collaborateur}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par entreprise, nom, poste, département..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          
          {/* Filtre Rôle */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="collaborateur">Collaborateur</option>
              <option value="manager">Manager</option>
              <option value="comptable">Comptable</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {/* Filtre Statut */}
          <div className="relative">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="pl-4 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="suspendue">Suspendu</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </div>
        
        {/* Résultats de recherche */}
        {searchTerm && (
          <div className="mt-3 text-sm text-gray-400">
            {filteredCollaborateurs.length} résultat(s) trouvé(s) pour "{searchTerm}"
          </div>
        )}
      </div>

      {/* Liste des collaborateurs */}
      <div className="space-y-8">
        {Object.values(collaborateursParEntreprise).map((groupe) => (
          <div key={groupe.entreprise_id} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">{groupe.entreprise_nom}</h2>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                {groupe.collaborateurs.length} collaborateur{groupe.collaborateurs.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Collaborateur</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Poste</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {groupe.collaborateurs.map((c) => (
                      <tr key={c.id} className="hover:bg-white/5 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">
                                {c.prenom} {c.nom}
                              </div>
                              <div className="text-sm text-gray-400">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {(c.role === 'admin' || c.role === 'super_admin') && <Crown className="w-4 h-4 text-yellow-400" />}
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                c.role === 'admin' || c.role === 'super_admin'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : c.role === 'manager'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : c.role === 'comptable'
                                  ? 'bg-green-500/20 text-green-300'
                                  : c.role === 'commercial'
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {getRoleLabel(c.role)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{c.poste || '-'}</div>
                          {c.departement && (
                            <div className="text-xs text-gray-400">{c.departement}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.telephone ? (
                            <div className="flex items-center gap-2 text-sm text-white">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {c.telephone}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              c.statut === 'active'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {c.statut === 'active' ? 'Actif' : c.statut === 'suspendue' ? 'Suspendu' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleTelechargerInfos(c)}
                              className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                              title="Télécharger toutes les informations"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const { data: collabComplete, error } = await supabase
                                    .from('collaborateurs_entreprise')
                                    .select('*, entreprises(*)')
                                    .eq('id', c.id)
                                    .single();
                                  
                                  if (error || !collabComplete) {
                                    throw new Error('Impossible de charger les données du collaborateur');
                                  }
                                  
                                  await handleGenererContrat(collabComplete);
                                } catch (error: any) {
                                  console.error('Erreur génération contrat:', error);
                                  alert(`Erreur: ${error.message || 'Impossible de générer le contrat'}`);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                              title="Générer le contrat de travail"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(c)}
                              className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {c.statut === 'active' ? (
                              <button
                                onClick={() => handleSuspend(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                                className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                                title="Suspendre"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(c.id, `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email)}
                                className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                                title="Activer"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center gap-2 text-sm"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && collaborateurs.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-xl border border-white/20">
          <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">Aucun collaborateur trouvé</p>
          <p className="text-gray-500 text-sm mb-4">
            {isSuperAdmin 
              ? 'Créez votre premier collaborateur en cliquant sur le bouton "Créer Collaborateur" ci-dessus.'
              : isClient
              ? 'Aucun collaborateur trouvé dans votre entreprise.'
              : 'La table collaborateurs n\'existe peut-être pas encore. Vérifiez que la migration SQL a été appliquée.'}
          </p>
          {(isSuperAdmin || (isClient && hasAccess)) && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
            >
              Créer un Collaborateur
            </button>
          )}
        </div>
      )}

      {/* Formulaire Modal - Créer Collaborateur */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Créer un Collaborateur</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createCollaborateur} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="collaborateur@entreprise.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-400 mt-1">Le mot de passe sera envoyé par email au collaborateur</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rôle *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial' | 'super_admin' })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                  <option value="manager">Manager</option>
                  <option value="comptable">Comptable</option>
                  <option value="commercial">Commercial</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Département</label>
                <input
                  type="text"
                  value={formData.departement}
                  onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: IT, Finance, Ventes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Poste</label>
                <input
                  type="text"
                  value={formData.poste}
                  onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: Développeur, Comptable, Commercial..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date d'embauche</label>
                  <input
                    type="date"
                    value={formData.date_embauche}
                    onChange={(e) => setFormData({ ...formData, date_embauche: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Salaire (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salaire}
                    onChange={(e) => setFormData({ ...formData, salaire: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                  <select
                    value={formData.entreprise_id}
                    onChange={(e) => setFormData({ ...formData, entreprise_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Aucune entreprise</option>
                    {entreprises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {isClient && clientEntrepriseId && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                  <input
                    type="text"
                    value={entreprises.find(e => e.id === clientEntrepriseId)?.nom || 'Votre entreprise'}
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Le collaborateur sera ajouté à votre entreprise</p>
                </div>
              )}

              {/* Section Informations professionnelles */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations professionnelles</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">N° Sécurité Sociale</label>
                    <input
                      type="text"
                      value={formData.numero_securite_sociale}
                      onChange={(e) => setFormData({ ...formData, numero_securite_sociale: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="1 85 07 75 123 45 67"
                      maxLength={15}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code URSSAF</label>
                    <input
                      type="text"
                      value={formData.code_urssaf}
                      onChange={(e) => setFormData({ ...formData, code_urssaf: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Code URSSAF"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Emploi</label>
                    <input
                      type="text"
                      value={formData.emploi}
                      onChange={(e) => setFormData({ ...formData, emploi: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: Développeur, Comptable..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Échelon</label>
                    <input
                      type="text"
                      value={formData.echelon}
                      onChange={(e) => setFormData({ ...formData, echelon: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: E1, E2, E3..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Convention Collective</label>
                    <input
                      type="text"
                      value={formData.convention_collective_numero}
                      onChange={(e) => {
                        const value = e.target.value;
                        const selected = conventionsCollectives.find(c => c.code_idcc === value);
                        setFormData({ 
                          ...formData, 
                          convention_collective_numero: value,
                          convention_collective_nom: selected?.libelle || ''
                        });
                        // Filtrer les conventions selon la saisie
                        if (value.length > 0) {
                          const filtered = conventionsCollectives.filter(cc => 
                            cc.code_idcc.toLowerCase().includes(value.toLowerCase()) ||
                            cc.libelle.toLowerCase().includes(value.toLowerCase())
                          ).slice(0, 10); // Limiter à 10 résultats
                          setFilteredConventions(filtered);
                          setShowConventionsList(true);
                        } else {
                          setFilteredConventions(conventionsCollectives.slice(0, 10));
                          setShowConventionsList(true);
                        }
                      }}
                      onFocus={() => setShowConventionsList(true)}
                      onBlur={() => setTimeout(() => setShowConventionsList(false), 200)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Rechercher (ex: IDCC1486 ou Syntec)"
                    />
                    {showConventionsList && filteredConventions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredConventions.map((cc) => (
                          <div
                            key={cc.code_idcc}
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                convention_collective_numero: cc.code_idcc,
                                convention_collective_nom: cc.libelle
                              });
                              setShowConventionsList(false);
                            }}
                            className="px-4 py-2 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0"
                          >
                            <div className="font-semibold text-white">{cc.code_idcc}</div>
                            <div className="text-xs text-gray-400 truncate">{cc.libelle}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Matricule</label>
                    <input
                      type="text"
                      value={formData.matricule}
                      onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Matricule"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date d'entrée</label>
                    <input
                      type="date"
                      value={formData.date_entree}
                      onChange={(e) => setFormData({ ...formData, date_entree: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Coefficient</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.coefficient}
                      onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: 200, 250..."
                    />
                  </div>
                </div>
              </div>

              {/* Section Informations de contrat */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations de contrat</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Type de contrat</label>
                    <select
                      value={formData.type_contrat}
                      onChange={(e) => setFormData({ ...formData, type_contrat: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Stage">Stage</option>
                      <option value="Alternance">Alternance</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Interim">Intérim</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Statut professionnel</label>
                    <select
                      value={formData.statut_professionnel}
                      onChange={(e) => setFormData({ ...formData, statut_professionnel: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Stage">Stage</option>
                      <option value="Alternance">Alternance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Heures hebdo</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.nombre_heures_hebdo}
                      onChange={(e) => setFormData({ ...formData, nombre_heures_hebdo: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="35"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Heures mensuelles</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.nombre_heures_mensuelles}
                      onChange={(e) => setFormData({ ...formData, nombre_heures_mensuelles: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="151.67"
                    />
                    <p className="text-xs text-gray-400 mt-1">Calculé auto si vide</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Forfait jours</label>
                    <input
                      type="number"
                      value={formData.forfait_jours}
                      onChange={(e) => setFormData({ ...formData, forfait_jours: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="218"
                    />
                    <p className="text-xs text-gray-400 mt-1">Pour cadres</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="est_cadre"
                    checked={formData.est_cadre}
                    onChange={(e) => setFormData({ ...formData, est_cadre: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="est_cadre" className="text-sm text-gray-300 cursor-pointer">
                    Cadre
                  </label>
                </div>

                {/* Fonctions du poste */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description détaillée des fonctions du poste</label>
                  <textarea
                    value={formData.fonctions_poste}
                    onChange={(e) => setFormData({ ...formData, fonctions_poste: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Décrivez en détail les missions principales, les responsabilités, les compétences requises, les objectifs de performance, les relations hiérarchiques..."
                    rows={6}
                  />
                  <p className="text-xs text-gray-400 mt-1">Cette description sera incluse dans le contrat de travail (6-10 pages)</p>
                </div>

                {/* Lieu de travail et autres infos */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Lieu de travail</label>
                    <input
                      type="text"
                      value={formData.lieu_travail}
                      onChange={(e) => setFormData({ ...formData, lieu_travail: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Adresse du lieu de travail principal"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Période d'essai (jours)</label>
                    <input
                      type="number"
                      value={formData.periode_essai_jours}
                      onChange={(e) => setFormData({ ...formData, periode_essai_jours: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder={formData.est_cadre ? "90" : "30"}
                    />
                    <p className="text-xs text-gray-400 mt-1">Défaut: {formData.est_cadre ? '90 jours (cadre)' : '30 jours (non-cadre)'}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Horaires de travail</label>
                  <input
                    type="text"
                    value={formData.horaires_travail}
                    onChange={(e) => setFormData({ ...formData, horaires_travail: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ex: Lundi-Vendredi 9h-18h avec pause déjeuner 12h-13h"
                  />
                </div>
              </div>

              {/* Section Mutuelle */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Mutuelle</h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="a_mutuelle"
                    checked={formData.a_mutuelle}
                    onChange={(e) => setFormData({ ...formData, a_mutuelle: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="a_mutuelle" className="text-sm text-gray-300 cursor-pointer">
                    Le collaborateur a une mutuelle
                  </label>
                </div>

                {formData.a_mutuelle && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nom de la mutuelle</label>
                      <input
                        type="text"
                        value={formData.mutuelle_nom}
                        onChange={(e) => setFormData({ ...formData, mutuelle_nom: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Ex: MGEN, Harmonie Mutuelle"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">N° adhérent</label>
                      <input
                        type="text"
                        value={formData.mutuelle_numero_adherent}
                        onChange={(e) => setFormData({ ...formData, mutuelle_numero_adherent: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Numéro d'adhérent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section Informations personnelles */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations personnelles</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date de naissance</label>
                  <input
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Numéro et rue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code postal</label>
                    <input
                      type="text"
                      value={formData.code_postal}
                      onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="75001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
                    <input
                      type="text"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Paris"
                    />
                  </div>
                </div>
              </div>

              {/* Section Coordonnées bancaires */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Coordonnées bancaires</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">IBAN</label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                    maxLength={34}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">BIC</label>
                  <input
                    type="text"
                    value={formData.bic}
                    onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="ABCDEFGH"
                    maxLength={11}
                  />
                </div>
              </div>

              {/* Section Contact d'urgence */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Contact d'urgence</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={formData.contact_urgence_prenom}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_prenom: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                    <input
                      type="text"
                      value={formData.contact_urgence_nom}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_nom: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.contact_urgence_telephone}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_telephone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Lien</label>
                    <select
                      value={formData.contact_urgence_lien}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_lien: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Conjoint">Conjoint(e)</option>
                      <option value="Parent">Parent</option>
                      <option value="Enfant">Enfant</option>
                      <option value="Ami">Ami(e)</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section Permis de conduire */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Permis de conduire</h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="a_permis_conduire"
                    checked={formData.a_permis_conduire}
                    onChange={(e) => setFormData({ ...formData, a_permis_conduire: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="a_permis_conduire" className="text-sm text-gray-300 cursor-pointer">
                    Le collaborateur a le permis de conduire
                  </label>
                </div>

                {formData.a_permis_conduire && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie</label>
                      <select
                        value={formData.permis_categorie}
                        onChange={(e) => setFormData({ ...formData, permis_categorie: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="">Sélectionner</option>
                        <option value="A">A (Moto)</option>
                        <option value="B">B (Voiture)</option>
                        <option value="C">C (Poids lourd)</option>
                        <option value="D">D (Transport en commun)</option>
                        <option value="BE">BE (Remorque)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Date d'obtention</label>
                      <input
                        type="date"
                        value={formData.permis_date_obtention}
                        onChange={(e) => setFormData({ ...formData, permis_date_obtention: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section Génération contrat */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="generer_contrat"
                    checked={formData.generer_contrat}
                    onChange={(e) => setFormData({ ...formData, generer_contrat: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="generer_contrat" className="text-sm text-gray-300 cursor-pointer flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Générer le contrat de travail en bonne et due forme
                  </label>
                </div>
                {formData.generer_contrat && (
                  <p className="text-xs text-gray-400 mt-2 ml-6">
                    Un contrat de travail PDF sera généré automatiquement après la création du collaborateur.
                  </p>
                )}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-300">
                  ✅ La création est automatique : compte auth.users, utilisateurs et collaborateurs seront créés en une seule opération.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  Créer le Collaborateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire Modal - Modifier Collaborateur */}
      {showEditForm && editingCollaborateur && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Modifier un Collaborateur</h2>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingCollaborateur(null);
                }}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">L'email ne peut pas être modifié</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rôle *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial' | 'super_admin' })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="collaborateur">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                  <option value="manager">Manager</option>
                  <option value="comptable">Comptable</option>
                  <option value="commercial">Commercial</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Département</label>
                <input
                  type="text"
                  value={formData.departement}
                  onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: IT, Finance, Ventes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Poste</label>
                <input
                  type="text"
                  value={formData.poste}
                  onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ex: Développeur, Comptable, Commercial..."
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                  <select
                    value={formData.entreprise_id}
                    onChange={(e) => setFormData({ ...formData, entreprise_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Aucune entreprise</option>
                    {entreprises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {isClient && clientEntrepriseId && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                  <input
                    type="text"
                    value={entreprises.find(e => e.id === clientEntrepriseId)?.nom || 'Votre entreprise'}
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date d'embauche</label>
                  <input
                    type="date"
                    value={formData.date_embauche}
                    onChange={(e) => setFormData({ ...formData, date_embauche: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Salaire (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salaire}
                    onChange={(e) => setFormData({ ...formData, salaire: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Section Informations professionnelles */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations professionnelles</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">N° Sécurité Sociale</label>
                    <input
                      type="text"
                      value={formData.numero_securite_sociale}
                      onChange={(e) => setFormData({ ...formData, numero_securite_sociale: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="1 85 07 75 123 45 67"
                      maxLength={15}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code URSSAF</label>
                    <input
                      type="text"
                      value={formData.code_urssaf}
                      onChange={(e) => setFormData({ ...formData, code_urssaf: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Code URSSAF"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Emploi</label>
                    <input
                      type="text"
                      value={formData.emploi}
                      onChange={(e) => setFormData({ ...formData, emploi: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: Développeur, Comptable..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Échelon</label>
                    <input
                      type="text"
                      value={formData.echelon}
                      onChange={(e) => setFormData({ ...formData, echelon: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: E1, E2, E3..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Convention Collective</label>
                    <input
                      type="text"
                      value={formData.convention_collective_numero}
                      onChange={(e) => {
                        const value = e.target.value;
                        const selected = conventionsCollectives.find(c => c.code_idcc === value);
                        setFormData({ 
                          ...formData, 
                          convention_collective_numero: value,
                          convention_collective_nom: selected?.libelle || ''
                        });
                        // Filtrer les conventions selon la saisie
                        if (value.length > 0) {
                          const filtered = conventionsCollectives.filter(cc => 
                            cc.code_idcc.toLowerCase().includes(value.toLowerCase()) ||
                            cc.libelle.toLowerCase().includes(value.toLowerCase())
                          ).slice(0, 10); // Limiter à 10 résultats
                          setFilteredConventions(filtered);
                          setShowConventionsList(true);
                        } else {
                          setFilteredConventions(conventionsCollectives.slice(0, 10));
                          setShowConventionsList(true);
                        }
                      }}
                      onFocus={() => setShowConventionsList(true)}
                      onBlur={() => setTimeout(() => setShowConventionsList(false), 200)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Rechercher (ex: IDCC1486 ou Syntec)"
                    />
                    {showConventionsList && filteredConventions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredConventions.map((cc) => (
                          <div
                            key={cc.code_idcc}
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                convention_collective_numero: cc.code_idcc,
                                convention_collective_nom: cc.libelle
                              });
                              setShowConventionsList(false);
                            }}
                            className="px-4 py-2 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0"
                          >
                            <div className="font-semibold text-white">{cc.code_idcc}</div>
                            <div className="text-xs text-gray-400 truncate">{cc.libelle}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Matricule</label>
                    <input
                      type="text"
                      value={formData.matricule}
                      onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Matricule"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date d'entrée</label>
                    <input
                      type="date"
                      value={formData.date_entree}
                      onChange={(e) => setFormData({ ...formData, date_entree: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Coefficient</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.coefficient}
                      onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Ex: 200, 250..."
                    />
                  </div>
                </div>
              </div>

              {/* Section Informations de contrat */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations de contrat</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Type de contrat</label>
                    <select
                      value={formData.type_contrat}
                      onChange={(e) => setFormData({ ...formData, type_contrat: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Stage">Stage</option>
                      <option value="Alternance">Alternance</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Interim">Intérim</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Statut professionnel</label>
                    <select
                      value={formData.statut_professionnel}
                      onChange={(e) => setFormData({ ...formData, statut_professionnel: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Stage">Stage</option>
                      <option value="Alternance">Alternance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Heures hebdo</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.nombre_heures_hebdo}
                      onChange={(e) => setFormData({ ...formData, nombre_heures_hebdo: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="35"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Heures mensuelles</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.nombre_heures_mensuelles}
                      onChange={(e) => setFormData({ ...formData, nombre_heures_mensuelles: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="151.67"
                    />
                    <p className="text-xs text-gray-400 mt-1">Calculé auto si vide</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Forfait jours</label>
                    <input
                      type="number"
                      value={formData.forfait_jours}
                      onChange={(e) => setFormData({ ...formData, forfait_jours: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="218"
                    />
                    <p className="text-xs text-gray-400 mt-1">Pour cadres</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="est_cadre_edit"
                    checked={formData.est_cadre}
                    onChange={(e) => setFormData({ ...formData, est_cadre: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="est_cadre_edit" className="text-sm text-gray-300 cursor-pointer">
                    Cadre
                  </label>
                </div>

                {/* Fonctions du poste */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description détaillée des fonctions du poste</label>
                  <textarea
                    value={formData.fonctions_poste}
                    onChange={(e) => setFormData({ ...formData, fonctions_poste: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Décrivez en détail les missions principales, les responsabilités, les compétences requises, les objectifs de performance, les relations hiérarchiques..."
                    rows={6}
                  />
                  <p className="text-xs text-gray-400 mt-1">Cette description sera incluse dans le contrat de travail (6-10 pages)</p>
                </div>

                {/* Lieu de travail et autres infos */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Lieu de travail</label>
                    <input
                      type="text"
                      value={formData.lieu_travail}
                      onChange={(e) => setFormData({ ...formData, lieu_travail: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Adresse du lieu de travail principal"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Période d'essai (jours)</label>
                    <input
                      type="number"
                      value={formData.periode_essai_jours}
                      onChange={(e) => setFormData({ ...formData, periode_essai_jours: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder={formData.est_cadre ? "90" : "30"}
                    />
                    <p className="text-xs text-gray-400 mt-1">Défaut: {formData.est_cadre ? '90 jours (cadre)' : '30 jours (non-cadre)'}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Horaires de travail</label>
                  <input
                    type="text"
                    value={formData.horaires_travail}
                    onChange={(e) => setFormData({ ...formData, horaires_travail: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ex: Lundi-Vendredi 9h-18h avec pause déjeuner 12h-13h"
                  />
                </div>
              </div>

              {/* Section Mutuelle */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Mutuelle</h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="a_mutuelle_edit"
                    checked={formData.a_mutuelle}
                    onChange={(e) => setFormData({ ...formData, a_mutuelle: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="a_mutuelle_edit" className="text-sm text-gray-300 cursor-pointer">
                    Le collaborateur a une mutuelle
                  </label>
                </div>

                {formData.a_mutuelle && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nom de la mutuelle</label>
                      <input
                        type="text"
                        value={formData.mutuelle_nom}
                        onChange={(e) => setFormData({ ...formData, mutuelle_nom: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Ex: MGEN, Harmonie Mutuelle"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">N° adhérent</label>
                      <input
                        type="text"
                        value={formData.mutuelle_numero_adherent}
                        onChange={(e) => setFormData({ ...formData, mutuelle_numero_adherent: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Numéro d'adhérent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section Informations personnelles */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Informations personnelles</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date de naissance</label>
                  <input
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Numéro et rue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code postal</label>
                    <input
                      type="text"
                      value={formData.code_postal}
                      onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="75001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
                    <input
                      type="text"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Paris"
                    />
                  </div>
                </div>
              </div>

              {/* Section Coordonnées bancaires */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Coordonnées bancaires</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">IBAN</label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                    maxLength={34}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">BIC</label>
                  <input
                    type="text"
                    value={formData.bic}
                    onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    placeholder="ABCDEFGH"
                    maxLength={11}
                  />
                </div>
              </div>

              {/* Section Contact d'urgence */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Contact d'urgence</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={formData.contact_urgence_prenom}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_prenom: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                    <input
                      type="text"
                      value={formData.contact_urgence_nom}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_nom: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.contact_urgence_telephone}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_telephone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Lien</label>
                    <select
                      value={formData.contact_urgence_lien}
                      onChange={(e) => setFormData({ ...formData, contact_urgence_lien: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Conjoint">Conjoint(e)</option>
                      <option value="Parent">Parent</option>
                      <option value="Enfant">Enfant</option>
                      <option value="Ami">Ami(e)</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section Permis de conduire */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Permis de conduire</h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="a_permis_conduire_edit"
                    checked={formData.a_permis_conduire}
                    onChange={(e) => setFormData({ ...formData, a_permis_conduire: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="a_permis_conduire_edit" className="text-sm text-gray-300 cursor-pointer">
                    Le collaborateur a le permis de conduire
                  </label>
                </div>

                {formData.a_permis_conduire && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie</label>
                      <select
                        value={formData.permis_categorie}
                        onChange={(e) => setFormData({ ...formData, permis_categorie: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="">Sélectionner</option>
                        <option value="A">A (Moto)</option>
                        <option value="B">B (Voiture)</option>
                        <option value="C">C (Poids lourd)</option>
                        <option value="D">D (Transport en commun)</option>
                        <option value="BE">BE (Remorque)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Date d'obtention</label>
                      <input
                        type="date"
                        value={formData.permis_date_obtention}
                        onChange={(e) => setFormData({ ...formData, permis_date_obtention: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingCollaborateur(null);
                  }}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

