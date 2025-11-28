/**
 * Handler de validation de paiement qui fonctionne avec le système de navigation actuel
 * Alternative à PaymentSuccess.tsx pour ne pas dépendre de React Router
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PaymentSuccessHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paiementId = searchParams.get('paiement_id');
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!paiementId) {
      setError('ID de paiement manquant');
      setLoading(false);
      return;
    }

    // ✅ FORCER LA VALIDATION COMPLÈTE DU PAIEMENT
    const validatePaymentComplete = async () => {
      try {
        console.log('🔄 Validation complète du paiement...', paiementId);
        
        // Appeler directement valider_paiement_carte_immediat
        const { data: result, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
          p_paiement_id: paiementId,
          p_stripe_payment_id: sessionId || null
        });

        if (validationError) {
          console.error('❌ Erreur validation:', validationError);
          
          if (validationError.code === '42883' || validationError.message?.includes('does not exist')) {
            setError('La fonction de validation n\'existe pas encore. Veuillez appliquer les migrations SQL.');
          } else {
            setError(validationError.message || 'Erreur lors de la validation du paiement');
          }
          setLoading(false);
          return;
        }

        console.log('✅ Résultat validation:', result);

        if (result && result.success) {
          console.log('✅ Paiement validé avec succès !');
          console.log('   → Facture:', result.facture_id);
          console.log('   → Abonnement:', result.abonnement_id);
          console.log('   → Espace membre:', result.espace_membre_id);
          
          setSuccess(true);
          setLoading(false);
          
          // Rediriger vers la page des entreprises après 3 secondes
          setTimeout(() => {
            window.location.href = '/#entreprises';
          }, 3000);
        } else {
          if (result?.paiement_valide) {
            console.warn('⚠️ Paiement validé mais création partielle:', result);
            setError(`Paiement validé mais erreur: ${result.error || 'Erreur inconnue'}`);
          } else {
            setError(result?.error || 'Erreur lors de la validation du paiement');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Erreur fatale:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setLoading(false);
      }
    };

    validatePaymentComplete();
  }, [paiementId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-md w-full text-center">
          <Loader className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Traitement du paiement...</h2>
          <p className="text-gray-300">Veuillez patienter pendant que nous validons votre paiement.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-8 max-w-md w-full text-center border border-red-500/20">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Erreur</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/#entreprises'}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retour aux entreprises
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Paiement réussi !</h2>
          <p className="text-gray-300 mb-4">
            Votre paiement a été validé avec succès. La facture, l'abonnement et l'espace client sont créés.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Vous allez être redirigé automatiquement...
          </p>
          <button
            onClick={() => window.location.href = '/#entreprises'}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retour aux entreprises
          </button>
        </div>
      </div>
    );
  }

  return null;
}

