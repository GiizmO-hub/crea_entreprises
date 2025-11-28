/**
 * ClientDetailsModal - Modal pour afficher et modifier toutes les informations d'un client
 * 
 * Affiche toutes les informations modifiables d'un client avec vérification des permissions
 */

import { useState, useEffect } from 'react';
import { X, Save, User, Mail, MapPin, Building2, FileText, Tag, Lock, CheckCircle, AlertCircle, CreditCard, Package, Settings, Puzzle, KeyRound, RefreshCw, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientDetailsModalProps {
  clientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface Plan {
  id: string;
  nom: string;
  description: string | null;
  prix_mensuel: number;
  prix_annuel: number;
}

interface Option {
  id: string;
  nom: string;
  description: string | null;
  prix_mensuel: number;
  type: string;
  actif: boolean;
}

interface ClientData {
  id: string;
  entreprise_id: string;
  nom: string | null;
  prenom: string | null;
  entreprise_nom: string | null;
  email: string | null;
  telephone: string | null;
  portable: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string | null;
  siret: string | null;
  tva_intracommunautaire: string | null;
  statut: string | null;
  notes: string | null;
  tags: string[] | null;
  role_code?: string;
  role_nom?: string;
  espace_actif?: boolean;
  espace_id?: string | null;
  // Abonnement
  abonnement_id?: string | null;
  plan_id?: string | null;
  abonnement_statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  date_prochain_paiement?: string | null;
  montant_mensuel?: number | null;
  mode_paiement?: string | null;
  // Modules
  modules_actifs?: Record<string, boolean>;
  // Options
  options_actives?: string[];
  // Préférences
  preferences?: {
    theme?: string;
    langue?: string;
    notifications?: boolean;
    affichage_complet?: boolean;
  };
}

export function ClientDetailsModal({ clientId, isOpen, onClose, onUpdate }: ClientDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  
  // États pour les données de référence
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  
  // Modules disponibles
  const availableModules = [
    { code: 'tableau_de_bord', label: 'Tableau de bord' },
    { code: 'mon_entreprise', label: 'Mon entreprise' },
    { code: 'gestion_clients', label: 'Gestion clients' },
    { code: 'facturation', label: 'Facturation' },
    { code: 'finances', label: 'Finances' },
    { code: 'messages', label: 'Messages' },
    { code: 'automatisation', label: 'Automatisation' },
    { code: 'parametres', label: 'Paramètres' },
    { code: 'documents', label: 'Documents' },
    { code: 'gestion_projets', label: 'Gestion de projets' },
    { code: 'collaborateurs', label: 'Collaborateurs' },
  ];

  const [formData, setFormData] = useState<ClientData>({
    id: '',
    entreprise_id: '',
    nom: null,
    prenom: null,
    entreprise_nom: null,
    email: null,
    telephone: null,
    portable: null,
    adresse: null,
    code_postal: null,
    ville: null,
    pays: null,
    siret: null,
    tva_intracommunautaire: null,
    statut: null,
    notes: null,
    tags: null,
  });

  // Vérifier les permissions au chargement
  useEffect(() => {
    if (isOpen && clientId) {
      checkPermission();
      loadPlans();
      loadOptions();
      loadClientData();
    }
  }, [isOpen, clientId]);
  
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
        .select('id, nom, description, prix_mensuel, type, actif')
        .eq('actif', true)
        .order('nom');
      
      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Erreur chargement options:', error);
    }
  };

  const checkPermission = async () => {
    setCheckingPermission(true);
    try {
      // Vérifier si l'utilisateur a la permission "paramètre clients"
      // Pour l'instant, on vérifie si c'est un super_admin plateforme
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasPermission(false);
        return;
      }

      // Vérifier le rôle dans utilisateurs
      const { data: utilisateur } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      // Super admin plateforme a toujours accès
      if (utilisateur?.role === 'super_admin') {
        setHasPermission(true);
        return;
      }

      // Vérifier via RPC si disponible (si la fonction existe)
      try {
        const { data: hasAccess } = await supabase.rpc('check_module_access', {
          module_code: 'parametres_clients'
        });
        setHasPermission(hasAccess === true || utilisateur?.role === 'super_admin');
      } catch {
        // Si la fonction n'existe pas, utiliser la vérification par rôle
        setHasPermission(utilisateur?.role === 'super_admin' || false);
      }
    } catch (err) {
      console.error('Erreur vérification permission:', err);
      setHasPermission(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  const loadClientData = async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);

    try {
      // Charger toutes les informations du client depuis clients_with_roles
      const { data: clientData, error: clientError } = await supabase
        .from('clients_with_roles')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      // Charger l'espace membre avec modules et préférences
      const { data: espaceData } = await supabase
        .from('espaces_membres_clients')
        .select('id, actif, modules_actifs, preferences, abonnement_id')
        .eq('client_id', clientId)
        .single();

      // Charger l'abonnement et le plan avec fonctionnalités
      let abonnementData = null;
      let planData = null;
      
      if (espaceData?.abonnement_id) {
        const { data: abonnement } = await supabase
          .from('abonnements')
          .select('id, plan_id, statut, date_debut, date_fin, date_prochain_paiement, montant_mensuel, mode_paiement, client_id')
          .eq('id', espaceData.abonnement_id)
          .single();
        abonnementData = abonnement;
        
        if (abonnement?.plan_id) {
          const { data: plan } = await supabase
            .from('plans_abonnement')
            .select('id, nom, fonctionnalites')
            .eq('id', abonnement.plan_id)
            .single();
          planData = plan;
        }
      } else {
        // Chercher l'abonnement via client_id (auth.users.id)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: abonnement } = await supabase
            .from('abonnements')
            .select('id, plan_id, statut, date_debut, date_fin, date_prochain_paiement, montant_mensuel, mode_paiement, client_id')
            .eq('client_id', user.id)
            .eq('entreprise_id', clientData.entreprise_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          abonnementData = abonnement;
          
          if (abonnement?.plan_id) {
            const { data: plan } = await supabase
              .from('plans_abonnement')
              .select('id, nom, fonctionnalites')
              .eq('id', abonnement.plan_id)
              .single();
            planData = plan;
          }
        }
      }
      
      // Synchroniser les modules avec le plan d'abonnement
      let modulesActifs = espaceData?.modules_actifs || {};
      
      if (planData?.fonctionnalites && typeof planData.fonctionnalites === 'object') {
        // Mapping des fonctionnalités du plan vers les modules
        const planFeatures = planData.fonctionnalites as Record<string, boolean>;
        
        // Mapper les fonctionnalités du plan vers les codes de modules
        const featureToModuleMap: Record<string, string> = {
          'dashboard': 'tableau_de_bord',
          'facturation': 'facturation',
          'clients': 'gestion_clients',
          'comptabilite': 'finances',
          'salaries': 'collaborateurs',
          'automatisations': 'automatisation',
          'administration': 'parametres',
        };
        
        // Créer un objet modules_actifs basé sur le plan
        const modulesFromPlan: Record<string, boolean> = {};
        
        // Parcourir toutes les fonctionnalités du plan
        for (const [feature, isActive] of Object.entries(planFeatures)) {
          if (isActive) {
            const moduleCode = featureToModuleMap[feature] || feature;
            modulesFromPlan[moduleCode] = true;
          }
        }
        
        // Pour le plan Enterprise, activer TOUS les modules clients
        if (planData.nom === 'Enterprise' || planData.nom === 'Entreprise') {
          // Activer explicitement tous les modules clients (pas ceux réservés à la plateforme)
          modulesFromPlan['tableau_de_bord'] = true;
          modulesFromPlan['mon_entreprise'] = true;
          modulesFromPlan['gestion_clients'] = true;
          modulesFromPlan['facturation'] = true;
          modulesFromPlan['finances'] = true;
          modulesFromPlan['messages'] = true;
          modulesFromPlan['automatisation'] = true;
          modulesFromPlan['documents'] = true;
          modulesFromPlan['gestion_projets'] = true;
          modulesFromPlan['collaborateurs'] = true;
          // Note: 'parametres' est réservé à la plateforme, pas activé pour les clients
        }
        
        // Fusionner avec les modules existants (priorité AU PLAN pour garantir la cohérence)
        // Le plan définit ce qui doit être activé, pas la base de données
        modulesActifs = { ...modulesFromPlan, ...modulesActifs };
        
        console.log('📦 Modules synchronisés:', {
          plan: planData.nom,
          features: planFeatures,
          modulesFromPlan,
          modulesActifsFinal: modulesActifs,
        });
        
        // Synchroniser les modules dans la base de données via RPC si disponible
        if (espaceData?.id && abonnementData?.plan_id) {
          try {
            const { error: syncError } = await supabase.rpc('sync_client_modules_from_plan', {
              p_client_id: clientId,
              p_plan_id: abonnementData.plan_id,
            });
            
            if (syncError) {
              console.warn('⚠️ Fonction sync_client_modules_from_plan non disponible ou erreur:', syncError.message);
            } else {
              console.log('✅ Modules synchronisés dans la base de données');
              
              // Recharger les modules mis à jour depuis la base
              const { data: updatedEspace } = await supabase
                .from('espaces_membres_clients')
                .select('modules_actifs')
                .eq('id', espaceData.id)
                .single();
              
              if (updatedEspace?.modules_actifs) {
                modulesActifs = { ...modulesFromPlan, ...updatedEspace.modules_actifs };
              }
            }
          } catch (err: any) {
            console.warn('⚠️ Erreur synchronisation modules (non bloquant):', err?.message);
          }
        }
      } else {
        console.log('⚠️ Aucun plan trouvé pour synchroniser les modules');
      }

      // Charger les options actives
      let optionsActives: string[] = [];
      if (abonnementData?.id) {
        const { data: optionsData } = await supabase
          .from('abonnement_options')
          .select('option_id, actif')
          .eq('abonnement_id', abonnementData.id)
          .eq('actif', true);
        
        if (optionsData) {
          optionsActives = optionsData.map(o => o.option_id);
        }
      }

      // Charger les préférences par défaut si absentes
      const preferences = espaceData?.preferences || {
        theme: 'dark',
        langue: 'fr',
        notifications: true,
        affichage_complet: true,
      };

      setFormData({
        id: clientData.id,
        entreprise_id: clientData.entreprise_id,
        nom: clientData.nom || null,
        prenom: clientData.prenom || null,
        entreprise_nom: clientData.entreprise_nom || null,
        email: clientData.email || null,
        telephone: clientData.telephone || null,
        portable: clientData.portable || null,
        adresse: clientData.adresse || null,
        code_postal: clientData.code_postal || null,
        ville: clientData.ville || null,
        pays: clientData.pays || null,
        siret: clientData.siret || null,
        tva_intracommunautaire: clientData.tva_intracommunautaire || null,
        statut: clientData.statut || null,
        notes: clientData.notes || null,
        tags: clientData.tags || null,
        role_code: clientData.role_code,
        role_nom: clientData.role_nom,
        espace_actif: espaceData?.actif || false,
        espace_id: espaceData?.id || null,
        // Abonnement
        abonnement_id: abonnementData?.id || null,
        plan_id: abonnementData?.plan_id || null,
        abonnement_statut: abonnementData?.statut || null,
        date_debut: abonnementData?.date_debut || null,
        date_fin: abonnementData?.date_fin || null,
        date_prochain_paiement: abonnementData?.date_prochain_paiement || null,
        montant_mensuel: abonnementData?.montant_mensuel || null,
        mode_paiement: abonnementData?.mode_paiement || null,
        // Modules (synchronisés avec le plan)
        modules_actifs: modulesActifs,
        // Options
        options_actives: optionsActives,
        // Préférences
        preferences: preferences,
      });
    } catch (err: any) {
      console.error('Erreur chargement client:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasPermission) {
      setError('Vous n\'avez pas la permission de modifier ce client');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Préparer les données pour la sauvegarde
      const modulesActifsJsonb = formData.modules_actifs || {};
      const preferencesJsonb = formData.preferences || {
        theme: 'dark',
        langue: 'fr',
        notifications: true,
        affichage_complet: true,
      };
      
      // Convertir les options actives en UUIDs
      const optionsActivesUuids = (formData.options_actives || []).filter(id => id);

      // Mettre à jour via RPC pour gérer toutes les validations
      const { error: updateError } = await supabase.rpc('update_client_complete', {
        p_client_id: formData.id,
        // Informations client de base
        p_nom: formData.nom || null,
        p_prenom: formData.prenom || null,
        p_entreprise_nom: formData.entreprise_nom || null,
        p_email: formData.email || null,
        p_telephone: formData.telephone || null,
        p_portable: formData.portable || null,
        p_adresse: formData.adresse || null,
        p_code_postal: formData.code_postal || null,
        p_ville: formData.ville || null,
        p_pays: formData.pays || null,
        p_siret: formData.siret || null,
        p_tva_intracommunautaire: formData.tva_intracommunautaire || null,
        p_statut: formData.statut || null,
        p_notes: formData.notes || null,
        p_tags: formData.tags || null,
        // Abonnement
        p_plan_id: formData.plan_id || null,
        p_abonnement_statut: formData.abonnement_statut || null,
        p_date_debut: formData.date_debut || null,
        p_date_fin: formData.date_fin || null,
        p_date_prochain_paiement: formData.date_prochain_paiement || null,
        p_montant_mensuel: formData.montant_mensuel || null,
        p_mode_paiement: formData.mode_paiement || null,
        // Espace membre
        p_espace_actif: formData.espace_actif !== undefined ? formData.espace_actif : null,
        p_modules_actifs: modulesActifsJsonb,
        p_preferences: preferencesJsonb,
        // Options
        p_options_actives: optionsActivesUuids.length > 0 ? optionsActivesUuids : null,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onUpdate?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err);
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ClientData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Fonction pour envoyer un email
  const handleSendEmail = async (emailType: 'credentials' | 'credentials_reset' | 'subscription_change' | 'modules_update' | 'notification') => {
    if (!clientId || !formData.email) {
      setError('Email du client requis pour l\'envoi');
      return;
    }

    setSendingEmail(emailType);
    setEmailSuccess(null);
    setError(null);

    try {
      // Préparer les données selon le type d'email
      const emailData: any = {
        type: emailType,
        client_id: clientId,
        client_email: formData.email,
        client_nom: formData.nom || undefined,
        client_prenom: formData.prenom || undefined,
        entreprise_nom: formData.entreprise_nom || undefined,
        panel_url: window.location.origin + '/login',
      };

      // Données spécifiques selon le type
      switch (emailType) {
        case 'credentials':
          // Pour les identifiants, il faudrait générer un mot de passe ou le récupérer
          // Pour l'instant, on envoie juste une notification
          emailData.password = '***GÉNÉRÉ AUTOMATIQUEMENT***';
          break;
        case 'credentials_reset':
          emailData.password = '***NOUVEAU MOT DE PASSE***';
          break;
        case 'subscription_change':
          emailData.old_plan = 'Plan précédent'; // À récupérer depuis l'historique
          emailData.new_plan = plans.find(p => p.id === formData.plan_id)?.nom || formData.plan_id || 'Nouveau plan';
          break;
        case 'modules_update':
          emailData.modules_added = availableModules
            .filter(m => formData.modules_actifs?.[m.code])
            .map(m => m.label);
          break;
        case 'notification':
          emailData.notification_title = 'Notification importante';
          emailData.notification_message = `Bonjour ${formData.prenom || ''} ${formData.nom || ''},\n\nNous vous informons d'une mise à jour concernant votre compte.`;
          break;
      }

      // Appeler l'Edge Function via supabase.functions.invoke()
      const { data, error: invokeError } = await supabase.functions.invoke('send-client-email', {
        body: emailData,
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Erreur lors de l\'envoi de l\'email');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Erreur lors de l\'envoi de l\'email');
      }

      setEmailSuccess(`Email ${emailType} envoyé avec succès à ${formData.email}`);
      setTimeout(() => {
        setEmailSuccess(null);
      }, 5000);

    } catch (err: any) {
      console.error('Erreur envoi email:', err);
      setError(err.message || 'Erreur lors de l\'envoi de l\'email');
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setSendingEmail(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-purple-500/30">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <User className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Détails du Client</h2>
              <p className="text-sm text-gray-400">
                {formData.prenom} {formData.nom}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {checkingPermission ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Vérification des permissions...</p>
              </div>
            </div>
          ) : !hasPermission ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Lock className="w-16 h-16 text-red-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Accès refusé</h3>
              <p className="text-gray-400 text-center max-w-md">
                Vous n'avez pas la permission d'accéder aux paramètres clients.
                Veuillez contacter un administrateur pour obtenir cette autorisation.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Chargement des données...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Messages d'erreur/succès */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>Modifications enregistrées avec succès !</span>
                </div>
              )}

              {/* Informations personnelles */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Informations Personnelles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                    <input
                      type="text"
                      value={formData.nom || ''}
                      onChange={(e) => handleChange('nom', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={formData.prenom || ''}
                      onChange={(e) => handleChange('prenom', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Coordonnées */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-400" />
                  Coordonnées
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.telephone || ''}
                      onChange={(e) => handleChange('telephone', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Portable</label>
                    <input
                      type="tel"
                      value={formData.portable || ''}
                      onChange={(e) => handleChange('portable', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  Adresse
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                    <input
                      type="text"
                      value={formData.adresse || ''}
                      onChange={(e) => handleChange('adresse', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code Postal</label>
                    <input
                      type="text"
                      value={formData.code_postal || ''}
                      onChange={(e) => handleChange('code_postal', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
                    <input
                      type="text"
                      value={formData.ville || ''}
                      onChange={(e) => handleChange('ville', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Pays</label>
                    <input
                      type="text"
                      value={formData.pays || ''}
                      onChange={(e) => handleChange('pays', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Informations entreprise */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  Informations Entreprise
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom de l'entreprise</label>
                    <input
                      type="text"
                      value={formData.entreprise_nom || ''}
                      onChange={(e) => handleChange('entreprise_nom', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">SIRET</label>
                    <input
                      type="text"
                      value={formData.siret || ''}
                      onChange={(e) => handleChange('siret', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">TVA Intracommunautaire</label>
                    <input
                      type="text"
                      value={formData.tva_intracommunautaire || ''}
                      onChange={(e) => handleChange('tva_intracommunautaire', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Statut</label>
                    <select
                      value={formData.statut || ''}
                      onChange={(e) => handleChange('statut', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="actif">Actif</option>
                      <option value="suspendu">Suspendu</option>
                      <option value="inactif">Inactif</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Informations complémentaires */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Informations Complémentaires
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      placeholder="Notes internes sur le client..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tags (séparés par des virgules)</label>
                    <input
                      type="text"
                      value={formData.tags?.join(', ') || ''}
                      onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>
              </div>

              {/* Section Abonnement */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  Abonnement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plan d'abonnement</label>
                    <select
                      value={formData.plan_id || ''}
                      onChange={(e) => handleChange('plan_id', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="">Sélectionner un plan</option>
                      {plans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.nom} - {plan.prix_mensuel}€/mois ({plan.prix_annuel}€/an)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Statut</label>
                    <select
                      value={formData.abonnement_statut || ''}
                      onChange={(e) => handleChange('abonnement_statut', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="">Non défini</option>
                      <option value="actif">Actif</option>
                      <option value="suspendu">Suspendu</option>
                      <option value="annule">Annulé</option>
                      <option value="expire">Expiré</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date de début</label>
                    <input
                      type="date"
                      value={formData.date_debut || ''}
                      onChange={(e) => handleChange('date_debut', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date de fin</label>
                    <input
                      type="date"
                      value={formData.date_fin || ''}
                      onChange={(e) => handleChange('date_fin', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Prochain paiement</label>
                    <input
                      type="date"
                      value={formData.date_prochain_paiement || ''}
                      onChange={(e) => handleChange('date_prochain_paiement', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Montant mensuel (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.montant_mensuel || ''}
                      onChange={(e) => handleChange('montant_mensuel', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mode de paiement</label>
                    <select
                      value={formData.mode_paiement || ''}
                      onChange={(e) => handleChange('mode_paiement', e.target.value || null)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="">Non défini</option>
                      <option value="mensuel">Mensuel</option>
                      <option value="annuel">Annuel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Espace actif</label>
                    <div className="flex items-center gap-3 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.espace_actif || false}
                          onChange={(e) => handleChange('espace_actif', e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-300">{formData.espace_actif ? 'Actif' : 'Inactif'}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Modules */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Puzzle className="w-5 h-5 text-purple-400" />
                  Modules Actifs
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableModules.map(module => (
                    <label key={module.code} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-purple-500/30 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.modules_actifs?.[module.code] || false}
                        onChange={(e) => {
                          const newModules = {
                            ...formData.modules_actifs,
                            [module.code]: e.target.checked,
                          };
                          handleChange('modules_actifs', newModules);
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-300 text-sm">{module.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section Options */}
              {options.length > 0 && (
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    Options d'Abonnement
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {options.map(option => (
                      <label key={option.id} className="flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10 hover:border-purple-500/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.options_actives?.includes(option.id) || false}
                          onChange={(e) => {
                            const currentOptions = formData.options_actives || [];
                            const newOptions = e.target.checked
                              ? [...currentOptions, option.id]
                              : currentOptions.filter(id => id !== option.id);
                            handleChange('options_actives', newOptions);
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{option.nom}</span>
                            <span className="text-purple-400 font-semibold">{option.prix_mensuel}€/mois</span>
                          </div>
                          {option.description && (
                            <p className="text-gray-400 text-xs mt-1">{option.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Préférences */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Préférences
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Thème</label>
                    <select
                      value={formData.preferences?.theme || 'dark'}
                      onChange={(e) => {
                        const newPrefs = {
                          ...formData.preferences,
                          theme: e.target.value,
                        };
                        handleChange('preferences', newPrefs);
                      }}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="dark">Sombre</option>
                      <option value="light">Clair</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Langue</label>
                    <select
                      value={formData.preferences?.langue || 'fr'}
                      onChange={(e) => {
                        const newPrefs = {
                          ...formData.preferences,
                          langue: e.target.value,
                        };
                        handleChange('preferences', newPrefs);
                      }}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Notifications</label>
                    <div className="flex items-center gap-3 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.preferences?.notifications !== false}
                          onChange={(e) => {
                            const newPrefs = {
                              ...formData.preferences,
                              notifications: e.target.checked,
                            };
                            handleChange('preferences', newPrefs);
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-300">Activer les notifications</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Affichage complet</label>
                    <div className="flex items-center gap-3 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.preferences?.affichage_complet !== false}
                          onChange={(e) => {
                            const newPrefs = {
                              ...formData.preferences,
                              affichage_complet: e.target.checked,
                            };
                            handleChange('preferences', newPrefs);
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-300">Afficher tous les détails</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations système (lecture seule) */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-400" />
                  Informations Système
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Rôle</label>
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                      {formData.role_nom || formData.role_code || 'Client'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Espace Client</label>
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                      {formData.espace_actif ? '✅ Actif' : '⏸️ Inactif'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Envoi d'Emails */}
        {hasPermission && !loading && formData.email && (
          <div className="p-6 border-t border-white/10 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" />
              Envoyer un email au client
            </h3>
            
            {emailSuccess && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                ✅ {emailSuccess}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <button
                onClick={() => handleSendEmail('credentials')}
                disabled={sendingEmail !== null}
                className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-white text-sm font-medium flex flex-col items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail === 'credentials' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <KeyRound className="w-5 h-5 text-purple-400" />
                )}
                <span>Identifiants</span>
              </button>

              <button
                onClick={() => handleSendEmail('credentials_reset')}
                disabled={sendingEmail !== null}
                className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-white text-sm font-medium flex flex-col items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail === 'credentials_reset' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                )}
                <span>Réinit. mot de passe</span>
              </button>

              <button
                onClick={() => handleSendEmail('subscription_change')}
                disabled={sendingEmail !== null || !formData.plan_id}
                className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-white text-sm font-medium flex flex-col items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail === 'subscription_change' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <CreditCard className="w-5 h-5 text-purple-400" />
                )}
                <span>Changement abonnement</span>
              </button>

              <button
                onClick={() => handleSendEmail('modules_update')}
                disabled={sendingEmail !== null}
                className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-white text-sm font-medium flex flex-col items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail === 'modules_update' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Puzzle className="w-5 h-5 text-purple-400" />
                )}
                <span>Mise à jour modules</span>
              </button>

              <button
                onClick={() => handleSendEmail('notification')}
                disabled={sendingEmail !== null}
                className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-white text-sm font-medium flex flex-col items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail === 'notification' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Bell className="w-5 h-5 text-purple-400" />
                )}
                <span>Notification</span>
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400 text-center">
              Les emails sont envoyés via Resend à l'adresse : <strong className="text-purple-400">{formData.email}</strong>
            </p>
          </div>
        )}

        {/* Footer */}
        {hasPermission && !loading && (
          <div className="flex items-center justify-end gap-4 p-6 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

