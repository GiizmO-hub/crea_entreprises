import { useState } from 'react';
import { X, Copy, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { sendClientCredentialsEmail } from '../services/emailService';
import type { ClientCredentialsEmailData } from '../services/emailService';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: {
    email: string;
    password: string;
    clientName: string;
    entrepriseNom: string;
    clientPrenom?: string;
  };
}

export default function CredentialsModal({ isOpen, onClose, credentials }: CredentialsModalProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [copySuccess, setCopySuccess] = useState<'email' | 'password' | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  const handleSendEmail = async (isResend = false) => {
    if (isResend) {
      setResending(true);
    } else {
      setEmailSending(true);
    }
    setEmailSent(false);

    try {
      const emailData: ClientCredentialsEmailData = {
        clientEmail: credentials.email,
        clientName: credentials.clientName,
        clientPrenom: credentials.clientPrenom,
        entrepriseNom: credentials.entrepriseNom,
        email: credentials.email,
        password: credentials.password,
      };

      const result = await sendClientCredentialsEmail(emailData);

      if (result.success) {
        setEmailSent(true);
        // Ne pas masquer la confirmation automatiquement si c'est un renvoi
        if (!isResend) {
          setTimeout(() => {
            setEmailSent(false);
          }, 5000);
        }
      } else {
        alert(`❌ Erreur lors de l'envoi de l'email: ${result.error || 'Erreur inconnue'}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(`❌ Erreur lors de l'envoi de l'email: ${errorMessage}`);
    } finally {
      if (isResend) {
        setResending(false);
      } else {
        setEmailSending(false);
      }
    }
  };

  const clientFullName = credentials.clientPrenom
    ? `${credentials.clientPrenom} ${credentials.clientName}`
    : credentials.clientName;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Espace Membre Créé !
            </h2>
            <p className="text-gray-400 text-sm">
              Identifiants générés pour {clientFullName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entreprise */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-300 font-semibold mb-1">Entreprise</p>
          <p className="text-white font-medium">{credentials.entrepriseNom}</p>
        </div>

        {/* Identifiants */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-300 mb-3">📋 Identifiants de connexion</h3>
          
          <div className="space-y-3">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Adresse Email</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={credentials.email}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(credentials.email, 'email')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all relative"
                  title="Copier"
                >
                  {copySuccess === 'email' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Mot de passe temporaire</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={credentials.password}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono tracking-wider focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(credentials.password, 'password')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                  title="Copier"
                >
                  {copySuccess === 'password' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Avertissement */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Ces identifiants sont affichés une seule fois. Enregistrez-les ou envoyez-les par email au client.
            </span>
          </p>
        </div>

        {/* Message de confirmation email */}
        {emailSent && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-4 animate-pulse">
            <p className="text-sm text-green-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Email envoyé avec succès à {credentials.email}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
          >
            Fermer
          </button>
          {!emailSent ? (
            <button
              onClick={() => handleSendEmail(false)}
              disabled={emailSending}
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer par Email
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSendEmail(true)}
                disabled={resending}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Renvoi...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Renvoyer
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

