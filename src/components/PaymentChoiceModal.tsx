import { useState } from 'react';
import { CreditCard, Building2, Clock, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paiementId: string;
  montant: number;
  entrepriseNom: string;
  onPaymentMethodChosen: (method: 'carte' | 'virement') => void;
}

export function PaymentChoiceModal({
  isOpen,
  onClose,
  paiementId,
  montant,
  entrepriseNom,
  onPaymentMethodChosen,
}: PaymentChoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'carte' | 'virement' | null>(null);

  if (!isOpen) return null;

  const handleCardPayment = async () => {
    setLoading(true);
    try {
      // Récupérer la session Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('❌ Vous devez être connecté pour payer');
        return;
      }

      // Appeler l'Edge Function pour créer la session Stripe
      console.log('📞 Appel à l\'Edge Function create-stripe-checkout...');
      console.log('   Paiement ID:', paiementId);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          paiement_id: paiementId,
          success_url: `${window.location.origin}/payment-success?paiement_id=${paiementId}`,
          cancel_url: `${window.location.origin}/payment-cancel?paiement_id=${paiementId}`,
        },
      });

      if (error) {
        console.error('❌ Erreur Edge Function:', error);
        console.error('   Message:', error.message);
        console.error('   Status:', error.status);
        console.error('   Context:', error.context);
        
        // Messages d'erreur spécifiques selon le type d'erreur
        let errorMessage = 'Erreur lors de la création de la session de paiement';
        let errorHint = '';
        
        if (error.message?.includes('Function not found') || error.message?.includes('404') || error.status === 404) {
          errorMessage = 'Edge Function non trouvée';
          errorHint = 'L\'Edge Function "create-stripe-checkout" n\'est pas déployée.\n\nVeuillez la déployer via Supabase Dashboard → Edge Functions.';
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          errorMessage = 'Impossible de contacter l\'Edge Function';
          errorHint = 'Vérifiez que l\'Edge Function est déployée et accessible.';
        } else if (error.message?.includes('Non authentifié') || error.status === 401) {
          errorMessage = 'Vous devez être connecté pour payer';
          errorHint = 'Veuillez vous reconnecter.';
        } else if (data?.error) {
          errorMessage = data.error;
          errorHint = data.details || data.hint || '';
        } else {
          errorMessage = error.message || 'Erreur inconnue';
        }
        
        alert(`❌ ${errorMessage}${errorHint ? '\n\n💡 ' + errorHint : ''}\n\nVérifiez la console (F12) pour plus de détails.`);
        return;
      }

      if (!data || !data.url) {
        console.error('❌ Réponse invalide de l\'Edge Function:', data);
        const errorMsg = data?.error || 'Réponse invalide de l\'Edge Function';
        const errorHint = data?.details || data?.hint || 'Vérifiez les logs dans Supabase Dashboard → Edge Functions → Logs';
        alert(`❌ ${errorMsg}\n\n💡 ${errorHint}`);
        return;
      }

      // Rediriger vers Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Erreur paiement carte:', error);
      alert('❌ Erreur lors de l\'initialisation du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleBankTransfer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('choisir_paiement_virement', {
        p_paiement_id: paiementId,
      });

      if (error) {
        console.error('Erreur choix virement:', error);
        alert('❌ Erreur: ' + error.message);
        return;
      }

      if (data?.success) {
        alert('✅ Paiement par virement enregistré.\n\nDélai de traitement : 2-5 jours ouvrés.\n\nAprès réception du virement, l\'équipe technique validera manuellement la création complète (facture, abonnement, espace client). Les identifiants seront envoyés par email après validation.');
        onPaymentMethodChosen('virement');
        onClose();
      }
    } catch (error) {
      console.error('Erreur choix virement:', error);
      alert('❌ Erreur lors de l\'enregistrement du choix de paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-white/10 p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            Paiement - {entrepriseNom}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Montant */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-400 mb-1">Montant à payer</div>
          <div className="text-3xl font-bold text-white">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)}
            <span className="text-lg text-gray-400 ml-2">TTC</span>
          </div>
        </div>

        {/* Choix de la méthode */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => setSelectedMethod('carte')}
            disabled={loading}
            className={`w-full p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'carte'
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-white/10 bg-white/5 hover:border-blue-500/50'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-blue-400" />
                <div className="text-left">
                  <div className="text-white font-semibold">Paiement par Carte Bancaire</div>
                  <div className="text-sm text-gray-400">Traitement immédiat et sécurisé</div>
                </div>
              </div>
              {selectedMethod === 'carte' && (
                <CheckCircle className="w-5 h-5 text-blue-400" />
              )}
            </div>
          </button>

          <button
            onClick={() => setSelectedMethod('virement')}
            disabled={loading}
            className={`w-full p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'virement'
                ? 'border-green-500 bg-green-500/20'
                : 'border-white/10 bg-white/5 hover:border-green-500/50'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-green-400" />
                <div className="text-left">
                  <div className="text-white font-semibold">Paiement par Virement</div>
                  <div className="text-sm text-gray-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Délai de traitement : 2-5 jours ouvrés
                  </div>
                </div>
              </div>
              {selectedMethod === 'virement' && (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
            </div>
          </button>
        </div>

        {/* Avertissement virement */}
        {selectedMethod === 'virement' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
            <div className="text-sm text-yellow-400">
              ⏳ <strong>Délai : 2-5 jours ouvrés</strong><br />
              Après réception du virement, l'équipe technique validera manuellement votre demande. La facture et les identifiants seront envoyés par email après validation.
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-semibold transition-all disabled:opacity-50"
          >
            Annuler
          </button>
          {selectedMethod === 'carte' && (
            <button
              onClick={handleCardPayment}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Redirection...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Payer par Carte</span>
                </>
              )}
            </button>
          )}
          {selectedMethod === 'virement' && (
            <button
              onClick={handleBankTransfer}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 rounded-lg text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirmer Virement</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

