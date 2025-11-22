import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Edit, Trash2, Search, Building2, Eye, X } from 'lucide-react';

interface Facture {
  id: string;
  numero: string;
  client_id: string;
  entreprise_id: string;
  date_facturation: string;
  date_echeance?: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  statut: string;
  created_at: string;
  client_nom?: string;
  entreprise_nom?: string;
}

interface FacturesProps {
  onNavigate: (page: string) => void;
}

export default function Factures({ onNavigate: _onNavigate }: FacturesProps) {
  const { user } = useAuth();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [entreprises, setEntreprises] = useState<Array<{ id: string; nom: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; nom?: string; entreprise_nom?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');
  const [formData, setFormData] = useState({
    numero: '',
    client_id: '',
    entreprise_id: '',
    date_facturation: new Date().toISOString().split('T')[0],
    date_echeance: '',
    montant_ht: 0,
    taux_tva: 20,
    statut: 'brouillon',
  });

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
      loadFactures();
    }
  }, [selectedEntreprise]);

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
      const { data, error } = await supabase
        .from('factures')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
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

  const generateNumero = async () => {
    if (!selectedEntreprise) return 'FACT-001';

    try {
      const { data } = await supabase
        .from('factures')
        .select('numero')
        .eq('entreprise_id', selectedEntreprise)
        .order('numero', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastNum = parseInt(data[0].numero?.split('-')[1] || '0');
        return `FACT-${String(lastNum + 1).padStart(3, '0')}`;
      }
      return 'FACT-001';
    } catch (error) {
      console.error('Erreur génération numéro:', error);
      return 'FACT-001';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntreprise || !formData.client_id) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const montant_ht = Number(formData.montant_ht) || 0;
      const taux_tva = Number(formData.taux_tva) || 20;
      const montant_tva = montant_ht * (taux_tva / 100);
      const montant_ttc = montant_ht + montant_tva;

      const dataToSave = {
        numero: formData.numero || (await generateNumero()),
        client_id: formData.client_id,
        entreprise_id: selectedEntreprise,
        date_facturation: formData.date_facturation,
        date_echeance: formData.date_echeance || null,
        montant_ht,
        taux_tva,
        montant_tva,
        montant_ttc,
        statut: formData.statut,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('factures')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('factures').insert([dataToSave]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadFactures();
    } catch (error) {
      console.error('Erreur sauvegarde facture:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (facture: Facture) => {
    setEditingId(facture.id);
    setFormData({
      numero: facture.numero,
      client_id: facture.client_id,
      entreprise_id: facture.entreprise_id,
      date_facturation: facture.date_facturation.split('T')[0],
      date_echeance: facture.date_echeance?.split('T')[0] || '',
      montant_ht: facture.montant_ht,
      taux_tva: facture.montant_tva / facture.montant_ht * 100 || 20,
      statut: facture.statut,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;

    try {
      const { error } = await supabase.from('factures').delete().eq('id', id);
      if (error) throw error;
      loadFactures();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      numero: '',
      client_id: '',
      entreprise_id: selectedEntreprise,
      date_facturation: new Date().toISOString().split('T')[0],
      date_echeance: '',
      montant_ht: 0,
      taux_tva: 20,
      statut: 'brouillon',
    });
    setEditingId(null);
  };

  const filteredFactures = factures.filter((facture) => {
    const search = searchTerm.toLowerCase();
    return (
      facture.numero.toLowerCase().includes(search) ||
      facture.client_nom?.toLowerCase().includes(search) ||
      facture.statut.toLowerCase().includes(search)
    );
  });

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
          <h1 className="text-3xl font-bold text-white mb-2">Facturation</h1>
          <p className="text-gray-300">Gérez vos factures et devis</p>
        </div>
        <button
          onClick={async () => {
            resetForm();
            const numero = await generateNumero();
            setFormData((prev) => ({ ...prev, numero }));
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nouvelle facture
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

      {/* Liste des factures */}
      <div className="space-y-4">
        {filteredFactures.map((facture) => (
          <div
            key={facture.id}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-lg font-bold text-white">{facture.numero}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        facture.statut === 'payee'
                          ? 'bg-green-500/20 text-green-400'
                          : facture.statut === 'envoyee'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {facture.statut}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">Client: {facture.client_nom}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Date: {new Date(facture.date_facturation).toLocaleDateString('fr-FR')}</span>
                    {facture.date_echeance && (
                      <span>Échéance: {new Date(facture.date_echeance).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white mb-1">
                    {facture.montant_ttc.toFixed(2)}€
                  </div>
                  <div className="text-sm text-gray-400">TTC</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEdit(facture)}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {}}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                  title="Voir / Télécharger PDF"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(facture.id)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFactures.length === 0 && (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">
            {searchTerm ? 'Aucune facture trouvée' : 'Aucune facture créée'}
          </p>
          {!searchTerm && (
            <button
              onClick={async () => {
                resetForm();
                const numero = await generateNumero();
                setFormData((prev) => ({ ...prev, numero }));
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
                    Numéro *
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="FACT-001"
                  />
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
                    <option value="payee">Payée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
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

