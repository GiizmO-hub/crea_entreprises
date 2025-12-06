import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  Settings,
  Building2,
  Users,
  FileText,
  DollarSign,
  Save,
  X,
  Plus,
  Trash2,
  Edit,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface Entreprise {
  id: string;
  nom: string;
  siret?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  convention_collective?: string;
  secteur_activite?: string;
}

interface Collaborateur {
  id: string;
  entreprise_id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  telephone?: string;
  actif: boolean;
  salaire?: number;
  poste?: string;
  convention_collective?: string;
  coefficient?: number;
  type_contrat?: string;
  nombre_heures_mensuelles?: number;
  date_entree?: string;
}

interface ConventionCollective {
  id: string;
  code_idcc: string;
  libelle: string;
  secteur_activite?: string;
  annee?: number;
  // Taux salariaux
  taux_ss_maladie_sal?: number;
  taux_ss_vieil_plaf_sal?: number;
  taux_ss_vieil_deplaf_sal?: number;
  taux_ass_chomage_sal?: number;
  taux_ret_compl_sal?: number;
  taux_csg_ded_sal?: number;
  taux_csg_non_ded_sal?: number;
  // Taux patronaux
  taux_ss_maladie_pat?: number;
  taux_ss_vieil_plaf_pat?: number;
  taux_ss_vieil_deplaf_pat?: number;
  taux_alloc_fam_pat?: number;
  taux_at_mp_pat?: number;
  taux_ass_chomage_pat?: number;
  taux_ret_compl_pat?: number;
}

interface ParametresPaie {
  plafond_ss_mensuel?: number;
  plafond_ss_annuel?: number;
  smic_horaire?: number;
  smic_mensuel?: number;
  taux_reduction_generale?: number;
}

const CODE_ACCES = 'param-compta';

