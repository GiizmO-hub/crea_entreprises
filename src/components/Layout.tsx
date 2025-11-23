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
      // ✅ NOUVEAU : Utiliser is_platform_super_admin pour distinguer super_admin plateforme vs client
      // Les clients même super_admin de leur espace ne sont PAS super_admin de la plateforme
      const { data: isPlatformAdmin, error: platformAdminError } = await supabase.rpc('is_platform_super_admin', {
        p_user_id: user.id
      });

      if (!platformAdminError && isPlatformAdmin === true) {
        console.log('✅ Super admin plateforme détecté (accès complet)');
        setIsSuperAdmin(true);
        return;
      }

      // Méthode de fallback : Utiliser la fonction RPC qui contourne RLS
      const { data: roleData, error: rpcError } = await supabase.rpc('get_current_user_role');
      
      if (!rpcError && roleData) {
        // Vérifier si c'est un client (ne doit pas avoir accès aux modules)
        const { data: isClient } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (isClient) {
          // C'est un client, même si super_admin, il n'est pas super_admin plateforme
          console.log('✅ Utilisateur est un client (pas super_admin plateforme)');
          setIsSuperAdmin(false);
          return;
        }

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
        // Vérifier si c'est un client
        const { data: isClient } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (isClient) {
          // C'est un client, même si super_admin, il n'est pas super_admin plateforme
          console.log('✅ Utilisateur est un client (pas super_admin plateforme)');
          setIsSuperAdmin(false);
          return;
        }

        const isAdmin = utilisateur.role === 'super_admin' || utilisateur.role === 'admin';
        console.log('✅ Rôle vérifié dans utilisateurs:', utilisateur.role, '-> isSuperAdmin:', isAdmin);
        setIsSuperAdmin(isAdmin);
        return;
      }

      // Méthode 3 : Fallback sur user_metadata
      console.warn('⚠️ Impossible de lire utilisateurs, fallback sur user_metadata. RPC error:', rpcError, 'Table error:', tableError);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const role = authUser?.user_metadata?.role || authUser?.app_metadata?.role;
      
      // Vérifier si c'est un client
      const { data: isClient } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (isClient) {
        console.log('✅ Utilisateur est un client (pas super_admin plateforme)');
        setIsSuperAdmin(false);
        return;
      }

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
      // Pour les super admins plateforme, tous les modules sont visibles
      if (isSuperAdmin) {
        // Super admin plateforme voit tout, on met tous les modules comme actifs
        setActiveModules(new Set(['dashboard', 'entreprises', 'clients', 'factures', 'comptabilite', 'finance', 'gestion-equipe', 'gestion-projets', 'documents', 'settings', 'abonnements', 'gestion-plans', 'modules']));
        return;
      }

      // ✅ Pour les clients, lire depuis espaces_membres_clients.modules_actifs
      // Cela contient les modules inclus dans leur abonnement
      const { data: espaceClient, error: espaceError } = await supabase
        .from('espaces_membres_clients')
        .select('modules_actifs')
        .eq('user_id', user.id)
        .single();

      if (espaceError || !espaceClient) {
        console.warn('⚠️ Espace client non trouvé, utilisation des modules par défaut');
        // Fallback : modules de base
        setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
        return;
      }

      // Mapping complet entre codes de modules (depuis modules_activation) et IDs du menu
      // Les codes utilisent des tirets (ex: "gestion-projets", "gestion-equipe")
      const moduleCodeToMenuId: Record<string, string> = {
        // Modules de base
        'dashboard': 'dashboard',
        'tableau_de_bord': 'dashboard',
        'tableau-de-bord': 'dashboard',
        'mon_entreprise': 'entreprises',
        'mon-entreprise': 'entreprises',
        'entreprises': 'entreprises',
        
        // Modules clients
        'clients': 'clients',
        'gestion_clients': 'clients',
        'gestion-clients': 'clients',
        'gestion-des-clients': 'clients',
        
        // Modules facturation
        'facturation': 'factures',
        'factures': 'factures',
        
        // Modules documents
        'documents': 'documents',
        'gestion_documents': 'documents',
        'gestion-documents': 'documents',
        'gestion-de-documents': 'documents',
        
        // Modules gestion équipe
        'gestion-equipe': 'gestion-equipe',
        'gestion_equipe': 'gestion-equipe',
        'gestion-d-equipe': 'gestion-equipe',
        'gestion-d-équipe': 'gestion-equipe',
        
        // Modules gestion projets
        'gestion-projets': 'gestion-projets',
        'gestion_projets': 'gestion-projets',
        'gestion-de-projets': 'gestion-projets',
        
        // Modules comptabilité
        'comptabilite': 'comptabilite',
        'comptabilité': 'comptabilite',
        
        // Modules finance
        'finance': 'finance',
        'finances': 'finance',
        
        // Modules collaborateurs
        'collaborateurs': 'collaborateurs',
        'gestion-collaborateurs': 'collaborateurs',
        'gestion_des_collaborateurs': 'collaborateurs',
        'gestion-des-collaborateurs': 'collaborateurs',
      };

      // Extraire les modules actifs depuis le JSON
      const modulesActifs = espaceClient.modules_actifs || {};
      const activeModulesSet = new Set<string>();

      // Parcourir tous les modules dans modules_actifs
      Object.keys(modulesActifs).forEach((moduleCode) => {
        // Vérifier si le module est actif (valeur true)
        if (modulesActifs[moduleCode] === true || modulesActifs[moduleCode] === 'true') {
          // Mapper le code du module à l'ID du menu
          const menuId = moduleCodeToMenuId[moduleCode];
          if (menuId) {
            activeModulesSet.add(menuId);
            console.log(`✅ Module actif trouvé: ${moduleCode} -> ${menuId}`);
          } else {
            console.warn(`⚠️ Code de module non mappé: ${moduleCode}`);
          }
        }
      });

      // Toujours afficher certains modules de base (dashboard, entreprises, settings)
      activeModulesSet.add('dashboard');
      activeModulesSet.add('entreprises');
      activeModulesSet.add('settings');

      console.log(`✅ Modules actifs chargés pour le client: ${Array.from(activeModulesSet).join(', ')}`);
      setActiveModules(activeModulesSet);
    } catch (error) {
      console.error('Erreur chargement modules actifs:', error);
      // En cas d'erreur, afficher les modules de base
      setActiveModules(new Set(['dashboard', 'entreprises', 'settings']));
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

