import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('🔄 Déconnexion en cours...');
      
      // Nettoyer les états locaux D'ABORD
      setSession(null);
      setUser(null);
      
      // Déconnecter de Supabase avec scope global pour forcer la déconnexion complète
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ Erreur lors de la déconnexion Supabase:', error);
        // Même en cas d'erreur, forcer le nettoyage
        setSession(null);
        setUser(null);
        // Nettoyer le localStorage et sessionStorage
        localStorage.clear();
        sessionStorage.clear();
        throw error;
      }
      
      console.log('✅ Déconnexion Supabase réussie');
      
      // Nettoyer TOUT le storage pour être sûr
      localStorage.clear();
      sessionStorage.clear();
      
      // Forcer un rechargement complet de la page
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Erreur dans signOut:', error);
      // En cas d'erreur, forcer quand même le nettoyage et la redirection
      setSession(null);
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
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

