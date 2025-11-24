/**
 * Hook useAuth - Exporté séparément pour éviter le warning Fast Refresh
 */

import { useContext } from 'react';
import { AuthContext } from '../hooks/useAuth';
import type { AuthContextType } from '../hooks/useAuth';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
