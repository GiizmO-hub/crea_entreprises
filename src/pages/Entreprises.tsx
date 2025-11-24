import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Plus, Building2, Edit, Trash2, X } from 'lucide-react';

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
  });
  useEffect(() => {
    if (user) {
      loadEntreprises();
    }
  }, [user]);

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
        // CRÉATION - Préparer les données pour l'INSERT
        // user_id est OBLIGATOIRE selon le schéma (NOT NULL)
        const entrepriseData: Record<string, unknown> = {
          user_id: user.id, // ✅ OBLIGATOIRE - la colonne est NOT NULL
          nom: formData.nom.trim(),
          forme_juridique: formData.forme_juridique,
          statut: 'active',
        };

        // Les champs optionnels sont ajoutés seulement s'ils ont une valeur
        if (formData.siret?.trim()) entrepriseData.siret = formData.siret.trim();
        if (formData.email?.trim()) entrepriseData.email = formData.email.trim();
        if (formData.telephone?.trim()) entrepriseData.telephone = formData.telephone.trim();
        if (formData.adresse?.trim()) entrepriseData.adresse = formData.adresse.trim();
        if (formData.code_postal?.trim()) entrepriseData.code_postal = formData.code_postal.trim();
        if (formData.ville?.trim()) entrepriseData.ville = formData.ville.trim();
        if (formData.capital && formData.capital > 0) entrepriseData.capital = formData.capital;
        if (formData.rcs?.trim()) entrepriseData.rcs = formData.rcs.trim();
        if (formData.site_web?.trim()) entrepriseData.site_web = formData.site_web.trim();

        // Créer l'entreprise
        const { error: entrepriseError } = await supabase
          .from('entreprises')
          .insert(entrepriseData);

        if (entrepriseError) {
          console.error('❌ Erreur création entreprise détaillée:', entrepriseError);
          throw new Error(`Erreur lors de la création de l'entreprise: ${entrepriseError.message || 'Erreur inconnue'}`);
        }

        alert('✅ Entreprise créée avec succès!\n\n💡 Configurez maintenant les clients et les abonnements dans l\'onglet "Paramètres" > "Gestion Clients".');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      await loadEntreprises();
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

              {/* Message informatif pour la configuration */}
              {!editingId && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-300">
                    💡 <strong>Note :</strong> Une fois l'entreprise créée, configurez les clients, espaces membres et abonnements depuis l'onglet <strong>"Paramètres" > "Gestion Clients"</strong>.
                  </p>
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

    </div>
  );
}
