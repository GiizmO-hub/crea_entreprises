/**
 * Hook useAuth - Exporté séparément pour éviter le warning Fast Refresh
 */

import { useAuth as useAuthInternal } from '../contexts/AuthContext';

export { useAuthInternal as useAuth };

