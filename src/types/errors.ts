/**
 * Types pour la gestion des erreurs
 * Évite l'utilisation de 'any' partout
 */

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export type ErrorType = SupabaseError | ApiError | Error | unknown;




