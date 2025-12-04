import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onComplete?: () => void;
  onStart?: () => void;
  language?: string;
}

export function VoiceInput({ onTranscript, onComplete, onStart, language = 'fr-FR' }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  
  // SOLUTION RADICALE : Stocker TOUS les résultats finaux dans un tableau persistant
  const allFinalResultsRef = useRef<Array<{text: string, index: number}>>([]);
  const lastProcessedIndexRef = useRef<number>(-1);
  const interimTextRef = useRef<string>('');
  
  const restartTimeoutRef = useRef<any>(null);
  const lastTranscriptTimeRef = useRef<number>(0);

  // Callback stable pour onTranscript
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('❌ Speech Recognition non supporté');
      setIsSupported(false);
      return;
    }

    console.log('✅ Speech Recognition supporté, initialisation...');
    setIsSupported(true);
    
    // Configuration optimale pour capturer TOUT avec meilleure précision
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 10; // ✅ Augmenter à 10 pour avoir plus d'alternatives
    
    // Configuration audio optimale pour meilleure capture
    // Note: Ces paramètres peuvent ne pas être supportés par tous les navigateurs
    try {
      if ('webkitSpeechRecognition' in window) {
        // Chrome/Edge spécifique
        (recognition as any).grammars = null; // Pas de grammaire restrictive
        
        // ✅ Améliorer la qualité de reconnaissance
        // Essayer d'activer des paramètres avancés si disponibles
        try {
          // Service URI pour améliorer la précision (si disponible)
          if ((recognition as any).serviceURI) {
            // Utiliser le service de reconnaissance le plus précis
            console.log('✅ Service URI disponible:', (recognition as any).serviceURI);
          }
        } catch (e) {
          // Ignorer si non disponible
        }
      }
    } catch (e) {
      console.log('⚠️ Configuration audio avancée non disponible');
    }

    recognition.onstart = () => {
      console.log('✅ Reconnaissance démarrée');
      setIsListening(true);
      isListeningRef.current = true;
      setConfidence(0);
      if (onStart) {
        onStart();
      }
    };

    recognition.onresult = (event: any) => {
      // SOLUTION ULTIME : Parcourir TOUS les résultats depuis 0 et accumuler TOUT
      console.log('📝 ===== ONRESULT APPELÉ =====');
      console.log('📝 Nombre de résultats:', event.results.length);
      
      let allFinalTexts: string[] = [];
      let interimText = '';
      let maxConf = 0;

      // PARCOURIR TOUS LES RÉSULTATS DEPUIS 0 (pas depuis le dernier index)
      // event.results contient TOUS les résultats depuis le début de la session
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result.length) {
          console.log(`⚠️ Résultat [${i}] vide ou invalide`);
          continue;
        }
        
        console.log(`📝 Traitement résultat [${i}]: isFinal=${result.isFinal}, alternatives=${result.length}`);
        
        // ✅ AMÉLIORATION : Prendre la meilleure alternative avec post-traitement
        let bestText = '';
        let bestConf = 0;
        
        // Fonction pour corriger les erreurs de transcription courantes
        const correctTranscription = (text: string): string => {
          return text
            // Corrections de noms communs
            .replace(/\bcyrille\b/gi, 'cyril')
            .replace(/\bmari\b/gi, 'marie')
            // Corrections de nombres en lettres
            .replace(/\bvingt\s+cinq\b/gi, '25')
            .replace(/\bvingt\s+six\b/gi, '26')
            .replace(/\bvingt\s+sept\b/gi, '27')
            .replace(/\btrente\b/gi, '30')
            .replace(/\bquarante\b/gi, '40')
            .replace(/\bcinquante\b/gi, '50')
            .replace(/\bsoixante\b/gi, '60')
            .replace(/\bsoixante\s+dix\b/gi, '70')
            .replace(/\bquatre\s+vingt\b/gi, '80')
            .replace(/\bquatre\s+vingt\s+dix\b/gi, '90')
            .replace(/\bcent\b/gi, '100')
            .replace(/\bmille\b/gi, '1000')
            // Corrections de mots commerciaux
            .replace(/\bfacturation\b/gi, 'facture')
            .replace(/\bdevis\s+devis\b/gi, 'devis') // Doublons
            .replace(/\bfacture\s+facture\b/gi, 'facture') // Doublons
            // Nettoyer les espaces multiples
            .replace(/\s+/g, ' ')
            .trim();
        };
        
        for (let alt = 0; alt < result.length; alt++) {
          let altText = result[alt]?.transcript?.trim() || '';
          const altConf = result[alt]?.confidence || 0;
          
          // ✅ Appliquer les corrections de transcription
          altText = correctTranscription(altText);
          
          console.log(`  📝 Alternative [${i}][${alt}]: "${altText}" (confiance: ${Math.round(altConf * 100)}%)`);
          
          // ✅ Préférer les alternatives plus longues si la confiance est similaire (dans 10%)
          if (altText.length > 0) {
            if (altConf > bestConf || (altConf >= bestConf * 0.9 && altText.length > bestText.length)) {
              bestText = altText;
              bestConf = altConf;
            }
          }
        }
        
        if (bestText.length === 0 && result[0]?.transcript) {
          bestText = correctTranscription(result[0].transcript.trim());
          bestConf = result[0].confidence || 0;
          console.log(`  📝 Utilisation alternative 0 par défaut (corrigée): "${bestText}"`);
        }
        
        if (bestText.length === 0) {
          console.log(`  ⚠️ Aucun texte valide trouvé pour résultat [${i}]`);
          continue;
        }
        
        if (bestConf > maxConf) {
          maxConf = bestConf;
        }
        
        if (result.isFinal) {
          // Résultat final - l'ajouter à la liste
          allFinalTexts.push(bestText);
          console.log(`✅ Résultat final [${i}]: "${bestText}" (confiance: ${Math.round(bestConf * 100)}%)`);
        } else {
          // Résultat intermédiaire - remplacer le précédent
          interimText = bestText;
          interimTextRef.current = bestText;
          console.log(`🔄 Résultat intermédiaire [${i}]: "${bestText}" (confiance: ${Math.round(bestConf * 100)}%)`);
        }
      }

      // Mettre à jour le tableau persistant avec TOUS les résultats finaux
      // NE PAS utiliser Set - on veut TOUS les résultats dans l'ordre
      if (allFinalTexts.length > 0) {
        // Ajouter les nouveaux résultats finaux au tableau persistant
        // Vérifier qu'on n'ajoute pas de doublons consécutifs identiques
        const lastStored = allFinalResultsRef.current[allFinalResultsRef.current.length - 1]?.text || '';
        const newResults = allFinalTexts.filter(text => text !== lastStored);
        
        if (newResults.length > 0) {
          allFinalResultsRef.current = [
            ...allFinalResultsRef.current,
            ...newResults.map((text, idx) => ({ text, index: allFinalResultsRef.current.length + idx }))
          ];
          console.log(`✅ ${newResults.length} nouveaux résultats finaux ajoutés`);
        }
        console.log(`✅ Total résultats finaux stockés: ${allFinalResultsRef.current.length}`);
        console.log(`✅ Tous les textes finaux:`, allFinalResultsRef.current.map(r => r.text));
      }

      // Construire le transcript complet depuis TOUS les résultats finaux accumulés
      const allFinalText = allFinalResultsRef.current.map(r => r.text).join(' ').trim();
      const fullTranscript = allFinalText + (interimText ? ' ' + interimText : '');
      
      setTranscript(fullTranscript);
      
      // Mettre à jour la confiance
      const confPercent = Math.round(maxConf * 100);
      if (maxConf > 0) {
        setConfidence(confPercent);
      }
      
      lastTranscriptTimeRef.current = Date.now();
      
      console.log('📝 ===== DÉTAILS TRANSCRIPT =====');
      console.log('📝 Résultats finaux de cet event:', allFinalTexts);
      console.log('📝 Résultats finaux accumulés (total):', allFinalResultsRef.current.map(r => r.text));
      console.log('📝 Texte final accumulé:', allFinalText);
      console.log('📝 Intermédiaire actuel:', interimText);
      console.log('📝 Transcript complet affiché (proposé):', fullTranscript);
      console.log('📝 Longueur totale:', fullTranscript.length);
      console.log('📝 Confiance maximale:', `${confPercent}%`);
      console.log('📝 Nombre de résultats dans event:', event.results.length);
      console.log('📝 ============================');
      
      // ✅ NE METTRE À JOUR le texte que si la confiance est suffisante
      // Cela évite que des bribes très mal reconnues écrasent une bonne phrase
      const MIN_CONFIDENCE = 30; // en pourcentage
      
      if (fullTranscript.trim().length > 0 && confPercent >= MIN_CONFIDENCE) {
        console.log(`✅ Transcript accepté (confiance ${confPercent}% >= ${MIN_CONFIDENCE}%)`);
        onTranscriptRef.current(fullTranscript.trim());
      } else {
        console.log(`⚠️ Transcript ignoré (confiance trop faible: ${confPercent}% < ${MIN_CONFIDENCE}%)`);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Erreur reconnaissance:', event.error);
      
      if (event.error === 'no-speech') {
        return; // Ignorer, continuer
      }
      
      if (event.error === 'aborted') {
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('❌ Erreur redémarrage:', error);
              }
            }
          }, 100);
        }
        return;
      }
      
      if (event.error === 'network') {
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }

      if (event.error === 'not-allowed') {
        setIsListening(false);
        isListeningRef.current = false;
        alert('L\'autorisation d\'utiliser le micro est requise.');
        return;
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && recognitionRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error: any) {
              if (!error.message?.includes('already started')) {
                console.error('❌ Erreur redémarrage:', error);
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          }
        }, 50);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    console.log('✅ Reconnaissance initialisée');

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (error) {
          // Ignorer
        }
      }
    };
  }, [language, onStart]);

  const startListening = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!recognitionRef.current || isListening) {
      return;
    }
    
    try {
      await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      }).then(stream => stream.getTracks().forEach(t => t.stop()));
      
      // RÉINITIALISER TOUT pour un nouveau départ
      allFinalResultsRef.current = [];
      lastProcessedIndexRef.current = -1;
      interimTextRef.current = '';
      setTranscript('');
      setConfidence(0);
      
      recognitionRef.current.start();
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        alert('Autorisation micro requise.');
      }
    }
  }, [isListening]);

  const stopListening = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    isListeningRef.current = false;
    setIsListening(false);
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    // Construire le texte final depuis tous les résultats accumulés
    const allFinalText = allFinalResultsRef.current.map(r => r.text).join(' ').trim();
    const finalText = allFinalText + (interimTextRef.current ? ' ' + interimTextRef.current : '');
    
    if (finalText.length > 0) {
      onTranscriptRef.current(finalText);
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (error) {
        // Ignorer
      }
    }
  }, []);

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm">
          ⚠️ La reconnaissance vocale n'est pas supportée par votre navigateur.
          <br />
          Utilisez Chrome, Edge ou Safari pour cette fonctionnalité.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="space-y-3"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
    >
      <div className="flex items-center gap-3">
        <button
          key={isListening ? 'stop' : 'start'}
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
            }
            
            if (!isListening && onStart) {
              onStart();
            }
            
            if (isListening) {
              stopListening(e);
            } else {
              await startListening(e);
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
            }
            if (!isListening && onStart) {
              onStart();
            }
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isListening ? (
            <span className="flex items-center gap-2">
              <Square className="w-4 h-4" />
              <span>Arrêter</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              <span>Parler</span>
            </span>
          )}
        </button>
        
        {isListening && (
          <div className="flex items-center gap-2 text-red-400">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-sm">En écoute...</span>
            {confidence > 0 && (
              <span className="text-xs text-gray-400">({confidence}%)</span>
            )}
          </div>
        )}
      </div>

      {transcript && (
        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-start gap-2">
            <Volume2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Transcription :</span>
                <br />
                <span className="text-white">{transcript}</span>
              </p>
              {confidence > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Confiance: {confidence}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
