import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function PaymentSuccess() {
  const hasRedirectedRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // ✅ Récupérer les paramètres depuis l'URL
  const getUrlParam = (name: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    let value = urlParams.get(name);
    
    if (!value && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      value = hashParams.get(name);
    }
    
    return value;
  };

  const paiementId = getUrlParam('paiement_id');
  const sessionId = getUrlParam('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Validation du paiement en cours...');

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!paiementId || hasRedirectedRef.current) return;

    const validateAndRedirect = async () => {
      try {
        console.log('🔄 PaymentSuccess - Vérification du statut du paiement...', paiementId);
        
        // ✅ NOUVEAU : Vérifier d'abord si le paiement est déjà traité
        const { data: currentPaiement, error: fetchError } = await supabase
          .from('paiements')
          .select('id, statut, stripe_payment_id')
          .eq('id', paiementId)
          .single();

        if (fetchError) {
          console.error('❌ Erreur récupération paiement:', fetchError);
          if (isMountedRef.current) {
            setStatus('error');
            setMessage('Erreur: Paiement non trouvé');
          }
          setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              window.location.replace('/');
            }
          }, 3000);
          return;
        }

        // ✅ VÉRIFICATION CRITIQUE : Ne pas valider si le paiement n'est pas vraiment payé
        // Si pas de stripe_payment_id ET statut != 'paye', attendre le webhook Stripe
        if (currentPaiement.statut !== 'paye' && !currentPaiement.stripe_payment_id) {
          console.log('⏳ Paiement en attente - Le webhook Stripe va le valider automatiquement');
          if (isMountedRef.current) {
            setStatus('loading');
            setMessage('Paiement en cours de validation par Stripe... Veuillez patienter.');
          }
          // Attendre 5 secondes puis re-vérifier
          setTimeout(async () => {
            if (!hasRedirectedRef.current && isMountedRef.current) {
              // Re-vérifier le statut
              const { data: updatedPaiement } = await supabase
                .from('paiements')
                .select('id, statut, stripe_payment_id')
                .eq('id', paiementId)
                .single();
              
              if (updatedPaiement && updatedPaiement.statut === 'paye' && updatedPaiement.stripe_payment_id) {
                // Le webhook a validé, continuer le workflow
                console.log('✅ Paiement validé par le webhook !');
                // Le code ci-dessous va vérifier la facture et rediriger
              } else {
                // Toujours en attente, rediriger quand même (le webhook gérera)
                console.log('⏳ Toujours en attente, redirection...');
                hasRedirectedRef.current = true;
                window.location.replace('/');
              }
            }
          }, 5000);
          return;
        }

        // ✅ Vérifier si une facture existe déjà pour ce paiement (webhook a peut-être déjà traité)
        // Méthode 1 : Si paiement_id existe dans factures
        let factureExistante = null;
        let checkFactures = false;
        
        // Vérifier via paiement_id si possible
        try {
          const { data: facturesByPaiement } = await supabase
            .from('factures')
            .select('id')
            .eq('paiement_id', paiementId)
            .limit(1);
          
          if (facturesByPaiement && facturesByPaiement.length > 0) {
            factureExistante = facturesByPaiement[0].id;
          } else {
            checkFactures = true; // Pas trouvé via paiement_id, essayer autre méthode
          }
        } catch (err) {
          // Colonne paiement_id n'existe peut-être pas, essayer autre méthode
          checkFactures = true;
        }
        
        // Méthode 2 : Vérifier par entreprise_id + montant + date si paiement_id n'existe pas
        if (checkFactures && currentPaiement.entreprise_id) {
          const { data: factures } = await supabase
            .from('factures')
            .select('id, montant_ttc, date_emission')
            .eq('entreprise_id', currentPaiement.entreprise_id)
            .eq('statut', 'payee')
            .order('created_at', { ascending: false })
            .limit(5); // Vérifier les 5 dernières factures
          
          if (factures && factures.length > 0) {
            // Vérifier si une facture correspond au montant et date récente
            const today = new Date().toISOString().split('T')[0];
            const matchingFacture = factures.find(f => 
              f.montant_ttc === currentPaiement.montant_ttc &&
              f.date_emission === today
            );
            if (matchingFacture) {
              factureExistante = matchingFacture.id;
            }
          }
        }

        // Si le paiement est déjà payé ET qu'une facture existe, ne pas réappeler
        if (currentPaiement.statut === 'paye' && factureExistante) {
          console.log('✅ Paiement déjà traité par le webhook - Facture existe:', factureExistante);
          if (isMountedRef.current) {
            setStatus('success');
            setMessage('Paiement validé avec succès ! (Traité par le webhook)');
          }
          setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              window.location.replace('/');
            }
          }, 1500);
          return;
        }

        // Si pas encore traité, appeler valider_paiement_carte_immediat
        // (La fonction a maintenant une protection interne contre les doublons)
        console.log('🔄 PaymentSuccess - Appel de valider_paiement_carte_immediat...');
        
        const { data: validationResult, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
          p_paiement_id: paiementId,
          p_stripe_payment_id: sessionId || null
        });

        if (validationError) {
          console.error('❌ Erreur validation:', validationError);
          if (isMountedRef.current) {
            setStatus('error');
            setMessage(validationError.message || 'Erreur lors de la validation du paiement');
          }
          setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              window.location.replace('/');
            }
          }, 3000);
          return;
        }

        console.log('✅ Validation réussie:', validationResult);

        if (validationResult && validationResult.success) {
          if (isMountedRef.current) {
            setStatus('success');
            if (validationResult.already_processed) {
              setMessage('Paiement déjà validé (doublon évité) !');
            } else {
              setMessage('Paiement validé avec succès ! Facture, abonnement et espace client créés.');
            }
          }
          
          setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              window.location.replace('/');
            }
          }, 1500);
        } else {
          if (isMountedRef.current) {
            setStatus('error');
            setMessage(validationResult?.error || 'Erreur lors de la validation');
          }
          setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              window.location.replace('/');
            }
          }, 3000);
        }
      } catch (err) {
        console.error('❌ Erreur fatale:', err);
        if (isMountedRef.current) {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : 'Erreur inconnue');
        }
        setTimeout(() => {
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            window.location.replace('/');
          }
        }, 3000);
      }
    };

    if (!paiementId) {
      setStatus('error');
      setMessage('ID de paiement manquant dans l\'URL.');
      setTimeout(() => {
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          window.location.replace('/');
        }
      }, 3000);
      return;
    }

    validateAndRedirect();
  }, [paiementId, sessionId]);

  // Affichage simplifié sans icônes lucide-react pour éviter les erreurs removeChild
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Traitement du paiement...</h2>
            <p className="text-gray-300 mb-2">{message}</p>
            {paiementId && (
              <p className="text-sm text-gray-400 mt-4">Paiement ID: {paiementId.substring(0, 8)}...</p>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-3xl">✓</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Paiement réussi !</h2>
            <p className="text-gray-300 mb-4">{message}</p>
            <p className="text-sm text-gray-400 mb-6">
              Redirection automatique vers l'accueil dans quelques secondes...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-3xl">✕</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Erreur</h2>
            <p className="text-gray-300 mb-4">{message}</p>
            {paiementId && (
              <p className="text-sm text-gray-400 mb-4">Paiement ID: {paiementId.substring(0, 8)}...</p>
            )}
          </>
        )}

        <button
          onClick={() => {
            hasRedirectedRef.current = true;
            window.location.replace('/');
          }}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
