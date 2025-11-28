/**
 * Hook useAuth - Exporté séparément pour éviter le warning Fast Refresh
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { AuthContextType } from '../contexts/AuthContext';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  // Le contexte a maintenant une valeur par défaut, donc il ne sera jamais undefined
  // Mais on vérifie quand même pour être sûr
  if (!context) {
    console.error('❌ ERREUR: useAuth - contexte non disponible');
    // Retourner la valeur par défaut si jamais le contexte est null/undefined
    return {
      user: null,
      session: null,
      loading: true,
      signIn: async () => ({ error: { message: 'AuthProvider non disponible' } as any }),
      signUp: async () => ({ error: { message: 'AuthProvider non disponible' } as any }),
      signOut: async () => {},
    };
  }
  
  return context;
}




