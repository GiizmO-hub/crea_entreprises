/**
 * Hook personnalisé pour les requêtes Supabase avec cache et retry
 * 
 * Features:
 * - Cache des résultats
 * - Retry automatique en cas d'erreur réseau
 * - Gestion unifiée du loading et des erreurs
 * - Invalidation du cache
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import type { ErrorType } from '../types/errors';

interface UseSupabaseQueryOptions<T> {
  queryFn: () => Promise<{ data: T | null; error: ErrorType }>;
  enabled?: boolean;
  cacheKey?: string;
  cacheTime?: number; // en millisecondes
  retry?: number;
  retryDelay?: number; // en millisecondes
  onSuccess?: (data: T) => void;
  onError?: (error: ErrorType) => void;
}

interface UseSupabaseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: ErrorType | null;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
}

// Cache global simple (pourrait être remplacé par React Query ou SWR)
const cache = new Map<string, { data: unknown; timestamp: number; cacheTime: number }>();

export function useSupabaseQuery<T>({
  queryFn,
  enabled = true,
  cacheKey,
  cacheTime = 5 * 60 * 1000, // 5 minutes par défaut
  retry = 3,
  retryDelay = 1000,
  onSuccess,
  onError,
}: UseSupabaseQueryOptions<T>): UseSupabaseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorType | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeQuery = useCallback(
    async (skipCache = false): Promise<void> => {
      // Vérifier le cache si activé et pas de skip
      if (cacheKey && !skipCache) {
        const cached = cache.get(cacheKey);
        if (cached) {
          const age = Date.now() - cached.timestamp;
          if (age < cached.cacheTime) {
            setData(cached.data);
            setLoading(false);
            setError(null);
            onSuccess?.(cached.data);
            return;
          } else {
            // Cache expiré, le supprimer
            cache.delete(cacheKey);
          }
        }
      }

      setLoading(true);
      setError(null);

      // Annuler la requête précédente si elle existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      let lastError: ErrorType | null = null;
      let attempts = 0;

      while (attempts <= retry) {
        try {
          const result = await queryFn();

          // Vérifier si la requête a été annulée
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          if (result.error) {
            throw result.error;
          }

          // Succès
          setData(result.data);
          setError(null);
          setLoading(false);

          // Mettre en cache si cacheKey fourni
          if (cacheKey && result.data) {
            cache.set(cacheKey, {
              data: result.data,
              timestamp: Date.now(),
              cacheTime,
            });
          }

          onSuccess?.(result.data as T);
          return;
        } catch (err: unknown) {
          lastError = err;
          attempts++;

          // Ne pas retry si c'est une erreur d'annulation
          if (err?.name === 'AbortError') {
            return;
          }

          // Ne pas retry pour certaines erreurs
          if (err?.code === 'PGRST116' || err?.code === '42883') {
            setError(err);
            setLoading(false);
            onError?.(err);
            return;
          }

          // Attendre avant de retry (sauf dernier essai)
          if (attempts <= retry) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay * attempts));
          }
        }
      }

      // Tous les retry ont échoué
      setError(lastError);
      setLoading(false);
      onError?.(lastError);
    },
    [queryFn, cacheKey, cacheTime, retry, retryDelay, onSuccess, onError]
  );

  useEffect(() => {
    if (enabled) {
      executeQuery();
    } else {
      setLoading(false);
    }

    return () => {
      // Annuler la requête au démontage
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, executeQuery]);

  const refetch = useCallback(() => executeQuery(true), [executeQuery]);

  const invalidateCache = useCallback(() => {
    if (cacheKey) {
      cache.delete(cacheKey);
    }
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidateCache,
  };
}

/**
 * Fonction utilitaire pour invalider tous les caches
 */
export function invalidateAllCaches(): void {
  cache.clear();
}

