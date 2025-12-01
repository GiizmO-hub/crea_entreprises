import { type ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useClientModules } from '../hooks/useClientModules';
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
  Shield,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false); // ✅ Fermé par défaut sur mobile
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isClientSuperAdmin, setIsClientSuperAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // ✅ Gérer l'ouverture automatique de la sidebar sur desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true); // Ouvrir automatiquement sur desktop (lg)
      } else {
        setSidebarOpen(false); // Fermer sur mobile/tablet
      }
    };

    // Vérifier au chargement
    handleResize();

    // Écouter les changements de taille
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Définir menuItems (constante, pas de dépendances)
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, moduleCode: 'dashboard' },
    { id: 'entreprises', label: 'Mon Entreprise', icon: Building2, moduleCode: 'entreprises' },
    { id: 'clients', label: 'Clients', icon: Users, moduleCode: 'clients' },
    { id: 'abonnements', label: 'Abonnements', icon: CreditCard, superAdminOnly: true, moduleCode: 'abonnements' },
    { id: 'gestion-plans', label: 'Gestion Plans', icon: CreditCard, superAdminOnly: true, moduleCode: 'gestion-plans' },
    { id: 'factures', label: 'Facturation', icon: FileText, moduleCode: 'facturation' },
    { id: 'documents', label: 'Documents', icon: FolderOpen, moduleCode: 'documents' },
    { id: 'collaborateurs', label: 'Collaborateurs', icon: UsersRound, moduleCode: 'collaborateurs' },
    { id: 'gestion-equipe', label: 'Gestion d\'Équipe', icon: Shield, moduleCode: 'gestion-equipe' },
    { id: 'comptabilite', label: 'Comptabilité', icon: Calculator, moduleCode: 'comptabilite' },
    { id: 'finance', label: 'Finance', icon: TrendingUp, moduleCode: 'finance' },
    { id: 'gestion-projets', label: 'Gestion Projets', icon: Package, moduleCode: 'gestion-projets' },
    { id: 'gestion-stock', label: 'Gestion Stock', icon: Package, moduleCode: 'gestion-stock' },
    { id: 'crm-avance', label: 'CRM Avancé', icon: TrendingUp, moduleCode: 'crm-avance' },
    { id: 'modules', label: 'Modules', icon: Package, superAdminOnly: true, moduleCode: 'modules' },
    { id: 'settings', label: 'Paramètres', icon: Settings, moduleCode: 'settings' },
  ];

  // ✅ Déclarer la fonction checkSuperAdmin AVANT de l'utiliser dans useEffect
  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      // ✅ NOUVEAU : Utiliser is_platform_super_admin pour distinguer super_admin plateforme vs client
      // Les clients même super_admin de leur espace ne sont PAS super_admin de la plateforme
      // La fonction is_platform_super_admin() n'a pas de paramètre, elle utilise auth.uid()
      const { data: isPlatformAdmin, error: platformAdminError } = await supabase.rpc('is_platform_super_admin');

      // Si la fonction n'existe pas (404) ou erreur, ignorer et continuer avec les autres méthodes
      if (platformAdminError) {
        if (platformAdminError.code === 'PGRST204' || platformAdminError.message?.includes('404') || platformAdminError.code === '42883') {
          console.log('⚠️ Fonction is_platform_super_admin non disponible, utilisation méthode fallback');
        } else {
          console.warn('⚠️ Erreur is_platform_super_admin:', platformAdminError);
        }
      } else if (isPlatformAdmin === true) {
        console.log('✅ Super admin plateforme détecté (accès complet)');
        setIsSuperAdmin(true);
        setIsClient(false); // Forcer isClient à false pour super admin plateforme
        return;
      }

      // Méthode de fallback : Utiliser la fonction RPC qui contourne RLS
      const { data: roleData, error: rpcError } = await supabase.rpc('get_current_user_role');
      
      // Si get_current_user_role indique is_platform_super_admin, utiliser cette info
      if (!rpcError && roleData && roleData.is_platform_super_admin === true) {
        console.log('✅ Super admin plateforme détecté via get_current_user_role');
        setIsSuperAdmin(true);
        setIsClient(false);
        return;
      }
      
      if (!rpcError && roleData) {
        // Vérifier si c'est un client (ne doit pas avoir accès aux modules)
        const { data: isClient } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(); // ✅ Utiliser maybeSingle() pour éviter erreur si 0 lignes

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
        .maybeSingle(); // ✅ Utiliser maybeSingle() pour éviter erreur si 0 lignes

      if (!tableError && utilisateur) {
        // Vérifier si c'est un client
        const { data: isClient } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(); // ✅ Utiliser maybeSingle() pour éviter erreur si 0 lignes

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
        .maybeSingle(); // ✅ Utiliser maybeSingle() pour éviter erreur si 0 lignes

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

  // ✅ useEffect pour appeler les fonctions de vérification - PRIORITÉ 1: Super Admin Plateforme
  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setIsClientSuperAdmin(false);
      setIsClient(false);
      return;
    }

    let isMounted = true;
    
    (async () => {
      try {
        // ✅ PRIORITÉ 1 : Vérifier d'abord si c'est un super admin PLATEFORME
        const { data: isPlatformAdmin, error: platformAdminError } = await supabase.rpc('is_platform_super_admin');
        
        if (!isMounted) return;
        
        if (!platformAdminError && isPlatformAdmin === true) {
          // ✅ C'EST UN SUPER ADMIN PLATEFORME - Ignorer complètement l'espace client
          console.log('✅ [Layout] Super admin PLATEFORME détecté');
          setIsSuperAdmin(true);
          setIsClient(false);
          setIsClientSuperAdmin(false);
          return;
        }
        
        // ✅ PRIORITÉ 2 : Vérifier si c'est un client
        const { data: espaceClient, error: espaceError } = await supabase
          .from('espaces_membres_clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!isMounted) return;
        
        if (!espaceError && espaceClient) {
          // ✅ C'EST UN CLIENT
          setIsClient(true);
          setIsSuperAdmin(false);
          const { data: isSuperAdminResult } = await supabase.rpc('check_my_super_admin_status');
          if (!isMounted) return;
          setIsClientSuperAdmin(isSuperAdminResult === true);
        } else {
          // ✅ PAS UN CLIENT - Vérifier si super admin plateforme (fallback)
          setIsClient(false);
          setIsClientSuperAdmin(false);
          await checkSuperAdmin();
        }
      } catch (error) {
        console.error('Erreur vérification rôle:', error);
        if (isMounted) {
          setIsClient(false);
          setIsClientSuperAdmin(false);
          setIsSuperAdmin(false);
        }
      }
    })();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ✅ Utiliser le hook personnalisé pour gérer les modules actifs
  const { activeModules } = useClientModules({
    menuItems,
    isSuperAdmin,
    isClientSuperAdmin,
  });

  const handleSignOut = async () => {
    try {
      console.log('🔄 Déconnexion en cours...');
      await signOut();
      console.log('✅ Déconnexion réussie');
      // L'App.tsx affichera automatiquement la page Auth quand user devient null
      // Forcer un rechargement pour s'assurer que tout est nettoyé
      window.location.reload();
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, forcer le rechargement pour nettoyer la session
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      {/* ✅ Overlay pour mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          sidebarOpen ? 'w-64' : 'w-20'
        } fixed left-0 top-0 h-screen bg-white/10 backdrop-blur-lg border-r border-white/10 transition-all duration-300 z-50`}
      >
        <div className="flex flex-col h-full">
          {/* Header Sidebar */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-white truncate">Crea+Entreprises</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Menu Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems
              .filter((item) => {
                // ✅ Modules de base toujours visibles pour tous (sauf "entreprises" pour les clients)
                const isBaseModule = item.id === 'dashboard' || item.id === 'entreprises' || item.id === 'settings';
                
                // ✅ PRIORITÉ 1 : SUPER ADMIN PLATEFORME voit TOUT (tous les modules)
                // Un super admin PLATEFORME n'est JAMAIS un client (pas d'espace membre client)
                if (isSuperAdmin && !isClient) {
                  console.log('✅ Super admin PLATEFORME détecté - TOUS les modules visibles');
                  return true; // ✅ TOUS les modules sont visibles pour le super admin PLATEFORME
                }
                
                // ✅ PRIORITÉ 2 : Les modules admin de la plateforme ne doivent JAMAIS apparaître pour les clients
                // Même si le client est super_admin de son espace, il ne doit pas voir les modules admin plateforme
                if (item.superAdminOnly) {
                  // Seuls les super_admin de la plateforme (PAS les clients) peuvent voir ces modules
                  // Si on arrive ici, c'est qu'on n'est pas super admin PLATEFORME
                  return false; // Les clients ne voient jamais les modules admin plateforme
                }
                
                // ✅ PRIORITÉ 3 : Pour les clients, masquer l'onglet "Entreprises" (garder "Mon Entreprise")
                // Les clients ne doivent pas voir l'onglet "Entreprises" car ils ne peuvent pas créer d'entreprises
                if (isClient) {
                  // Masquer l'onglet "entreprises" pour les clients (ils voient "Mon Entreprise" via le module "entreprises" mais pas l'onglet listé)
                  // En fait, "entreprises" est déjà le module "Mon Entreprise", donc on le garde mais on change juste son affichage dans Entreprises.tsx
                  if (item.id === 'entreprises') {
                    return true; // Les clients voient "Mon Entreprise" (mais pas pour créer)
                  }
                  // Vérifier si c'est un module de base (dashboard, settings)
                  if (item.id === 'dashboard' || item.id === 'settings') {
                    return true;
                  }
                  // Vérifier si le module est dans la liste des modules actifs
                  if (activeModules.size === 0) {
                    return false; // Seulement les modules de base si rien n'est chargé
                  }
                  return activeModules.has(item.id);
                }
                
                // ✅ PRIORITÉ 4 : Par défaut (non-client, non-super-admin), afficher les modules de base et les modules actifs
                if (isBaseModule) {
                  return true; // Modules de base toujours visibles
                }
                return activeModules.has(item.id);
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const isAdminItem = item.superAdminOnly;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      // Mettre à jour le hash pour persister la navigation
                      window.location.hash = item.id;
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
            {/* Notifications */}
            {sidebarOpen && (
              <div className="mb-2 flex justify-center">
                <NotificationBell />
              </div>
            )}
            {!sidebarOpen && (
              <div className="mb-2 flex justify-center">
                <NotificationBell />
              </div>
            )}
            
            <div className="flex items-center gap-3 px-4 py-2 text-gray-300">
              <UserIcon className="w-5 h-5" />
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  {/* Badge uniquement pour Super Admin plateforme, pas pour les clients */}
                  {isSuperAdmin && !isClient && (
                    <div className="flex items-center gap-2 mt-1">
                      <Shield className="w-3 h-3 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                        Plateforme
                      </span>
                    </div>
                  )}
                  {/* Pas de badge pour les clients - ils voient uniquement leur entreprise */}
                </div>
              )}
              {!sidebarOpen && isSuperAdmin && !isClient && (
                <div title="Administrateur Plateforme">
                  <Shield className="w-4 h-4 text-purple-400" />
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

      {/* ✅ Bouton menu mobile (hors sidebar) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-white/10 backdrop-blur-lg rounded-lg text-white hover:bg-white/20 transition-all"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Content */}
      <main
        className={`${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        } transition-all duration-300 min-h-screen`}
      >
        {children}
      </main>
    </div>
  );
}

