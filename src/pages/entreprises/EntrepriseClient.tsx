import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Building2, Users, Phone, Mail, MapPin, PlusCircle, Edit, UserX, X } from 'lucide-react';

interface Entreprise {
  id: string;
  nom: string;
  forme_juridique: string;
  siret?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  capital?: number;
  rcs?: string;
  site_web?: string;
  statut: string;
  created_at: string;
}

interface Membre {
  id: string;
  email: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  role: string;
  statut: string;
  poste?: string;
  departement?: string;
  created_at: string;
}

export default function EntrepriseClient() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clientEntreprise, setClientEntreprise] = useState<Entreprise | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [showMembreForm, setShowMembreForm] = useState(false);
  const [editingMembre, setEditingMembre] = useState<Membre | null>(null);
  const [membreFormData, setMembreFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'collaborateur' as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial',
    poste: '',
    departement: '',
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadClientEntreprise();
  }, [user]);

  const loadClientEntreprise = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Vérifier si l'utilisateur a un espace_membre_client
      const { data: espaceClient, error: espaceError } = await supabase
        .from('espaces_membres_clients')
        .select('id, entreprise_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (espaceError || !espaceClient) {
        console.warn('⚠️ Aucun espace membre client trouvé');
        setClientEntreprise(null);
        setLoading(false);
        return;
      }
      
      // Charger l'entreprise du client
      console.log('🔍 Recherche de l\'entreprise avec entreprise_id:', espaceClient.entreprise_id);
      const { data: entreprise, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', espaceClient.entreprise_id)
        .maybeSingle();
      
      if (entrepriseError) {
        console.error('❌ Erreur lors de la recherche de l\'entreprise:', entrepriseError);
        console.error('   Code:', entrepriseError.code);
        console.error('   Message:', entrepriseError.message);
        console.error('   Details:', entrepriseError.details);
        console.error('   Hint:', entrepriseError.hint);
        setClientEntreprise(null);
        setLoading(false);
        return;
      }
      
      if (!entreprise) {
        console.warn('⚠️ Aucune entreprise trouvée pour le client');
        console.warn('   entreprise_id recherché:', espaceClient.entreprise_id);
        setClientEntreprise(null);
        setLoading(false);
        return;
      }
      
      console.log('✅ Entreprise du client chargée:', entreprise.nom);
      setClientEntreprise(entreprise);
      loadMembres(espaceClient.entreprise_id);
    } catch (error) {
      console.error('❌ Erreur chargement entreprise client:', error);
      setClientEntreprise(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMembres = async (entrepriseId: string) => {
    try {
      const { data, error } = await supabase
        .from('collaborateurs_entreprise')
        .select('*')
        .eq('entreprise_id', entrepriseId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMembres((data || []) as Membre[]);
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      setMembres([]);
    }
  };

  const handleCreateMembre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEntreprise) return;

    try {
      const { data, error } = await supabase.rpc('create_collaborateur', {
        p_email: membreFormData.email,
        p_password: membreFormData.password,
        p_nom: membreFormData.nom || null,
        p_prenom: membreFormData.prenom || null,
        p_telephone: membreFormData.telephone || null,
        p_role: membreFormData.role,
        p_entreprise_id: clientEntreprise.id,
        p_departement: membreFormData.departement || null,
        p_poste: membreFormData.poste || null,
      });

      if (error) throw error;
      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Membre créé avec succès!');
      setShowMembreForm(false);
      setMembreFormData({
        email: '',
        password: '',
        nom: '',
        prenom: '',
        telephone: '',
        role: 'collaborateur',
        poste: '',
        departement: '',
      });
      await loadMembres(clientEntreprise.id);
    } catch (error) {
      console.error('Erreur création membre:', error);
      alert('❌ Erreur lors de la création: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    }
  };

  const handleUpdateMembre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMembre || !clientEntreprise) return;

    try {
      const { data, error } = await supabase.rpc('update_collaborateur', {
        p_collaborateur_id: editingMembre.id,
        p_nom: membreFormData.nom || null,
        p_prenom: membreFormData.prenom || null,
        p_telephone: membreFormData.telephone || null,
        p_role: membreFormData.role || null,
        p_entreprise_id: clientEntreprise.id,
        p_departement: membreFormData.departement || null,
        p_poste: membreFormData.poste || null,
      });

      if (error) throw error;
      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Membre modifié avec succès!');
      setShowMembreForm(false);
      setEditingMembre(null);
      await loadMembres(clientEntreprise.id);
    } catch (error) {
      console.error('Erreur modification membre:', error);
      alert('❌ Erreur lors de la modification: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    }
  };

  const handleDeleteMembre = async (membreId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) return;

    try {
      const { data, error } = await supabase.rpc('delete_collaborateur_complete', {
        p_collaborateur_id: membreId,
      });

      if (error) throw error;
      if (data && !data.success) {
        alert('❌ Erreur: ' + (data.error || 'Erreur inconnue'));
        return;
      }

      alert('✅ Membre supprimé avec succès');
      if (clientEntreprise) {
        await loadMembres(clientEntreprise.id);
      }
    } catch (error) {
      console.error('Erreur suppression membre:', error);
      alert('❌ Erreur lors de la suppression: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
    }
  };

  const handleEditMembre = (membre: Membre) => {
    setEditingMembre(membre);
    setMembreFormData({
      email: membre.email,
      password: '',
      nom: membre.nom || '',
      prenom: membre.prenom || '',
      telephone: membre.telephone || '',
      role: membre.role as 'collaborateur' | 'admin' | 'manager' | 'comptable' | 'commercial',
      poste: membre.poste || '',
      departement: membre.departement || '',
    });
    setShowMembreForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement de votre entreprise...</p>
        </div>
      </div>
    );
  }

  if (!clientEntreprise) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">Aucune information d'entreprise disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Mon Entreprise</h1>
        <p className="text-gray-300">Informations complètes de votre entreprise</p>
      </div>

      {/* Informations de l'entreprise */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informations générales
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Nom de l'entreprise</p>
                <p className="text-white font-semibold">{clientEntreprise.nom}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Forme juridique</p>
                <p className="text-white">{clientEntreprise.forme_juridique}</p>
              </div>
              {clientEntreprise.siret && (
                <div>
                  <p className="text-sm text-gray-400">SIRET</p>
                  <p className="text-white">{clientEntreprise.siret}</p>
                </div>
              )}
              {clientEntreprise.rcs && (
                <div>
                  <p className="text-sm text-gray-400">RCS</p>
                  <p className="text-white">{clientEntreprise.rcs}</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Coordonnées
            </h3>
            <div className="space-y-3">
              {clientEntreprise.adresse && (
                <div>
                  <p className="text-sm text-gray-400">Adresse</p>
                  <p className="text-white">{clientEntreprise.adresse}</p>
                </div>
              )}
              {(clientEntreprise.code_postal || clientEntreprise.ville) && (
                <div>
                  <p className="text-sm text-gray-400">Code postal / Ville</p>
                  <p className="text-white">{clientEntreprise.code_postal} {clientEntreprise.ville}</p>
                </div>
              )}
              {clientEntreprise.email && (
                <div>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </p>
                  <p className="text-white">{clientEntreprise.email}</p>
                </div>
              )}
              {clientEntreprise.telephone && (
                <div>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Téléphone
                  </p>
                  <p className="text-white">{clientEntreprise.telephone}</p>
                </div>
              )}
              {clientEntreprise.site_web && (
                <div>
                  <p className="text-sm text-gray-400">Site web</p>
                  <p className="text-white">{clientEntreprise.site_web}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gestion des membres */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Équipe ({membres.length})
          </h3>
          <button
            onClick={() => {
              setEditingMembre(null);
              setMembreFormData({
                email: '',
                password: '',
                nom: '',
                prenom: '',
                telephone: '',
                role: 'collaborateur',
                poste: '',
                departement: '',
              });
              setShowMembreForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            title="Ajouter un membre"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {membres.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucun membre dans l'équipe</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {membres.map((membre) => (
              <div key={membre.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">
                      {membre.prenom} {membre.nom}
                    </p>
                    <p className="text-sm text-gray-400">{membre.email}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    membre.statut === 'actif' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {membre.statut}
                  </span>
                </div>
                {membre.poste && (
                  <p className="text-sm text-gray-300 mb-1">{membre.poste}</p>
                )}
                {membre.telephone && (
                  <p className="text-sm text-gray-300 mb-2 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {membre.telephone}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => handleEditMembre(membre)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-all"
                    title="Modifier le membre"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMembre(membre.id)}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all"
                    title="Supprimer le membre"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal formulaire membre */}
      {showMembreForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingMembre ? 'Modifier le membre' : 'Nouveau membre'}
              </h2>
              <button
                onClick={() => {
                  setShowMembreForm(false);
                  setEditingMembre(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingMembre ? handleUpdateMembre : handleCreateMembre} className="space-y-4">
              {!editingMembre && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={membreFormData.email}
                      onChange={(e) => setMembreFormData({ ...membreFormData, email: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="membre@entreprise.fr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe *</label>
                    <input
                      type="password"
                      value={membreFormData.password}
                      onChange={(e) => setMembreFormData({ ...membreFormData, password: e.target.value })}
                      required={!editingMembre}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mot de passe"
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    value={membreFormData.nom}
                    onChange={(e) => setMembreFormData({ ...membreFormData, nom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dupont"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={membreFormData.prenom}
                    onChange={(e) => setMembreFormData({ ...membreFormData, prenom: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jean"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={membreFormData.telephone}
                  onChange={(e) => setMembreFormData({ ...membreFormData, telephone: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01 23 45 67 89"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rôle</label>
                  <select
                    value={membreFormData.role}
                    onChange={(e) => setMembreFormData({ ...membreFormData, role: e.target.value as any })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="collaborateur">Collaborateur</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="comptable">Comptable</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Poste</label>
                  <input
                    type="text"
                    value={membreFormData.poste}
                    onChange={(e) => setMembreFormData({ ...membreFormData, poste: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Développeur"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Département</label>
                <input
                  type="text"
                  value={membreFormData.departement}
                  onChange={(e) => setMembreFormData({ ...membreFormData, departement: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="IT"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  {editingMembre ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMembreForm(false);
                    setEditingMembre(null);
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

