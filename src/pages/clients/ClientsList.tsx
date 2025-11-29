/**
 * Composant Liste des Clients
 * 
 * Affiche la liste des clients avec recherche et filtres
 */

import { useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import type { Client } from './types';
import { ClientCard } from './ClientCard';

interface ClientsListProps {
  clients: Client[];
  entreprises: Array<{ id: string; nom: string }>;
  selectedEntreprise: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onEntrepriseChange: (entrepriseId: string) => void;
  onEditClient?: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onCreateEspaceMembre?: (client: Client) => void;
  onViewClientDetails?: (clientId: string) => void;
}

export function ClientsList({
  clients,
  entreprises,
  selectedEntreprise,
  searchTerm,
  onSearchChange,
  onEntrepriseChange,
  onEditClient,
  onDeleteClient,
  onCreateEspaceMembre,
  onViewClientDetails,
}: ClientsListProps) {
  // Filtrer les clients selon la recherche
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;

    const term = searchTerm.toLowerCase();
    return clients.filter(
      (client) =>
        client.nom?.toLowerCase().includes(term) ||
        client.prenom?.toLowerCase().includes(term) ||
        client.entreprise_nom?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term) ||
        client.ville?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Sélection Entreprise */}
      {entreprises.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Filtrer par entreprise
          </label>
          <select
            value={selectedEntreprise}
            onChange={(e) => onEntrepriseChange(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Liste des clients */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchTerm ? 'Aucun client ne correspond à votre recherche.' : 'Aucun client trouvé pour cette entreprise.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={onEditClient}
              onDelete={onDeleteClient}
              onCreateEspaceMembre={onCreateEspaceMembre}
              onViewDetails={onViewClientDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

