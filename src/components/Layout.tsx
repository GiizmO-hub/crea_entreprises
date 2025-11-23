import { type ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Calculator,
  TrendingUp,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Package,
  CreditCard,
  FolderOpen,
  UsersRound,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkSuperAdmin();
    loadActiveModules();
  }, [user, isSuperAdmin]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      // Méthode 1 : Utiliser la fonction RPC qui contourne RLS
      const { data: roleData, error: rpcError } = await supabase.rpc('get_current_user_role');
      
      if (!rpcError && roleData) {
        const isAdmin = roleData.is_super_admin === true || roleData.is_admin === true;
        console.log('✅ Rôle vérifié via RPC:', roleData.role, '-> isSuperAdmin:', isAdmin);
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Méthode 2 : Essayer de lire directement depuis la table utilisateurs
      const { data: utilisateur, error: tableError } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!tableError && utilisateur) {
        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        console.log('✅ Rôle vérifié dans utilisateurs:', utilisateur.role, '-> isSuperAdmin:', isAdmin);
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Méthode 3 : Fallback sur user_metadata
      console.warn('⚠️ Impossible de lire utilisateurs, fallback sur user_metadata. RPC error:', rpcError, 'Table error:', tableError);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role || authUser?.app_metadata?.role;
      const isAdmin = role === 'super_admin' || role === 'admin';
      console.log('✅ Rôle vérifié dans user_metadata:', role, '-> isSuperAdmin:', isAdmin);
      setIsSuperAdmin(isAdmin);
    } catch (error) {
      console.error('❌ Erreur vérification super admin:', error);
      // En cas d'erreur totale, supposer que ce n'est pas un admin
      setIsSuperAdmin(false);
    }
  };

  const loadActiveModules = async () => {
    if (!user) {
      setActiveModules(new Set());
      return;
    }

    try {
      // Pour les super admins, tous les modules sont visibles
      if (isSuperAdmin) {
        // Super admin voit tout, on met tous les modules comme actifs
         setActiveModules(new Set(['dashboard', 'entreprises', 'clients', 'factures', 'comptabilite', 'finance', 'gestion-equipe', 'settings']));
        return;
      }

      // Pour les clients, charger uniquement les modules actifs depuis modules_activation
      const { data: modulesStatus, error } = await supabase.rpc('get_all_modules_status');

      if (error) {
        console.error('Erreur chargement modules actifs:', error);
        // En cas d'erreur, on affiche tous les modules par défaut (comportement de fallback)
         setActiveModules(new Set(['dashboard', 'entreprises', 'clients', 'factures', 'comptabilite', 'finance', 'gestion-equipe', 'settings']));
        return;
      }

      // Filtrer uniquement les modules actifs
      const activeModulesSet = new Set<string>();
      if (modulesStatus && Array.isArray(modulesStatus)) {
        modulesStatus.forEach((mod: any) => {
          if (mod.actif === true) {
            // Mapper les codes de modules aux IDs du menu
            const moduleCodeToMenuId: Record<string, string> = {
              'dashboard': 'dashboard',
              'clients': 'clients',
              'facturation': 'factures',
              'collaborateurs': 'collaborateurs',
            };
            const menuId = moduleCodeToMenuId[mod.code];
            if (menuId) {
              activeModulesSet.add(menuId);
            }
          }
        });
      }

      // Toujours afficher certains modules de base (dashboard, entreprises, settings)
      activeModulesSet.add('dashboard');
      activeModulesSet.add('entreprises');
      activeModulesSet.add('settings');

      setActiveModules(activeModulesSet);
    } catch (error) {
      console.error('Erreur chargement modules actifs:', error);
      // En cas d'erreur, afficher tous les modules par défaut
         setActiveModules(new Set(['dashboard', 'entreprises', 'clients', 'factures', 'comptabilite', 'finance', 'gestion-equipe', 'settings']));
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, moduleCode: 'dashboard' },
    { id: 'entreprises', label: 'Mon Entreprise', icon: Building2, moduleCode: 'entreprises' },
    { id: 'clients', label: 'Clients', icon: Users, moduleCode: 'clients' },
    { id: 'abonnements', label: 'Abonnements', icon: CreditCard, superAdminOnly: true, moduleCode: 'abonnements' },
    { id: 'gestion-plans', label: 'Gestion Plans', icon: CreditCard, superAdminOnly: true, moduleCode: 'abonnements' },
    { id: 'factures', label: 'Facturation', icon: FileText, moduleCode: 'facturation' },
    { id: 'documents', label: 'Documents', icon: FolderOpen, moduleCode: 'documents' },
    { id: 'gestion-equipe', label: 'Gestion d\'Équipe', icon: UsersRound, superAdminOnly: true, moduleCode: 'gestion-equipe' },
    { id: 'comptabilite', label: 'Comptabilité', icon: Calculator, moduleCode: 'comptabilite' },
    { id: 'finance', label: 'Finance', icon: TrendingUp, moduleCode: 'finance' },
    { id: 'modules', label: 'Modules', icon: Package, superAdminOnly: true, moduleCode: 'modules' },
    { id: 'settings', label: 'Paramètres', icon: Settings, moduleCode: 'settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } fixed left-0 top-0 h-screen bg-white/10 backdrop-blur-lg border-r border-white/10 transition-all duration-300 z-50`}
      >
        <div className="flex flex-col h-full">
          {/* Header Sidebar */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-white">Crea+Entreprises</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Menu Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems
              .filter((item) => {
                // Filtrer les éléments admin uniquement
                if (item.superAdminOnly && !isSuperAdmin) {
                  return false;
                }
                // Pour les clients, vérifier si le module est actif
                if (!isSuperAdmin && !item.superAdminOnly) {
                  // Les modules de base (dashboard, entreprises, settings) sont toujours visibles
                  if (item.id === 'dashboard' || item.id === 'entreprises' || item.id === 'settings') {
                    return true;
                  }
                  // Vérifier si le module est actif
                  return activeModules.has(item.id);
                }
                // Super admin voit tout
                return true;
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const isAdminItem = item.superAdminOnly;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(true);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : isAdminItem && isSuperAdmin
                        ? 'text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-200 border border-yellow-500/30'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                    title={sidebarOpen ? '' : item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium">
                        {item.label}
                        {isAdminItem && isSuperAdmin && (
                          <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Admin</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-3 px-4 py-2 text-gray-300">
              <UserIcon className="w-5 h-5" />
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-300 hover:bg-red-500/20 rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span>Déconnexion</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`${
          sidebarOpen ? 'ml-64' : 'ml-20'
        } transition-all duration-300 min-h-screen`}
      >
        {children}
      </main>
    </div>
  );
}

