import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Building2, Edit, Trash2, X, Copy, Mail } from 'lucide-react';

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

interface EntreprisesProps {
  onNavigate: (page: string) => void;
}

export default function Entreprises({ onNavigate: _onNavigate }: EntreprisesProps) {
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
  });
  const [createClientAuto, setCreateClientAuto] = useState(true);
  const [createEspaceMembre, setCreateEspaceMembre] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [options, setOptions] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [clientCredentials, setClientCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadEntreprises();
      loadPlans();
      loadOptions();
    }
  }, [user]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntreprises(data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans_abonnement')
        .select('id, nom, prix_mensuel')
        .eq('actif', true)
        .order('ordre');

      if (error) throw error;
      setPlans(data || []);
      if (data && data.length > 0 && !selectedPlan) {
        setSelectedPlan(data[0].id);
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingId) {
        // Mise à jour
        const { error } = await supabase
          .from('entreprises')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;
        alert('✅ Entreprise modifiée avec succès!');
      } else {
        // Création avec option automatique client + espace membre
        if (createClientAuto && !formData.email) {
          alert('❌ L\'email est obligatoire pour créer automatiquement le client et l\'espace membre');
          return;
        }

        // Créer l'entreprise
        const { data: entrepriseData, error: entrepriseError } = await supabase
          .from('entreprises')
          .insert({
            user_id: user.id,
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
            statut: 'active',
          })
          .select()
          .single();

        if (entrepriseError) throw entrepriseError;

        // Créer client et espace membre automatiquement si demandé
        if (createClientAuto && formData.email && entrepriseData) {
          // Créer le client avec les mêmes informations
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .insert({
              entreprise_id: entrepriseData.id,
              nom: formData.nom,
              prenom: '',
              entreprise_nom: formData.nom,
              email: formData.email,
              telephone: formData.telephone || null,
              adresse: formData.adresse || null,
              code_postal: formData.code_postal || null,
              ville: formData.ville || null,
              statut: 'active',
            })
            .select()
            .single();

          if (clientError) {
            console.error('Erreur création client:', clientError);
            alert('⚠️ Entreprise créée mais erreur lors de la création du client: ' + clientError.message);
          } else if (createEspaceMembre && clientData) {
            // Créer l'espace membre avec abonnement si demandé
            try {
              const password = Math.random().toString(36).slice(-12) + 'A1!';
              
              let planId = selectedPlan;
              if (!planId && plans.length > 0) {
                planId = plans[0].id;
              }

              const { data: espaceResult, error: espaceError } = await supabase.rpc(
                'create_espace_membre_from_client',
                {
                  p_client_id: clientData.id,
                  p_entreprise_id: entrepriseData.id,
                  p_password: password,
                  p_plan_id: planId || null,
                  p_options_ids: selectedOptions.length > 0 ? selectedOptions : null,
                }
              );

              if (espaceError) {
                console.error('Erreur création espace membre:', espaceError);
                alert('⚠️ Entreprise et client créés mais erreur lors de la création de l\'espace membre: ' + espaceError.message);
              } else if (espaceResult?.success) {
                // Afficher les identifiants
                setClientCredentials({
                  email: formData.email,
                  password: espaceResult.password || password,
                });
                setShowCredentialsModal(true);
              }
            } catch (espaceErr: any) {
              console.error('Erreur création espace membre:', espaceErr);
              alert('⚠️ Entreprise et client créés mais erreur lors de la création de l\'espace membre');
            }
          } else {
            alert('✅ Entreprise et client créés avec succès!');
          }
        } else {
          alert('✅ Entreprise créée avec succès!');
        }
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      await loadEntreprises();
    } catch (error: any) {
      console.error('Erreur sauvegarde entreprise:', error);
      alert('❌ Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
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
      site_web: '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entreprise ?')) return;
    if (!user) return;

    try {
      const { error } = await supabase
        .from('entreprises')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      loadEntreprises();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
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
    });
    setEditingId(null);
    setCreateClientAuto(true);
    setCreateEspaceMembre(true);
    setSelectedPlan('');
    setSelectedOptions([]);
    setShowCredentialsModal(false);
    setClientCredentials(null);
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
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

              {/* Options automatiques - uniquement pour la création */}
              {!editingId && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-300 mb-3">Options automatiques</h3>
                    
                    <label className="flex items-start gap-3 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={createClientAuto}
                        onChange={(e) => setCreateClientAuto(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded"
                      />
                      <div className="flex-1">
                        <span className="text-white font-medium">Créer automatiquement un client</span>
                        <p className="text-xs text-gray-400 mt-1">
                          Un client sera créé avec les mêmes informations que l'entreprise
                        </p>
                      </div>
                    </label>

                    {createClientAuto && (
                      <div className="ml-7 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createEspaceMembre}
                            onChange={(e) => setCreateEspaceMembre(e.target.checked)}
                            disabled={!formData.email}
                            className="mt-1 w-4 h-4 rounded"
                          />
                          <div className="flex-1">
                            <span className={`font-medium ${formData.email ? 'text-white' : 'text-gray-500'}`}>
                              Créer automatiquement l'espace membre
                            </span>
                            <p className="text-xs text-gray-400 mt-1">
                              Un espace membre sera créé pour le client avec abonnement
                            </p>
                            {!formData.email && (
                              <p className="text-xs text-orange-400 mt-1">
                                ⚠️ L'email est obligatoire pour créer l'espace membre
                              </p>
                            )}
                          </div>
                        </label>

                        {createEspaceMembre && formData.email && plans.length > 0 && (
                          <div className="ml-7 space-y-2">
                            <label className="block text-sm font-medium text-gray-300">
                              Plan d'abonnement
                            </label>
                            <select
                              value={selectedPlan}
                              onChange={(e) => setSelectedPlan(e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.nom} - {plan.prix_mensuel}€/mois
                                </option>
                              ))}
                            </select>

                            {options.length > 0 && (
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Options supplémentaires (optionnel)
                                </label>
                                <div className="space-y-2 max-h-32 overflow-y-auto bg-white/5 rounded-lg p-3">
                                  {options.map((option) => (
                                    <label
                                      key={option.id}
                                      className="flex items-center gap-2 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedOptions.includes(option.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedOptions([...selectedOptions, option.id]);
                                          } else {
                                            setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded"
                                      />
                                      <span className="text-white text-sm">{option.nom}</span>
                                      <span className="text-green-400 text-sm ml-auto">
                                        +{option.prix_mensuel}€/mois
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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

      {/* Modal identifiants client créé */}
      {showCredentialsModal && clientCredentials && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  ✅ Espace Membre Créé !
                </h2>
                <p className="text-gray-400 text-sm">
                  Les identifiants du client ont été générés
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setClientCredentials(null);
                }}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Email</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={clientCredentials.email}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(clientCredentials.email);
                        alert('Email copié !');
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                      title="Copier"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Mot de passe</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={clientCredentials.password}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(clientCredentials.password);
                        alert('Mot de passe copié !');
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                      title="Copier"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-300">
                ⚠️ Ces identifiants sont affichés une seule fois. Enregistrez-les ou envoyez-les par email au client.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setClientCredentials(null);
                }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent('Identifiants accès - ' + formData.nom);
                  const body = encodeURIComponent(
                    `Bonjour,\n\nVoici vos identifiants pour accéder à votre espace client :\n\nEmail: ${clientCredentials.email}\nMot de passe: ${clientCredentials.password}\n\nCordialement`
                  );
                  window.location.href = `mailto:${clientCredentials.email}?subject=${subject}&body=${body}`;
                }}
                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Envoyer par Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

