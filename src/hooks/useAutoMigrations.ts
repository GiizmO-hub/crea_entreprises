import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook pour appliquer automatiquement les migrations au démarrage
 */
export function useAutoMigrations() {
  const [migrationsApplied, setMigrationsApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    // DÉSACTIVÉ TEMPORAIREMENT : Les migrations sont appliquées via le script Node.js
    // npm run db:apply-all
    // Cela évite les erreurs CORS avec l'Edge Function
    setMigrationsApplied(true);
    
    // Code original commenté pour référence :
    /*
    const applyMigrations = async () => {
      // Ne s'exécuter qu'une fois
      if (migrationsApplied || isApplying) return;
      
      setIsApplying(true);
      
      try {
        // Appeler l'Edge Function pour appliquer les migrations
        const { data, error } = await supabase.functions.invoke('apply-all-migrations', {
          method: 'POST',
        });

        if (error) {
          console.error('❌ Erreur application migrations:', error);
          // Ne pas bloquer l'application si les migrations échouent
          setMigrationsApplied(true);
          return;
        }

        if (data?.success) {
          console.log('✅ Migrations appliquées automatiquement');
          if (data.results && data.results.length > 0) {
            console.log('📊 Résultats:', data.results);
          }
        }
        
        setMigrationsApplied(true);
      } catch (error) {
        console.error('❌ Erreur lors de l\'application des migrations:', error);
        // Ne pas bloquer l'application
        setMigrationsApplied(true);
      } finally {
        setIsApplying(false);
      }
    };

    // Appliquer les migrations après un court délai pour ne pas bloquer le chargement initial
    const timer = setTimeout(() => {
      applyMigrations();
    }, 2000);

    return () => clearTimeout(timer);
    */
  }, [migrationsApplied, isApplying]);

  return { migrationsApplied, isApplying };
}

