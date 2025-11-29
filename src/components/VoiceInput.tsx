import { useState, useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

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
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const fullTranscriptRef = useRef('');
  const restartTimeoutRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('❌ Speech Recognition non supporté');
      setIsSupported(false);
      return;
    }

    console.log('✅ Speech Recognition supporté, initialisation...');
    setIsSupported(true);
    
    // Initialiser la reconnaissance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('✅ Reconnaissance démarrée');
      setIsListening(true);
      isListeningRef.current = true;
      fullTranscriptRef.current = '';
      setTranscript('');
      if (onStart) {
        onStart();
      }
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      // CRITIQUE: Parcourir depuis event.resultIndex jusqu'à la fin
      // event.resultIndex indique où commencer (pour éviter de traiter les mêmes résultats)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // CRITIQUE: Ajouter au transcript final accumulé avec += (NE PAS REMPLACER)
          const before = fullTranscriptRef.current;
          fullTranscriptRef.current += transcript + ' ';
          console.log('✅ Résultat final #' + i + ':', transcript);
          console.log('✅ Avant:', before);
          console.log('✅ Après:', fullTranscriptRef.current);
        } else {
          // Résultat intermédiaire - remplacer le précédent
          interimTranscript = transcript;
        }
      }

      // Combiner le transcript final accumulé avec le dernier résultat intermédiaire
      const fullTranscript = fullTranscriptRef.current.trim() + (interimTranscript ? ' ' + interimTranscript : '');
      setTranscript(fullTranscript);
      
      console.log('📝 ===== TRANSCRIPT =====');
      console.log('📝 Final accumulé:', fullTranscriptRef.current);
      console.log('📝 Longueur accumulée:', fullTranscriptRef.current.length);
      console.log('📝 Intermédiaire:', interimTranscript);
      console.log('📝 Transcript complet:', fullTranscript);
      console.log('📝 Longueur totale:', fullTranscript.length);
      console.log('📝 ======================');
      
      // Appeler onTranscript avec le transcript complet
      if (fullTranscript.trim().length > 0) {
        onTranscript(fullTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Erreur reconnaissance:', event.error);
      
      if (event.error === 'no-speech') {
        console.log('⚠️ Pas de parole, continuation...');
        return;
      }
      
      if (event.error === 'aborted') {
        console.log('⚠️ Reconnaissance interrompue');
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                console.log('🔄 Redémarrage après interruption...');
                recognitionRef.current.start();
              } catch (error) {
                console.error('❌ Erreur redémarrage:', error);
              }
            }
          }, 500);
        }
        return;
      }
      
      if (event.error === 'network') {
        console.error('❌ Erreur réseau');
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
    };

    recognition.onend = () => {
      console.log('⚠️ Reconnaissance terminée');
      
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      
      if (isListeningRef.current && recognitionRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              console.log('🔄 Redémarrage automatique...');
              recognitionRef.current.start();
            } catch (error: any) {
              if (error.message?.includes('already started')) {
                console.log('✅ Déjà démarré');
              } else {
                console.error('❌ Erreur redémarrage:', error);
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          }
        }, 100);
      } else {
        console.log('⏹️ Arrêt manuel confirmé');
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    isInitializedRef.current = true;
    console.log('✅ Reconnaissance initialisée');

    return () => {
      console.log('🧹 Nettoyage de la reconnaissance');
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (error) {
          // Ignorer les erreurs de nettoyage
        }
      }
    };
  }, [language, onTranscript, onStart]);

  const startListening = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🚀 Démarrage demandé, isListening:', isListening);
    
    if (!recognitionRef.current) {
      console.error('❌ Reconnaissance non initialisée');
      alert('La reconnaissance vocale n\'est pas initialisée. Rechargez la page.');
      return;
    }
    
    if (isListening) {
      console.log('⚠️ Déjà en écoute');
      return;
    }
    
    try {
      // Demander l'autorisation du micro
      try {
        console.log('🔐 Demande d\'autorisation micro...');
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Autorisation micro accordée');
      } catch (mediaError: any) {
        console.error('❌ Erreur autorisation micro:', mediaError);
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          alert('L\'autorisation d\'utiliser le micro est requise pour la saisie vocale.');
          return;
        }
        throw mediaError;
      }
      
      // Démarrer la reconnaissance
      console.log('🚀 Démarrage de la reconnaissance...');
      recognitionRef.current.start();
      console.log('✅ Commande start() envoyée');
    } catch (error: any) {
      console.error('❌ Erreur démarrage:', error);
      if (error.message?.includes('already started')) {
        console.log('✅ Déjà démarré');
        setIsListening(true);
        isListeningRef.current = true;
      } else {
        alert('Erreur lors du démarrage de la reconnaissance vocale: ' + (error.message || 'Erreur inconnue'));
      }
    }
  };

  const stopListening = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('⏹️ Arrêt de l\'écoute demandé');
    
    isListeningRef.current = false;
    setIsListening(false);
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (fullTranscriptRef.current.trim().length > 0) {
      console.log('📤 Envoi du transcript final:', fullTranscriptRef.current);
      onTranscript(fullTranscriptRef.current);
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
        console.log('✅ Reconnaissance arrêtée');
      } catch (error) {
        console.log('⚠️ Erreur lors de l\'arrêt (non critique):', error);
      }
    }
  };

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
            console.log('🖱️ Bouton cliqué, isListening:', isListening);
            
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
            }
            if ((e as any).cancelable !== false) {
              (e as any).cancelBubble = true;
            }
            
            if (!isListening && onStart) {
              console.log('📞 Appel de onStart()');
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
            if ((e as any).cancelable !== false) {
              (e as any).cancelBubble = true;
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
            if ((e as any).cancelable !== false) {
              (e as any).cancelBubble = true;
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
          </div>
        )}
      </div>

      {transcript && (
        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
          <p className="text-sm text-gray-300">
            <span className="font-semibold">Transcription :</span>
            <br />
            <span className="text-white">{transcript}</span>
          </p>
        </div>
      )}
    </div>
  );
}
