import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

// Valeur par défaut pour éviter les erreurs si utilisé en dehors du Provider
const defaultValue: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
};

export const AuthContext = createContext<AuthContextType>(defaultValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session actuelle avec gestion d'erreur
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Erreur lors de la récupération de la session:', error);
        // Si le refresh token est invalide, nettoyer la session
        if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found')) {
          console.warn('⚠️ Refresh token invalide, nettoyage de la session');
          supabase.auth.signOut();
        }
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Gérer les erreurs d'authentification
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        console.log('🔄 Session expirée ou invalidée');
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Tentative de connexion pour:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Erreur connexion:', error.message);
        return { error };
      }
      
      if (data?.user) {
        console.log('✅ Connexion réussie:', data.user.email);
        setUser(data.user);
        setSession(data.session);
      }
      
      return { error: null };
    } catch (err: unknown) {
      console.error('❌ Erreur inattendue signIn:', err);
      // Créer un objet AuthError compatible
      const authError: AuthError = {
        name: 'AuthError',
        message: err instanceof Error ? err.message : 'Erreur lors de la connexion',
        status: 500,
      } as AuthError;
      return { error: authError };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('📝 Tentative d\'inscription pour:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Erreur inscription:', error.message);
        return { error };
      }
      
      if (data?.user) {
        console.log('✅ Inscription réussie:', data.user.email);
        setUser(data.user);
        setSession(data.session);
      }
      
      return { error: null };
    } catch (err: unknown) {
      console.error('❌ Erreur inattendue signUp:', err);
      // Créer un objet AuthError compatible
      const authError: AuthError = {
        name: 'AuthError',
        message: err instanceof Error ? err.message : 'Erreur lors de l\'inscription',
        status: 500,
      } as AuthError;
      return { error: authError };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔄 Déconnexion en cours...');
      
      // Nettoyer les états D'ABORD pour déclencher le démontage des composants
      setSession(null);
      setUser(null);
      
      // Déconnecter de Supabase avec scope global pour forcer la déconnexion complète
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ Erreur lors de la déconnexion Supabase:', error);
      } else {
        console.log('✅ Déconnexion Supabase réussie');
      }
      
      // Nettoyer le storage
      localStorage.clear();
      sessionStorage.clear();
      
      // SOLUTION : Ne PAS recharger la page, laisser React gérer la transition
      // Quand on met user à null, React affichera automatiquement le composant Auth
      // Cela évite les erreurs removeChild lors du rechargement forcé
      
      // Nettoyer l'URL pour revenir à la racine (sans recharger)
      if (window.location.hash || window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
      
      console.log('✅ Déconnexion terminée - React gérera la transition naturellement');
    } catch (error) {
      console.error('❌ Erreur dans signOut:', error);
      // En cas d'erreur, forcer quand même le nettoyage et la redirection
      setSession(null);
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      
      // Nettoyer l'URL (sans recharger)
      if (window.location.hash || window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth est maintenant exporté depuis src/hooks/useAuth.ts
// pour éviter le warning Fast Refresh