export default function ParametresCompta() {
  const { user } = useAuth();
  const [codeAcces, setCodeAcces] = useState('');
  const [codeValide, setCodeValide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Données
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState<string>('');
  const [selectedEntreprise, setSelectedEntreprise] = useState<Entreprise | null>(null);
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [conventionsCollectives, setConventionsCollectives] = useState<ConventionCollective[]>([]);
  const [selectedConvention, setSelectedConvention] = useState<ConventionCollective | null>(null);
  const [parametresPaie, setParametresPaie] = useState<ParametresPaie>({
    plafond_ss_mensuel: 3428,
    plafond_ss_annuel: 41136,
    smic_horaire: 11.65,
    smic_mensuel: 1766.92,
    taux_reduction_generale: 0.25
  });

  // États pour les formulaires
  const [editingCollaborateur, setEditingCollaborateur] = useState<Collaborateur | null>(null);
  const [showAddCollaborateur, setShowAddCollaborateur] = useState(false);

  useEffect(() => {
    if (codeValide && user) {
      loadEntreprises();
      loadConventionsCollectives();
    }
  }, [codeValide, user]);

  useEffect(() => {
    if (selectedEntrepriseId) {
      loadEntrepriseDetails();
      loadCollaborateurs();
    }
  }, [selectedEntrepriseId]);

  useEffect(() => {
    if (selectedEntreprise?.convention_collective) {
      loadConventionDetails(selectedEntreprise.convention_collective);
    } else {
      setSelectedConvention(null);
    }
  }, [selectedEntreprise?.convention_collective]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeAcces === CODE_ACCES) {
      setCodeValide(true);
    } else {
      setMessage({ type: 'error', text: 'Code d\'accès incorrect' });
    }
  };

  const loadEntreprises = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('id, nom, siret, adresse, code_postal, ville, email, telephone, convention_collective, secteur_activite')
        .order('nom');

      if (error) throw error;
      setEntreprises(data || []);
      if (data && data.length > 0 && !selectedEntrepriseId) {
        setSelectedEntrepriseId(data[0].id);
      }
    } catch (error) {
      console.error('❌ Erreur chargement entreprises:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des entreprises' });
    } finally {
      setLoading(false);
    }
  };

  const loadEntrepriseDetails = async () => {
    if (!selectedEntrepriseId) return;
    try {
      const { data, error } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', selectedEntrepriseId)
        .single();

      if (error) throw error;
      setSelectedEntreprise(data);
    } catch (error) {
      console.error('❌ Erreur chargement détails entreprise:', error);
    }
  };

  const loadCollaborateurs = async () => {
    if (!selectedEntrepriseId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collaborateurs_entreprise')
        .select('*')
        .eq('entreprise_id', selectedEntrepriseId)
        .order('nom, prenom');

      if (error) throw error;
      setCollaborateurs(data || []);
    } catch (error) {
      console.error('❌ Erreur chargement collaborateurs:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des collaborateurs' });
    } finally {
      setLoading(false);
    }
  };

  const loadConventionsCollectives = async () => {
    try {
      const annee = new Date().getFullYear();
      const { data, error } = await supabase
        .from('conventions_collectives')
        .select('*')
        .eq('est_actif', true)
        .eq('annee', annee)
        .order('libelle');

      if (error) throw error;
      setConventionsCollectives(data || []);
      
      // Si une convention est sélectionnée pour l'entreprise, la charger
      if (selectedEntreprise?.convention_collective) {
        const conv = data?.find(c => c.code_idcc === selectedEntreprise.convention_collective);
        if (conv) {
          setSelectedConvention(conv);
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement conventions collectives:', error);
    }
  };

  const loadConventionDetails = async (codeIdcc: string) => {
    if (!codeIdcc) {
      setSelectedConvention(null);
      return;
    }
    try {
      const annee = new Date().getFullYear();
      const { data, error } = await supabase
        .from('conventions_collectives')
        .select('*')
        .eq('code_idcc', codeIdcc)
        .eq('annee', annee)
        .eq('est_actif', true)
        .order('date_mise_a_jour', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSelectedConvention(data || null);
    } catch (error) {
      console.error('❌ Erreur chargement détails convention:', error);
    }
  };

  const saveEntreprise = async () => {
    if (!selectedEntreprise || !selectedEntrepriseId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('entreprises')
        .update({
          nom: selectedEntreprise.nom,
          siret: selectedEntreprise.siret || null,
          adresse: selectedEntreprise.adresse || null,
          code_postal: selectedEntreprise.code_postal || null,
          ville: selectedEntreprise.ville || null,
          email: selectedEntreprise.email || null,
          telephone: selectedEntreprise.telephone || null,
          convention_collective: selectedEntreprise.convention_collective || null,
          secteur_activite: selectedEntreprise.secteur_activite || null,
        })
        .eq('id', selectedEntrepriseId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Entreprise mise à jour avec succès' });
      loadEntreprises();
    } catch (error) {
      console.error('❌ Erreur sauvegarde entreprise:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde de l\'entreprise' });
    } finally {
      setSaving(false);
    }
  };

  const saveCollaborateur = async (collaborateur: Collaborateur) => {
    if (!selectedEntrepriseId) return;
    setSaving(true);
    try {
      if (collaborateur.id) {
        // Mise à jour
        const { error } = await supabase
          .from('collaborateurs_entreprise')
          .update({
            nom: collaborateur.nom,
            prenom: collaborateur.prenom,
            email: collaborateur.email,
            role: collaborateur.role,
            telephone: collaborateur.telephone || null,
            actif: collaborateur.actif,
            salaire: collaborateur.salaire || null,
            poste: collaborateur.poste || null,
            convention_collective: collaborateur.convention_collective || null,
            coefficient: collaborateur.coefficient || null,
            type_contrat: collaborateur.type_contrat || null,
            nombre_heures_mensuelles: collaborateur.nombre_heures_mensuelles || null,
            date_entree: collaborateur.date_entree || null,
          })
          .eq('id', collaborateur.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Collaborateur mis à jour avec succès' });
      } else {
        // Création
        const { error } = await supabase
          .from('collaborateurs_entreprise')
          .insert({
            entreprise_id: selectedEntrepriseId,
            nom: collaborateur.nom,
            prenom: collaborateur.prenom,
            email: collaborateur.email,
            role: collaborateur.role,
            telephone: collaborateur.telephone || null,
            actif: collaborateur.actif !== undefined ? collaborateur.actif : true,
            salaire: collaborateur.salaire || null,
            poste: collaborateur.poste || null,
            convention_collective: collaborateur.convention_collective || null,
            coefficient: collaborateur.coefficient || null,
            type_contrat: collaborateur.type_contrat || null,
            nombre_heures_mensuelles: collaborateur.nombre_heures_mensuelles || null,
            date_entree: collaborateur.date_entree || null,
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Collaborateur créé avec succès' });
      }
      setEditingCollaborateur(null);
      setShowAddCollaborateur(false);
      loadCollaborateurs();
    } catch (error) {
      console.error('❌ Erreur sauvegarde collaborateur:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du collaborateur' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCollaborateur = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce collaborateur ?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('collaborateurs_entreprise')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Collaborateur supprimé avec succès' });
      loadCollaborateurs();
    } catch (error) {
      console.error('❌ Erreur suppression collaborateur:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression du collaborateur' });
    } finally {
      setSaving(false);
    }
  };

  // Écran de saisie du code
  if (!codeValide) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1a2332]/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-cyan-500/20">
          <div className="text-center mb-6">
            <Lock className="w-16 h-16 mx-auto text-cyan-400 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Accès aux Paramètres Comptabilité
            </h1>
            <p className="text-slate-300">
              Veuillez saisir le code d'accès pour continuer
            </p>
          </div>

          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2">
                Code d'accès
              </label>
              <input
                type="password"
                id="code"
                value={codeAcces}
                onChange={(e) => setCodeAcces(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white placeholder-slate-400"
                placeholder="Saisissez le code"
                autoFocus
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-cyan-600/80 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-cyan-500/30"
            >
              Accéder aux paramètres
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 mb-6 border border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Paramètres Comptabilité
                </h1>
                <p className="text-slate-300">
                  Configuration rapide des paramètres de paie et collaborateurs
                </p>
              </div>
            </div>
            <button
              onClick={() => setCodeValide(false)}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message de notification */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sélection entreprise */}
        <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 mb-6 border border-cyan-500/20">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Entreprise
          </label>
          <select
            value={selectedEntrepriseId}
            onChange={(e) => setSelectedEntrepriseId(e.target.value)}
            className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
          >
            <option value="">Sélectionner une entreprise</option>
            {entreprises.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.nom}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        )}

        {selectedEntrepriseId && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 1 : Informations Entreprise */}
            <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-cyan-500/20">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-6 h-6 text-cyan-400" />
                <h2 className="text-xl font-bold text-white">
                  Informations Entreprise
                </h2>
              </div>

              {selectedEntreprise && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Nom de l'entreprise *
                    </label>
                    <input
                      type="text"
                      value={selectedEntreprise.nom || ''}
                      onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, nom: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      SIRET
                    </label>
                    <input
                      type="text"
                      value={selectedEntreprise.siret || ''}
                      onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, siret: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={selectedEntreprise.adresse || ''}
                      onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, adresse: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Code postal
                      </label>
                      <input
                        type="text"
                        value={selectedEntreprise.code_postal || ''}
                        onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, code_postal: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={selectedEntreprise.ville || ''}
                        onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, ville: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Convention collective
                    </label>
                    <select
                      value={selectedEntreprise.convention_collective || ''}
                      onChange={async (e) => {
                        const codeIdcc = e.target.value;
                        setSelectedEntreprise({ ...selectedEntreprise, convention_collective: codeIdcc });
                        await loadConventionDetails(codeIdcc);
                      }}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    >
                      <option value="">Aucune</option>
                      {conventionsCollectives.map((conv) => (
                        <option key={conv.id} value={conv.code_idcc}>
                          {conv.code_idcc} - {conv.libelle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Secteur d'activité
                    </label>
                    <input
                      type="text"
                      value={selectedEntreprise.secteur_activite || ''}
                      onChange={(e) => setSelectedEntreprise({ ...selectedEntreprise, secteur_activite: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <button
                    onClick={saveEntreprise}
                    disabled={saving}
                    className="w-full bg-cyan-600/80 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-cyan-500/30"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Sauvegarder
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Section 2 : Collaborateurs */}
            <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white">
                    Collaborateurs ({collaborateurs.length})
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setEditingCollaborateur({
                      id: '',
                      entreprise_id: selectedEntrepriseId,
                      nom: '',
                      prenom: '',
                      email: '',
                      role: 'employe',
                      actif: true,
                    });
                    setShowAddCollaborateur(true);
                  }}
                  className="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-lg flex items-center gap-2 text-sm border border-cyan-500/30"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {collaborateurs.map((collab) => (
                  <div
                    key={collab.id}
                    className="border border-cyan-500/20 rounded-lg p-4 hover:bg-cyan-500/10"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-white">
                          {collab.prenom} {collab.nom}
                        </h3>
                        <p className="text-sm text-slate-300">{collab.email}</p>
                        <p className="text-sm text-slate-300">
                          {collab.role} • {collab.salaire ? `${collab.salaire} €` : 'Salaire non défini'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCollaborateur(collab)}
                          className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCollaborateur(collab.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {collaborateurs.length === 0 && (
                        <p className="text-center text-slate-400 py-8">
                          Aucun collaborateur trouvé
                        </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3 : Paramètres de Paie */}
          <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-cyan-500/20">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">
                Paramètres de Paie
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Plafond SS Mensuel (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={parametresPaie.plafond_ss_mensuel || ''}
                  onChange={(e) => setParametresPaie({ ...parametresPaie, plafond_ss_mensuel: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Plafond SS Annuel (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={parametresPaie.plafond_ss_annuel || ''}
                  onChange={(e) => setParametresPaie({ ...parametresPaie, plafond_ss_annuel: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  SMIC Horaire (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={parametresPaie.smic_horaire || ''}
                  onChange={(e) => setParametresPaie({ ...parametresPaie, smic_horaire: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  SMIC Mensuel (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={parametresPaie.smic_mensuel || ''}
                  onChange={(e) => setParametresPaie({ ...parametresPaie, smic_mensuel: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Taux Réduction Générale (%)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={parametresPaie.taux_reduction_generale || ''}
                  onChange={(e) => setParametresPaie({ ...parametresPaie, taux_reduction_generale: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 4 : Taux Convention Collective */}
          {selectedConvention && (
            <div className="bg-[#1a2332]/60 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-cyan-400" />
                  <div>
                  <h2 className="text-xl font-bold text-white">
                    Taux Convention Collective
                  </h2>
                  <p className="text-sm text-slate-300">
                      {selectedConvention.code_idcc} - {selectedConvention.libelle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!selectedConvention.id) return;
                    setSaving(true);
                    try {
                      const { error } = await supabase
                        .from('conventions_collectives')
                        .update({
                          taux_ss_maladie_sal: selectedConvention.taux_ss_maladie_sal,
                          taux_ss_vieil_plaf_sal: selectedConvention.taux_ss_vieil_plaf_sal,
                          taux_ss_vieil_deplaf_sal: selectedConvention.taux_ss_vieil_deplaf_sal,
                          taux_ass_chomage_sal: selectedConvention.taux_ass_chomage_sal,
                          taux_ret_compl_sal: selectedConvention.taux_ret_compl_sal,
                          taux_csg_ded_sal: selectedConvention.taux_csg_ded_sal,
                          taux_csg_non_ded_sal: selectedConvention.taux_csg_non_ded_sal,
                          taux_ss_maladie_pat: selectedConvention.taux_ss_maladie_pat,
                          taux_ss_vieil_plaf_pat: selectedConvention.taux_ss_vieil_plaf_pat,
                          taux_ss_vieil_deplaf_pat: selectedConvention.taux_ss_vieil_deplaf_pat,
                          taux_alloc_fam_pat: selectedConvention.taux_alloc_fam_pat,
                          taux_at_mp_pat: selectedConvention.taux_at_mp_pat,
                          taux_ass_chomage_pat: selectedConvention.taux_ass_chomage_pat,
                          taux_ret_compl_pat: selectedConvention.taux_ret_compl_pat,
                        })
                        .eq('id', selectedConvention.id);

                      if (error) throw error;
                      setMessage({ type: 'success', text: 'Taux de convention collective mis à jour avec succès' });
                    } catch (error) {
                      console.error('❌ Erreur sauvegarde taux convention:', error);
                      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des taux' });
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 border border-cyan-500/30"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Sauvegarder les taux
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Taux Salariaux */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-cyan-500/20">
                    Taux Salariaux (%)
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Maladie
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_maladie_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_maladie_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Vieillesse Plafonnée
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_vieil_plaf_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_vieil_plaf_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Vieillesse Déplafonnée
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_vieil_deplaf_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_vieil_deplaf_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Assurance Chômage
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ass_chomage_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ass_chomage_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Retraite Complémentaire
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ret_compl_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ret_compl_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        CSG Déductible
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_csg_ded_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_csg_ded_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        CSG Non Déductible
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_csg_non_ded_sal || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_csg_non_ded_sal: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Taux Patronaux */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-cyan-500/20">
                    Taux Patronaux (%)
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Maladie
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_maladie_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_maladie_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Vieillesse Plafonnée
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_vieil_plaf_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_vieil_plaf_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        SS Vieillesse Déplafonnée
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ss_vieil_deplaf_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ss_vieil_deplaf_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Allocations Familiales
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_alloc_fam_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_alloc_fam_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        AT/MP
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_at_mp_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_at_mp_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Assurance Chômage
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ass_chomage_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ass_chomage_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Retraite Complémentaire
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={selectedConvention.taux_ret_compl_pat || ''}
                        onChange={(e) => setSelectedConvention({ ...selectedConvention, taux_ret_compl_pat: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Modal d'édition/ajout collaborateur */}
        {(editingCollaborateur || showAddCollaborateur) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#1a2332]/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-cyan-500/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingCollaborateur?.id ? 'Modifier' : 'Ajouter'} un collaborateur
                </h2>
                <button
                  onClick={() => {
                    setEditingCollaborateur(null);
                    setShowAddCollaborateur(false);
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {editingCollaborateur && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveCollaborateur(editingCollaborateur);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCollaborateur.prenom}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, prenom: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Nom *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCollaborateur.nom}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, nom: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={editingCollaborateur.email}
                      onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, email: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Rôle *
                      </label>
                      <select
                        required
                        value={editingCollaborateur.role}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, role: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      >
                        <option value="employe">Employé</option>
                        <option value="cadre">Cadre</option>
                        <option value="manager">Manager</option>
                        <option value="administrateur">Administrateur</option>
                        <option value="comptable">Comptable</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={editingCollaborateur.telephone || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, telephone: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Salaire brut (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingCollaborateur.salaire || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, salaire: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Poste
                      </label>
                      <select
                        value={editingCollaborateur.poste || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, poste: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Cadre">Cadre</option>
                        <option value="ETAM">ETAM</option>
                        <option value="Ouvrier">Ouvrier</option>
                        <option value="Agent de maîtrise">Agent de maîtrise</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Convention collective
                      </label>
                      <select
                        value={editingCollaborateur.convention_collective || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, convention_collective: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      >
                        <option value="">Hériter de l'entreprise</option>
                        {conventionsCollectives.map((conv) => (
                          <option key={conv.id} value={conv.code_idcc}>
                            {conv.code_idcc} - {conv.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Coefficient
                      </label>
                      <input
                        type="number"
                        value={editingCollaborateur.coefficient || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, coefficient: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Type de contrat
                      </label>
                      <select
                        value={editingCollaborateur.type_contrat || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, type_contrat: e.target.value })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      >
                        <option value="">Sélectionner</option>
                        <option value="CDI">CDI</option>
                        <option value="CDD">CDD</option>
                        <option value="Stage">Stage</option>
                        <option value="Alternance">Alternance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Heures mensuelles
                      </label>
                      <input
                        type="number"
                        value={editingCollaborateur.nombre_heures_mensuelles || ''}
                        onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, nombre_heures_mensuelles: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Date d'entrée
                    </label>
                    <input
                      type="date"
                      value={editingCollaborateur.date_entree || ''}
                      onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, date_entree: e.target.value })}
                      className="w-full px-4 py-2 bg-[#1a2332]/60 border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400 text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="actif"
                      checked={editingCollaborateur.actif}
                      onChange={(e) => setEditingCollaborateur({ ...editingCollaborateur, actif: e.target.checked })}
                      className="w-4 h-4 text-cyan-400 border-cyan-500/30 rounded focus:ring-cyan-500"
                    />
                    <label htmlFor="actif" className="text-sm font-medium text-slate-300">
                      Collaborateur actif
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-cyan-600/80 hover:bg-cyan-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-cyan-500/30"
                    >
                      {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Sauvegarder
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCollaborateur(null);
                        setShowAddCollaborateur(false);
                      }}
                      className="px-4 py-2 border border-cyan-500/30 text-slate-300 rounded-lg hover:bg-cyan-500/10"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

