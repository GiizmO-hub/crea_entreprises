/**
 * ErrorBoundary - Gestion globale des erreurs React
 * 
 * Capture les erreurs dans l'arbre de composants React
 * et affiche une interface utilisateur de fallback
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Ignorer les erreurs removeChild et NotFoundError qui sont non-critiques
    if (error.message?.includes('removeChild') || error.message?.includes('NotFoundError') || error.name === 'NotFoundError') {
      console.debug('⚠️ Erreur non-critique ignorée par ErrorBoundary:', error.message);
      return { hasError: false }; // Ne pas déclencher l'affichage de l'erreur
    }
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Ignorer les erreurs removeChild qui sont non-critiques
    // Ces erreurs se produisent lors du démontage des composants
    if (error.message?.includes('removeChild') || error.name === 'NotFoundError') {
      console.debug('⚠️ Erreur removeChild ignorée (non-critique):', error.message);
      // Ne pas mettre l'erreur dans le state pour éviter d'afficher l'UI d'erreur
      return;
    }
    
    // Log l'erreur pour le débogage
    console.error('❌ ErrorBoundary a capturé une erreur:', error, errorInfo);
    
    // TODO: Envoyer l'erreur à un service de monitoring (Sentry, etc.)
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback par défaut
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-pink-900">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">😞</div>
            <h1 className="text-2xl font-bold text-white mb-4">
              Oups, une erreur est survenue
            </h1>
            <p className="text-gray-300 mb-6">
              Désolé, quelque chose s'est mal passé. Veuillez réessayer.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left bg-black/20 p-4 rounded text-sm text-gray-300">
                <summary className="cursor-pointer mb-2 font-semibold">
                  Détails de l'erreur (développement)
                </summary>
                <pre className="whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

