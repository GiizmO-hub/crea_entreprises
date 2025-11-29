/**
 * Hook useAuth - Exporté séparément pour éviter le warning Fast Refresh
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { AuthContextType } from '../contexts/AuthContext';
import type { AuthError } from '@supabase/supabase-js';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  // Le contexte a maintenant une valeur par défaut, donc il ne sera jamais undefined
  // Mais on vérifie quand même pour être sûr
  if (!context) {
    console.error('❌ ERREUR: useAuth - contexte non disponible');
    // Retourner la valeur par défaut si jamais le contexte est null/undefined
    const defaultError: AuthError = {
      name: 'AuthError',
      message: 'AuthProvider non disponible',
      status: 500,
    } as AuthError;
    
    return {
      user: null,
      session: null,
      loading: true,
      signIn: async () => ({ error: defaultError }),
      signUp: async () => ({ error: defaultError }),
      signOut: async () => {},
    };
  }
  
  return context;
}




