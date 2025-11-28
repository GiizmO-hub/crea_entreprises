/**
 * Page d'informations détaillées du client
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, Edit, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client } from './types';

interface ClientInformationsProps {
  clientId: string;
  onBack: () => void;
  onEdit?: (client: Client) => void;
  onCreateEspaceMembre?: (client: Client) => void;
}

export function ClientInformations({ clientId, onBack, onEdit, onCreateEspaceMembre }: ClientInformationsProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [entreprise, setEntreprise] = useState<{ id: string; nom: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasEspaceMembre, setHasEspaceMembre] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Charger le client avec l'entreprise
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select(`
          *,
          entreprise:entreprises(id, nom)
        `)
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      setClient(clientData);
      if (clientData.entreprise) {
        setEntreprise(clientData.entreprise);
      }

      // Vérifier si le client a un espace membre
      if (clientData.email) {
        const { data: espaceData } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('client_id', clientId)
          .maybeSingle();

        setHasEspaceMembre(!!espaceData);
      }
    } catch (error) {
      console.error('Erreur chargement client:', error);
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

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
          <p className="text-red-400 mb-6">Client introuvable</p>
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

  const clientName = client.entreprise_nom 
    ? client.entreprise_nom 
    : `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client sans nom';

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
              <h1 className="text-4xl font-bold text-white mb-2">{clientName}</h1>
              {entreprise && (
                <p className="text-gray-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {entreprise.nom}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {!hasEspaceMembre && client.email && onCreateEspaceMembre && (
                <button
                  onClick={() => onCreateEspaceMembre(client)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-all border border-green-600/30"
                >
                  <Key className="w-4 h-4" />
                  Créer espace membre
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(client)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all border border-blue-600/30"
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Informations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations personnelles
            </h2>
            <div className="space-y-3">
              {client.prenom && (
                <div>
                  <label className="text-gray-400 text-sm">Prénom</label>
                  <p className="text-white font-medium">{client.prenom}</p>
                </div>
              )}
              {client.nom && (
                <div>
                  <label className="text-gray-400 text-sm">Nom</label>
                  <p className="text-white font-medium">{client.nom}</p>
                </div>
              )}
              {client.email && (
                <div>
                  <label className="text-gray-400 text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <p className="text-white font-medium">{client.email}</p>
                </div>
              )}
              {client.telephone && (
                <div>
                  <label className="text-gray-400 text-sm flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Téléphone
                  </label>
                  <p className="text-white font-medium">{client.telephone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Informations professionnelles */}
          {(client.entreprise_nom || client.siret) && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Informations professionnelles
              </h2>
              <div className="space-y-3">
                {client.entreprise_nom && (
                  <div>
                    <label className="text-gray-400 text-sm">Entreprise</label>
                    <p className="text-white font-medium">{client.entreprise_nom}</p>
                  </div>
                )}
                {client.siret && (
                  <div>
                    <label className="text-gray-400 text-sm">SIRET</label>
                    <p className="text-white font-medium">{client.siret}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Adresse */}
          {(client.adresse || client.code_postal || client.ville) && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 md:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Adresse
              </h2>
              <div className="space-y-3">
                {client.adresse && (
                  <div>
                    <label className="text-gray-400 text-sm">Rue</label>
                    <p className="text-white font-medium">{client.adresse}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {client.code_postal && (
                    <div>
                      <label className="text-gray-400 text-sm">Code postal</label>
                      <p className="text-white font-medium">{client.code_postal}</p>
                    </div>
                  )}
                  {client.ville && (
                    <div>
                      <label className="text-gray-400 text-sm">Ville</label>
                      <p className="text-white font-medium">{client.ville}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Statut espace membre */}
          {client.email && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 md:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4">Espace membre</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300">
                    {hasEspaceMembre 
                      ? '✅ Un espace membre est associé à ce client'
                      : '❌ Aucun espace membre associé'}
                  </p>
                </div>
                {!hasEspaceMembre && onCreateEspaceMembre && (
                  <button
                    onClick={() => onCreateEspaceMembre(client)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all"
                  >
                    Créer l'espace membre
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

