/**
 * Composant Carte Client
 * 
 * Affiche les informations d'un client dans une carte
 */

import { Users, Mail, Edit, Trash2, UserPlus, Eye } from 'lucide-react';
import type { Client } from './types';

interface ClientCardProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
  onCreateEspaceMembre?: (client: Client) => void;
  onViewDetails?: (clientId: string) => void;
}

export function ClientCard({
  client,
  onEdit,
  onDelete,
  onCreateEspaceMembre,
  onViewDetails,
}: ClientCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
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
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            client.statut === 'actif'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {client.statut}
        </span>
      </div>

      {client.email && (
        <p className="text-sm text-gray-300 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {client.email}
        </p>
      )}

      {client.ville && (
        <p className="text-sm text-gray-400 mb-2">
          📍 {client.ville}
        </p>
      )}
      
      {/* Afficher l'entreprise si disponible (pour super admin) */}
      {client.entreprise_nom && client.entreprise_nom !== 'N/A' && (
        <p className="text-xs text-blue-400 mb-4 font-medium">
          🏢 {client.entreprise_nom}
        </p>
      )}

      <div className="flex gap-2 pt-4 border-t border-white/10">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(client.id)}
            className="flex-1 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all text-sm font-semibold flex items-center justify-center gap-2"
            title="Voir et modifier tous les détails"
          >
            <Eye className="w-4 h-4" />
            Détails
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(client)}
            className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </button>
        )}
        {client.email && onCreateEspaceMembre && (
          <button
            onClick={() => onCreateEspaceMembre(client)}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all"
            title="Créer un espace membre"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
                onDelete(client.id);
              }
            }}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

