/**
 * Page de remerciement après création d'entreprise
 */

import { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface Entreprise {
  id: string;
  nom: string;
  forme_juridique: string;
  siret?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  statut: string;
}

interface EntrepriseMerciProps {
  entreprise: Entreprise;
  onContinue: () => void;
}

export function EntrepriseMerci({ entreprise, onContinue }: EntrepriseMerciProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onContinue();
    }
  }, [countdown, onContinue]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Entreprise créée avec succès !
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            L'entreprise <strong className="text-white">{entreprise.nom}</strong> a été créée avec succès.
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold text-white mb-4">Informations de l'entreprise</h2>
          <div className="space-y-2 text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">Nom :</span>
              <span className="text-white font-medium">{entreprise.nom}</span>
            </div>
            {entreprise.forme_juridique && (
              <div className="flex justify-between">
                <span className="text-gray-400">Forme juridique :</span>
                <span className="text-white font-medium">{entreprise.forme_juridique}</span>
              </div>
            )}
            {entreprise.siret && (
              <div className="flex justify-between">
                <span className="text-gray-400">SIRET :</span>
                <span className="text-white font-medium">{entreprise.siret}</span>
              </div>
            )}
            {entreprise.ville && (
              <div className="flex justify-between">
                <span className="text-gray-400">Ville :</span>
                <span className="text-white font-medium">{entreprise.ville}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Statut :</span>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                entreprise.statut === 'active' 
                  ? 'bg-green-500/20 text-green-300' 
                  : 'bg-yellow-500/20 text-yellow-300'
              }`}>
                {entreprise.statut === 'active' ? 'Actif' : entreprise.statut}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Voir les informations
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mt-8">
          Redirection automatique dans {countdown} seconde{countdown > 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}

