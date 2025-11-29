import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import EntreprisesPlateforme from './entreprises/EntreprisesPlateforme';
import EntrepriseClient from './entreprises/EntrepriseClient';

/**
 * Routeur simple pour les entreprises
 * Détermine si l'utilisateur est un client ou un Super Admin plateforme
 * et route vers le composant approprié
 */
export default function Entreprises() {
  const { user } = useAuth();
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsClient(null);
      setLoading(false);
      return;
    }

    checkUserRole();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) {
      setIsClient(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Vérifier si l'utilisateur a un espace_membre_client
      const { data: espaceClient, error: espaceError } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!espaceError && espaceClient) {
        // ✅ C'EST UN CLIENT
        console.log('👤 [Entreprises Router] Client détecté → Route vers EntrepriseClient');
        setIsClient(true);
      } else {
        // ✅ PAS UN CLIENT → Route vers EntreprisesPlateforme
        console.log('👑 [Entreprises Router] Pas un client → Route vers EntreprisesPlateforme');
        setIsClient(false);
      }
    } catch (error) {
      console.error('❌ [Entreprises Router] Erreur vérification rôle:', error);
      setIsClient(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  // Route vers le composant approprié
  if (isClient === true) {
    return <EntrepriseClient />;
  }

  // Par défaut, route vers la vue plateforme
  return <EntreprisesPlateforme />;
}
