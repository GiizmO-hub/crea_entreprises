/**
 * Composant Formulaire Client
 * 
 * Formulaire de création/édition de client
 */

import { X } from 'lucide-react';
import { Client, ClientFormData } from './types';

interface ClientFormProps {
  show: boolean;
  editingId: string | null;
  formData: ClientFormData;
  entreprises: Array<{ id: string; nom: string }>;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: Partial<ClientFormData>) => void;
  onClose: () => void;
}

export function ClientForm({
  show,
  editingId,
  formData,
  entreprises,
  onSubmit,
  onChange,
  onClose,
}: ClientFormProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {editingId ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {entreprises.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entreprise *
              </label>
              <select
                required
                value={formData.entreprise_id}
                onChange={(e) => onChange({ entreprise_id: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner une entreprise</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom (particulier)
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => onChange({ nom: e.target.value })}
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
                onChange={(e) => onChange({ prenom: e.target.value })}
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
              onChange={(e) => onChange({ entreprise_nom: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom de l'entreprise"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => onChange({ email: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="client@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => onChange({ telephone: e.target.value })}
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
              onChange={(e) => onChange({ adresse: e.target.value })}
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
                onChange={(e) => onChange({ code_postal: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="75001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ville</label>
              <input
                type="text"
                value={formData.ville}
                onChange={(e) => onChange({ ville: e.target.value })}
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
              onChange={(e) => onChange({ siret: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12345678901234"
            />
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
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

