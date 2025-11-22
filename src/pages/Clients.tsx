import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Users, Edit, Trash2, Search, Building2, X } from 'lucide-react';

interface Client {
  id: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  statut: string;
  created_at: string;
}

interface ClientsProps {
  onNavigate: (page: string) => void;
}

export default function Clients({ onNavigate: _onNavigate }: ClientsProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [plans, setPlans] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [options, setOptions] = useState<Array<{ id: string; nom: string; prix_mensuel: number }>>([]);
  const [createEspaceMembre, setCreateEspaceMembre] = useState(false);
  const [formData, setFormData] = useState({
    entreprise_id: '',
    nom: '',
    prenom: '',
    entreprise_nom: '',
    email: '',
    password: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    siret: '',
    plan_id: '',
    options_ids: [] as string[],
  });

  useEffect(() => {
    if (user) {
      loadEntreprises();
      loadClients();
      loadPlans();
      loadOptions();
    }
  }, [user]);

  useEffect(() => {
    if (entreprises.length > 0 && !selectedEntreprise) {
      setSelectedEntreprise(entreprises[0].id);
      setFormData((prev) => ({ ...prev, entreprise_id: entreprises[0].id }));
    }
  }, [entreprises]);

  const loadEntreprises = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('entreprises')
        .select('id, nom')
        .eq('user_id', user.id)
        .order('nom');

      setEntreprises(data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
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
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, plan_id: data[0].id }));
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

  const loadClients = async () => {
    if (!user || !selectedEntreprise) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEntreprise) {
      loadClients();
    }
  }, [selectedEntreprise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise) {
      alert('Veuillez sélectionner une entreprise');
      return;
    }

    try {
      const dataToSave = {
        entreprise_id: selectedEntreprise,
        nom: formData.nom || null,
        prenom: formData.prenom || null,
        entreprise_nom: formData.entreprise_nom || null,
        email: formData.email || null,
        telephone: formData.telephone || null,
        adresse: formData.adresse || null,
        code_postal: formData.code_postal || null,
        ville: formData.ville || null,
        siret: formData.siret || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([dataToSave]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadClients();
    } catch (error) {
      console.error('Erreur sauvegarde client:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setFormData({
      entreprise_id: selectedEntreprise,
      nom: client.nom || '',
      prenom: client.prenom || '',
      entreprise_nom: client.entreprise_nom || '',
      email: client.email || '',
      password: '',
      telephone: client.telephone || '',
      adresse: '',
      code_postal: '',
      ville: client.ville || '',
      siret: '',
      plan_id: '',
      options_ids: [],
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ?')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      loadClients();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      entreprise_id: selectedEntreprise,
      nom: '',
      prenom: '',
      entreprise_nom: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      siret: '',
      plan_id: plans.length > 0 ? plans[0].id : '',
      options_ids: [],
      password: '',
    });
    setEditingId(null);
    setCreateEspaceMembre(false);
  };

  const filteredClients = clients.filter((client) => {
    const search = searchTerm.toLowerCase();
    const fullName = `${client.nom || ''} ${client.prenom || ''} ${client.entreprise_nom || ''}`.toLowerCase();
    return fullName.includes(search) || client.email?.toLowerCase().includes(search);
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
          <p className="text-gray-400 mb-4">Vous devez créer une entreprise avant d'ajouter des clients</p>
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
          <h1 className="text-3xl font-bold text-white mb-2">Clients</h1>
          <p className="text-gray-300">Gérez vos clients et prospects</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Ajouter un client
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
          placeholder="Rechercher un client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Liste des clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client'}
                  </h3>
                  {client.prenom && client.nom && (
                    <p className="text-sm text-gray-400">
                      {client.prenom} {client.nom}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  client.statut === 'actif'
                    ? 'bg-green-500/20 text-green-400'
                    : client.statut === 'prospect'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {client.statut}
              </span>
            </div>

            {client.email && (
              <p className="text-sm text-gray-300 mb-2">{client.email}</p>
            )}
            {client.telephone && (
              <p className="text-sm text-gray-300 mb-2">{client.telephone}</p>
            )}
            {client.ville && (
              <p className="text-sm text-gray-300 mb-2">{client.ville}</p>
            )}

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => handleEdit(client)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => handleDelete(client.id)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">
            {searchTerm ? 'Aucun client trouvé' : 'Aucun client créé'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Ajouter votre premier client
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
                {editingId ? 'Modifier le client' : 'Nouveau client'}
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
                    Nom (particulier)
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dupont"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prénom (particulier)
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jean"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Entreprise (professionnel)
                </label>
                <input
                  type="text"
                  value={formData.entreprise_nom}
                  onChange={(e) => setFormData({ ...formData, entreprise_nom: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'entreprise"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="client@email.com"
                  />
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">SIRET (optionnel)</label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12345678901234"
                />
              </div>

              {/* Section Création Espace Membre */}
              {!editingId && (
                <>
                  <div className="border-t border-white/10 pt-6 mt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="createEspaceMembre"
                        checked={createEspaceMembre}
                        onChange={(e) => setCreateEspaceMembre(e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="createEspaceMembre" className="text-lg font-semibold text-white">
                        Créer un espace membre avec abonnement
                      </label>
                    </div>
                    {createEspaceMembre && (
                      <div className="space-y-4 bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Mot de passe pour l'espace membre *
                          </label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={createEspaceMembre}
                            minLength={8}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Minimum 8 caractères"
                          />
                          <p className="text-xs text-gray-400 mt-1">Le mot de passe sera envoyé au client</p>
                        </div>

                        {plans.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Plan d'abonnement *
                            </label>
                            <select
                              value={formData.plan_id}
                              onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                              required={createEspaceMembre}
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.nom} - {plan.prix_mensuel}€/mois
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {options.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Options/Modules supplémentaires
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto bg-white/5 rounded-lg p-3 border border-white/10">
                              {options.map((option) => (
                                <div key={option.id} className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    id={`option-${option.id}`}
                                    checked={formData.options_ids.includes(option.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({
                                          ...formData,
                                          options_ids: [...formData.options_ids, option.id],
                                        });
                                      } else {
                                        setFormData({
                                          ...formData,
                                          options_ids: formData.options_ids.filter((id) => id !== option.id),
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                  />
                                  <label htmlFor={`option-${option.id}`} className="text-sm text-gray-300 cursor-pointer flex-1">
                                    <span className="font-medium">{option.nom}</span>
                                    {option.prix_mensuel > 0 && (
                                      <span className="text-gray-400 ml-2">(+{option.prix_mensuel}€/mois)</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Les options sont des modules additionnels disponibles pour le client
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
    </div>
  );
}

