/**
 * Composant Modal Identifiants
 * 
 * Affiche les identifiants générés pour l'espace membre
 */

import { X, Copy, Check, Mail } from 'lucide-react';
import { useState } from 'react';
import { ClientCredentials } from './types';

interface IdentifiantsModalProps {
  show: boolean;
  credentials: ClientCredentials | null;
  onClose: () => void;
}

export function IdentifiantsModal({ show, credentials, onClose }: IdentifiantsModalProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  if (!show || !credentials) return null;

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (error) {
      console.error('Erreur copie:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Identifiants Espace Membre</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
            <p className="text-yellow-200 text-sm">
              ⚠️ Important : Ces identifiants sont affichés une seule fois. Copiez-les avant de fermer cette fenêtre.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={credentials.email}
                readOnly
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
              <button
                onClick={() => copyToClipboard(credentials.email, 'email')}
                className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                title="Copier"
              >
                {copiedEmail ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={credentials.password}
                readOnly
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
              <button
                onClick={() => copyToClipboard(credentials.password, 'password')}
                className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                title="Copier"
              >
                {copiedPassword ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              // TODO: Implémenter l'envoi par email
              alert('Fonctionnalité d\'envoi par email à implémenter');
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            <Mail className="w-5 h-5" />
            Envoyer par email
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

