/**
 * Page d'informations détaillées de l'entreprise
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Building2, Edit, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

interface EntrepriseInformationsProps {
  entrepriseId: string;
  onBack: () => void;
  onEdit?: (entreprise: Entreprise) => void;
  onDelete?: (entrepriseId: string) => void;
}

export function EntrepriseInformations({ entrepriseId, onBack, onEdit, onDelete }: EntrepriseInformationsProps) {
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [nbClients, setNbClients] = useState(0);

  useEffect(() => {
    loadEntrepriseData();
  }, [entrepriseId]);

  const loadEntrepriseData = async () => {
    try {
      setLoading(true);
      
      // Charger l'entreprise
      const { data: entrepriseData, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('*')
        .eq('id', entrepriseId)
        .single();

      if (entrepriseError) throw entrepriseError;

      setEntreprise(entrepriseData);

      // Compter les clients
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entrepriseId);

      setNbClients(count || 0);
    } catch (error) {
      console.error('Erreur chargement entreprise:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement des informations...</p>
        </div>
      </div>
    );
  }

  if (!entreprise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
          <p className="text-red-400 mb-6">Entreprise introuvable</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour à la liste
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <Building2 className="w-8 h-8" />
                {entreprise.nom}
              </h1>
              <p className="text-gray-300">{entreprise.forme_juridique}</p>
            </div>
            <div className="flex gap-3">
              {onDelete && (
                <button
                  onClick={() => onDelete(entreprise.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-all border border-red-600/30"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(entreprise)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all border border-blue-600/30"
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-gray-400 text-sm">Clients</h3>
            </div>
            <p className="text-3xl font-bold text-white">{nbClients}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              <h3 className="text-gray-400 text-sm">Statut</h3>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              entreprise.statut === 'active' 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              {entreprise.statut === 'active' ? 'Actif' : entreprise.statut}
            </span>
          </div>
        </div>

        {/* Informations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations générales */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informations générales
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm">Forme juridique</label>
                <p className="text-white font-medium">{entreprise.forme_juridique}</p>
              </div>
              {entreprise.siret && (
                <div>
                  <label className="text-gray-400 text-sm">SIRET</label>
                  <p className="text-white font-medium">{entreprise.siret}</p>
                </div>
              )}
              {entreprise.rcs && (
                <div>
                  <label className="text-gray-400 text-sm">RCS</label>
                  <p className="text-white font-medium">{entreprise.rcs}</p>
                </div>
              )}
              {entreprise.capital && entreprise.capital > 0 && (
                <div>
                  <label className="text-gray-400 text-sm">Capital</label>
                  <p className="text-white font-medium">{entreprise.capital.toLocaleString('fr-FR')} €</p>
                </div>
              )}
            </div>
          </div>

          {/* Coordonnées */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Coordonnées
            </h2>
            <div className="space-y-3">
              {entreprise.email && (
                <div>
                  <label className="text-gray-400 text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <p className="text-white font-medium">{entreprise.email}</p>
                </div>
              )}
              {entreprise.telephone && (
                <div>
                  <label className="text-gray-400 text-sm flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Téléphone
                  </label>
                  <p className="text-white font-medium">{entreprise.telephone}</p>
                </div>
              )}
              {entreprise.site_web && (
                <div>
                  <label className="text-gray-400 text-sm">Site web</label>
                  <p className="text-white font-medium">
                    <a href={entreprise.site_web} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {entreprise.site_web}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Adresse */}
          {(entreprise.adresse || entreprise.code_postal || entreprise.ville) && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 md:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Adresse
              </h2>
              <div className="space-y-3">
                {entreprise.adresse && (
                  <div>
                    <label className="text-gray-400 text-sm">Rue</label>
                    <p className="text-white font-medium">{entreprise.adresse}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {entreprise.code_postal && (
                    <div>
                      <label className="text-gray-400 text-sm">Code postal</label>
                      <p className="text-white font-medium">{entreprise.code_postal}</p>
                    </div>
                  )}
                  {entreprise.ville && (
                    <div>
                      <label className="text-gray-400 text-sm">Ville</label>
                      <p className="text-white font-medium">{entreprise.ville}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

