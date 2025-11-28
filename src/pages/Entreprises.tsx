import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Plus, Building2, Edit, Trash2, X } from 'lucide-react';
import { PaymentChoiceModal } from '../components/PaymentChoiceModal';

interface Entreprise {
  id: string;
  nom: string;
  forme_juridique: string;
  siret?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  statut: string;
  created_at: string;
}

export default function Entreprises() {
  const { user } = useAuth();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    forme_juridique: 'SARL',
    siret: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    capital: 0,
    rcs: '',
    site_web: '',
    // Nouvelles options de création automatisée
    creer_client: false,
    email_client: '',
    nom_client: '',
    prenom_client: '',
    telephone_client: '',
    password_client: '',
    adresse_client: '',
    code_postal_client: '',
    ville_client: '',
    plan_id: '',
    creer_client_super_admin: true,
    envoyer_email: true,
  });
  
  const [plans, setPlans] = useState<Array<{ id: string; nom: string }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPaiementId, setCurrentPaiementId] = useState<string | null>(null);
  const [currentPaiementMontant, setCurrentPaiementMontant] = useState<number>(0);
  const [currentEntrepriseNom, setCurrentEntrepriseNom] = useState<string>('');
  useEffect(() => {
    if (user) {
      loadEntreprises();
      loadPlans();
    }
  }, [user]);
  
  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from('plans_abonnement')
        .select('id, nom')
        .eq('actif', true)
        .order('prix_mensuel', { ascending: true });
      
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Erreur chargement plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      // Utiliser RLS pour filtrer automatiquement les entreprises de l'utilisateur
      const { data, error } = await supabase
        .from('entreprises')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntreprises(data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('❌ Vous devez être connecté pour créer une entreprise');
      return;
    }

    try {
      if (editingId) {
        // Mise à jour
        const { error } = await supabase
          .from('entreprises')
          .update({
            nom: formData.nom,
            forme_juridique: formData.forme_juridique,
            siret: formData.siret || null,
            email: formData.email || null,
            telephone: formData.telephone || null,
            adresse: formData.adresse || null,
            code_postal: formData.code_postal || null,
            ville: formData.ville || null,
            capital: formData.capital || 0,
            rcs: formData.rcs || null,
            site_web: formData.site_web || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) {
          console.error('Erreur détaillée UPDATE:', error);
          throw error;
        }
        alert('✅ Entreprise modifiée avec succès!');
      } else {
        // CRÉATION AUTOMATISÉE - Utiliser la fonction RPC unifiée
        const { data: result, error: creationError } = await supabase.rpc(
          'create_complete_entreprise_automated',
          {
            // Informations entreprise
            p_nom_entreprise: formData.nom.trim(),
            p_forme_juridique: formData.forme_juridique,
            p_siret: formData.siret?.trim() || null,
            p_email_entreprise: formData.email?.trim() || null,
            p_telephone_entreprise: formData.telephone?.trim() || null,
            p_adresse: formData.adresse?.trim() || null,
            p_code_postal: formData.code_postal?.trim() || null,
            p_ville: formData.ville?.trim() || null,
            p_capital: formData.capital || 0,
            p_rcs: formData.rcs?.trim() || null,
            p_site_web: formData.site_web?.trim() || null,
            
            // Informations client (si création client activée)
            p_email_client: formData.creer_client && formData.email_client?.trim() 
              ? formData.email_client.trim() 
              : null,
            p_nom_client: formData.creer_client && formData.nom_client?.trim()
              ? formData.nom_client.trim()
              : null,
            p_prenom_client: formData.creer_client && formData.prenom_client?.trim()
              ? formData.prenom_client.trim()
              : null,
            p_telephone_client: formData.creer_client && formData.telephone_client?.trim()
              ? formData.telephone_client.trim()
              : null,
            p_adresse_client: formData.creer_client && formData.adresse_client?.trim()
              ? formData.adresse_client.trim()
              : null,
            p_code_postal_client: formData.creer_client && formData.code_postal_client?.trim()
              ? formData.code_postal_client.trim()
              : null,
            p_ville_client: formData.creer_client && formData.ville_client?.trim()
              ? formData.ville_client.trim()
              : null,
            p_password_client: formData.creer_client && formData.password_client?.trim()
              ? formData.password_client.trim()
              : null,
            
            // Abonnement
            p_plan_id: formData.plan_id?.trim() || null,
            p_options_ids: null, // TODO: Ajouter sélection d'options
            
            // Options
            p_creer_client_super_admin: formData.creer_client_super_admin,
            p_envoyer_email: formData.envoyer_email && formData.creer_client,
          }
        );

        if (creationError) {
          console.error('❌ Erreur création automatisée:', creationError);
          throw new Error(`Erreur lors de la création: ${creationError.message || 'Erreur inconnue'}`);
        }

        if (!result || !result.success) {
          const errorMsg = result?.error || result?.message || 'Erreur inconnue';
          throw new Error(errorMsg);
        }

        // Afficher le résultat
        let message = '✅ Entreprise créée avec succès!\n\n';
        
        if (result.client_id) {
          message += `📧 Client créé\n`;
          message += `🎯 Espace membre créé\n`;
          
          if (result.email && result.password) {
            // Envoyer l'email si activé
            if (formData.envoyer_email && result.email_a_envoyer && result.client_id) {
              try {
                // Importer le service email
                const { sendClientCredentialsEmail } = await import('../services/emailService');
                
                await sendClientCredentialsEmail({
                  clientEmail: result.email,
                  email: result.email,
                  password: formData.password_client || result.password || '',
                  clientName: formData.nom_client || 'Client',
                  clientPrenom: formData.prenom_client || '',
                  entrepriseNom: formData.nom,
                });
                
                message += `\n📧 Email envoyé automatiquement au client`;
              } catch (emailError) {
                console.error('❌ Erreur envoi email:', emailError);
                message += `\n⚠️ Email non envoyé: ${emailError instanceof Error ? emailError.message : 'Erreur inconnue'}`;
                message += `\n📨 Identifiants à envoyer manuellement:\n`;
                message += `Email: ${result.email}\n`;
                message += `Mot de passe: ${formData.password_client || result.password || 'Généré automatiquement'}`;
              }
            } else {
              message += `\n📨 Identifiants:\n`;
              message += `Email: ${result.email}\n`;
              message += `Mot de passe: ${formData.password_client || result.password || 'Généré automatiquement'}\n`;
              message += `\n💡 Pensez à envoyer ces identifiants au client`;
            }
          }
        }
        
        if (result.abonnement_id) {
          message += `\n💳 Abonnement créé et actif`;
        }

        // ✅ Si un paiement_id est retourné, ouvrir le modal de paiement
        if (result.paiement_id && result.montant_ttc) {
          console.log('💰 Paiement créé, ouverture du modal de paiement...');
          console.log('   Paiement ID:', result.paiement_id);
          console.log('   Montant TTC:', result.montant_ttc);
          console.log('   Entreprise:', result.entreprise_nom);
          
          // Ouvrir le modal de paiement
          setCurrentPaiementId(result.paiement_id);
          setCurrentPaiementMontant(result.montant_ttc);
          setCurrentEntrepriseNom(result.entreprise_nom || formData.nom);
          setShowPaymentModal(true);
          
          // Fermer le formulaire mais ne pas recharger les entreprises encore
          setShowForm(false);
          resetForm();
        } else {
          // Pas de paiement, afficher le message et fermer
          alert(message);
          setShowForm(false);
          setEditingId(null);
          resetForm();
          await loadEntreprises();
        }
      }
    } catch (error: unknown) {
      console.error('❌ Erreur complète sauvegarde entreprise:', error);
      
      // Message d'erreur détaillé pour le débogage
      let errorMessage = 'Erreur inconnue';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const errObj = error as { message?: string; error?: string; details?: string };
        errorMessage = errObj.message || errObj.error || errObj.details || 'Erreur inconnue';
      }
      
      alert(`❌ Erreur lors de la sauvegarde: ${errorMessage}`);
    }
  };

  const handleEdit = (entreprise: Entreprise) => {
    setEditingId(entreprise.id);
    setFormData({
      nom: entreprise.nom,
      forme_juridique: entreprise.forme_juridique,
      siret: entreprise.siret || '',
      email: entreprise.email || '',
      telephone: entreprise.telephone || '',
      adresse: '',
      code_postal: '',
      ville: entreprise.ville || '',
      capital: 0,
      rcs: '',
      site_web: entreprise.site_web || '',
      creer_client: false,
      email_client: '',
      nom_client: '',
      prenom_client: '',
      telephone_client: '',
      password_client: '',
      adresse_client: '',
      code_postal_client: '',
      ville_client: '',
      plan_id: '',
      creer_client_super_admin: true,
      envoyer_email: true,
      site_web: '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette entreprise ?\n\nCette action supprimera également:\n- Tous les clients liés\n- Tous les espaces membres clients\n- Tous les abonnements\n\nCette action est irréversible.')) return;
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('delete_entreprise_complete', { p_entreprise_id: id });

      if (error) throw error;
      
      if (data?.success) {
        alert(`✅ ${data.message || 'Entreprise supprimée avec succès'}`);
      } else {
        throw new Error(data?.error || 'Erreur lors de la suppression');
      }
      
      await loadEntreprises();
    } catch (error: unknown) {
      console.error('Erreur suppression:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert('❌ Erreur lors de la suppression: ' + errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      forme_juridique: 'SARL',
      siret: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      capital: 0,
      rcs: '',
      site_web: '',
      creer_client: false,
      email_client: '',
      nom_client: '',
      prenom_client: '',
      telephone_client: '',
      password_client: '',
      adresse_client: '',
      code_postal_client: '',
      ville_client: '',
      plan_id: '',
      creer_client_super_admin: true,
      envoyer_email: true,
    });
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mon Entreprise</h1>
          <p className="text-gray-300">Gérez les informations de votre entreprise</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Ajouter une entreprise
        </button>
      </div>

      {/* Liste des entreprises */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entreprises.map((entreprise) => (
          <div
            key={entreprise.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{entreprise.nom}</h3>
                  <p className="text-sm text-gray-400">{entreprise.forme_juridique}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  entreprise.statut === 'active'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {entreprise.statut}
              </span>
            </div>

            {entreprise.siret && (
              <p className="text-sm text-gray-300 mb-2">SIRET: {entreprise.siret}</p>
            )}
            {entreprise.ville && (
              <p className="text-sm text-gray-300 mb-2">{entreprise.ville}</p>
            )}

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => handleEdit(entreprise)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => handleDelete(entreprise.id)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {entreprises.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Aucune entreprise créée</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Créer votre première entreprise
          </button>
        </div>
      )}

      {/* Formulaire Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
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
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ma Société SARL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Forme juridique *
                  </label>
                  <select
                    value={formData.forme_juridique}
                    onChange={(e) => setFormData({ ...formData, forme_juridique: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SARL">SARL</option>
                    <option value="SAS">SAS</option>
                    <option value="SASU">SASU</option>
                    <option value="EURL">EURL</option>
                    <option value="SA">SA</option>
                    <option value="SNC">SNC</option>
                    <option value="Auto-entrepreneur">Auto-entrepreneur</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SIRET</label>
                  <input
                    type="text"
                    value={formData.siret}
                    onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678901234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contact@entreprise.fr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Rue Example"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Code postal</label>
                  <input
                    type="text"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
                  <input
                    type="text"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paris"
                  />
                </div>
              </div>

              {/* Section création automatique du client */}
              {!editingId && (
                <>
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="creer_client"
                        checked={formData.creer_client}
                        onChange={(e) => setFormData({ ...formData, creer_client: e.target.checked })}
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="creer_client" className="text-lg font-semibold text-white cursor-pointer">
                        🚀 Créer automatiquement le client et l'espace membre
                      </label>
                    </div>
                    <p className="text-sm text-gray-400 ml-8 mb-4">
                      Activez cette option pour créer automatiquement le client, l'espace membre, l'abonnement et envoyer les identifiants par email.
                    </p>
                  </div>

                  {formData.creer_client && (
                    <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="text-lg font-semibold text-white mb-4">Informations du client</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Email client *
                          </label>
                          <input
                            type="email"
                            value={formData.email_client}
                            onChange={(e) => setFormData({ ...formData, email_client: e.target.value })}
                            required={formData.creer_client}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="client@example.com"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nom client *
                          </label>
                          <input
                            type="text"
                            value={formData.nom_client}
                            onChange={(e) => setFormData({ ...formData, nom_client: e.target.value })}
                            required={formData.creer_client}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Dupont"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Prénom client *
                          </label>
                          <input
                            type="text"
                            value={formData.prenom_client}
                            onChange={(e) => setFormData({ ...formData, prenom_client: e.target.value })}
                            required={formData.creer_client}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Jean"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Téléphone client
                          </label>
                          <input
                            type="tel"
                            value={formData.telephone_client}
                            onChange={(e) => setFormData({ ...formData, telephone_client: e.target.value })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="+33 6 12 34 56 78"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Mot de passe client (optionnel)
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={formData.password_client}
                              onChange={(e) => setFormData({ ...formData, password_client: e.target.value })}
                              className="w-full px-4 py-3 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Laissez vide pour générer automatiquement"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            Si vide, un mot de passe sécurisé sera généré automatiquement
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Plan d'abonnement (optionnel)
                        </label>
                        <select
                          value={formData.plan_id}
                          onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={loadingPlans}
                        >
                          <option value="">Aucun plan (modules de base uniquement)</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.nom}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-6 pt-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="creer_client_super_admin"
                            checked={formData.creer_client_super_admin}
                            onChange={(e) => setFormData({ ...formData, creer_client_super_admin: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500"
                          />
                          <label htmlFor="creer_client_super_admin" className="text-sm text-gray-300 cursor-pointer">
                            Créer le client comme Super Admin
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="envoyer_email"
                            checked={formData.envoyer_email}
                            onChange={(e) => setFormData({ ...formData, envoyer_email: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500"
                          />
                          <label htmlFor="envoyer_email" className="text-sm text-gray-300 cursor-pointer">
                            Envoyer les identifiants par email
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

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

      {/* Modal de choix de paiement */}
      {showPaymentModal && currentPaiementId && (
        <PaymentChoiceModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setCurrentPaiementId(null);
            setCurrentPaiementMontant(0);
            setCurrentEntrepriseNom('');
            loadEntreprises(); // Recharger les entreprises après fermeture
          }}
          paiementId={currentPaiementId}
          montant={currentPaiementMontant}
          entrepriseNom={currentEntrepriseNom}
          onPaymentMethodChosen={(method) => {
            console.log('💳 Méthode de paiement choisie:', method);
            if (method === 'virement') {
              // Pour virement, fermer le modal et recharger
              setShowPaymentModal(false);
              setCurrentPaiementId(null);
              setCurrentPaiementMontant(0);
              setCurrentEntrepriseNom('');
              loadEntreprises();
            }
            // Pour carte, la redirection vers Stripe se fait dans le modal
          }}
        />
      )}

    </div>
  );
}
