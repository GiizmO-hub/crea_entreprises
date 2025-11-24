/**
 * Composant Modal Création Espace Membre
 * 
 * Modal pour créer un espace membre pour un client
 */

import { X } from 'lucide-react';
import { Client, EspaceMembreData, Plan, Option } from './types';

interface EspaceMembreModalProps {
  show: boolean;
  client: Client | null;
  plans: Plan[];
  options: Option[];
  data: EspaceMembreData;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (data: Partial<EspaceMembreData>) => void;
}

export function EspaceMembreModal({
  show,
  client,
  plans,
  options,
  data,
  onClose,
  onSubmit,
  onChange,
}: EspaceMembreModalProps) {
  if (!show || !client) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Créer un espace membre pour {client.entreprise_nom || `${client.prenom} ${client.nom}`.trim() || 'ce client'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mot de passe (optionnel - sera généré automatiquement si vide)
            </label>
            <input
              type="password"
              value={data.password}
              onChange={(e) => onChange({ password: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Laissez vide pour génération automatique"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Plan d'abonnement *
            </label>
            <select
              required
              value={data.plan_id}
              onChange={(e) => onChange({ plan_id: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nom} - {plan.prix_mensuel}€/mois
                </option>
              ))}
            </select>
          </div>

          {options.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Options supplémentaires
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={data.options_ids.includes(option.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onChange({ options_ids: [...data.options_ids, option.id] });
                        } else {
                          onChange({
                            options_ids: data.options_ids.filter((id) => id !== option.id),
                          });
                        }
                      }}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-white font-medium">{option.nom}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        +{option.prix_mensuel}€/mois
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              onClick={onSubmit}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Créer l'espace membre
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

