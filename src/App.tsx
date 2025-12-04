import { useState, lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useAutoMigrations } from './hooks/useAutoMigrations';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import PaymentSuccess from './pages/PaymentSuccess';

// Lazy loading des pages pour optimiser le code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Entreprises = lazy(() => import('./pages/Entreprises'));
const Clients = lazy(() => import('./pages/Clients'));
const Abonnements = lazy(() => import('./pages/Abonnements'));
const Factures = lazy(() => import('./pages/Factures'));
const Modules = lazy(() => import('./pages/Modules'));
const Collaborateurs = lazy(() => import('./pages/Collaborateurs'));
const Documents = lazy(() => import('./pages/Documents'));
const GestionEquipe = lazy(() => import('./pages/GestionEquipe'));
const GestionProjets = lazy(() => import('./pages/GestionProjets'));
const GestionStock = lazy(() => import('./pages/GestionStock'));
const GestionCRM = lazy(() => import('./pages/GestionCRM'));
const GestionPlans = lazy(() => import('./pages/GestionPlans'));
const Parametres = lazy(() => import('./pages/Parametres'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Finance = lazy(() => import('./pages/Finance'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));

// Composant de chargement pour les pages lazy-loaded
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
    </div>
  </div>
);

// Fonction pour obtenir la page depuis le hash
function getPageFromHash(): string {
  const hash = window.location.hash.replace('#', '');
  const pageMap: Record<string, string> = {
    // Modules de base
    'dashboard': 'dashboard',
    'tableau-de-bord': 'dashboard',
    'tableau_de_bord': 'dashboard',
    
    // Modules entreprise
    'entreprises': 'entreprises',
    'mon-entreprise': 'entreprises',
    'mon_entreprise': 'entreprises',
    
    // Modules clients
    'clients': 'clients',
    'gestion-clients': 'clients',
    'gestion_clients': 'clients',
    'gestion-des-clients': 'clients',
    'gestion_des_clients': 'clients',
    
    // Modules facturation
    'factures': 'factures',
    'facturation': 'factures',
    
    // Modules documents
    'documents': 'documents',
    'gestion-documents': 'documents',
    'gestion_documents': 'documents',
    'gestion-de-documents': 'documents',
    'gestion_de_documents': 'documents',
    'documents-entreprise': 'documents',
    
    // Modules collaborateurs
    'collaborateurs': 'collaborateurs',
    'gestion-collaborateurs': 'collaborateurs',
    'gestion_des_collaborateurs': 'collaborateurs',
    'gestion-des-collaborateurs': 'collaborateurs',
    'salaries': 'collaborateurs',
    'conges': 'collaborateurs',
    
    // Modules gestion équipe
    'gestion-equipe': 'gestion-equipe',
    'gestion_equipe': 'gestion-equipe',
    'gestion-d-equipe': 'gestion-equipe',
    'gestion-d-équipe': 'gestion-equipe',
    
    // Modules gestion projets
    'gestion-projets': 'gestion-projets',
    'gestion_projets': 'gestion-projets',
    'gestion-de-projets': 'gestion-projets',
    'gestion_de_projets': 'gestion-projets',
    
    // Modules gestion stock
    'gestion-stock': 'gestion-stock',
    'gestion_stock': 'gestion-stock',
    'gestion-de-stock': 'gestion-stock',
    'gestion_de_stock': 'gestion-stock',
    'stock': 'gestion-stock',
    
    // Modules CRM
    'crm-avance': 'crm-avance',
    'crm_avance': 'crm-avance',
    'crm': 'crm-avance',
    
    // Modules comptabilité
    'comptabilite': 'comptabilite',
    'comptabilité': 'comptabilite',
    'comptabilite-avancee': 'comptabilite',
    'comptabilite_avancee': 'comptabilite',
    'comptabilité-avancée': 'comptabilite',
    'fiches-paie': 'comptabilite',
    'bilans-comptables': 'comptabilite',
    
    // Modules finance
    'finance': 'finance',
    'finances': 'finance',
    'previsionnel': 'finance',
    'ai-previsionnel': 'finance',
    'gestion-budget': 'finance',
    'time-tracking': 'finance',
    'modeles-previsionnels': 'finance',
    'historiques-ai': 'finance',
    
    // Modules abonnements
    'abonnements': 'abonnements',
    
    // Modules gestion plans
    'gestion-plans': 'gestion-plans',
    'gestion_plans': 'gestion-plans',
    'gestionPlans': 'gestion-plans',
    
    // Modules paramètres
    'settings': 'settings',
    'parametres': 'settings',
    'paramètres': 'settings',
    'automatisations': 'settings',
    'messagerie': 'settings',
    'administration': 'settings',
    'api': 'settings',
    'api-keys': 'settings',
    'support_prioritaire': 'settings',
    'support_dedie': 'settings',
    'personnalisation': 'settings',
    'connexions-admin': 'settings',
    'declarations-admin': 'settings',
    'n8n-automation': 'settings',
    'gestion-secteurs': 'settings',
    
    // Modules système
    'modules': 'modules',
    'notifications': 'notifications',
  };
  
  return pageMap[hash] || 'dashboard';
}

function AppContent() {
  const { user, loading } = useAuth();
  const { migrationsApplied } = useAutoMigrations(); // Appliquer les migrations automatiquement
  // ✅ Initialiser currentPage depuis le hash pour persister au rafraîchissement
  const [currentPage, setCurrentPage] = useState(() => getPageFromHash());

  // ✅ Gérer les routes spéciales (payment-success, etc.)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const path = window.location.pathname;
      
      // Si on est sur /payment-success, ne pas changer la page
      if (path === '/payment-success' || path.startsWith('/payment-success') || hash === 'payment-success') {
        return; // PaymentSuccess gère son propre affichage
      }
      
      // Sinon, utiliser le hash pour la navigation
      const mappedPage = getPageFromHash();
      if (mappedPage !== currentPage) {
        setCurrentPage(mappedPage);
      }
    };

    // Appeler une première fois
    handleHashChange();

    // Écouter les changements de hash et de pathname
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [currentPage]);

  // ✅ Si on est sur /payment-success, afficher directement PaymentSuccess (même sans auth)
  const path = window.location.pathname;
  if (path === '/payment-success' || path.startsWith('/payment-success')) {
    return <PaymentSuccess />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        );
      case 'entreprises':
        return (
          <Suspense fallback={<PageLoader />}>
            <Entreprises />
          </Suspense>
        );
      case 'clients':
        return (
          <Suspense fallback={<PageLoader />}>
            <Clients />
          </Suspense>
        );
      case 'abonnements':
        return (
          <Suspense fallback={<PageLoader />}>
            <Abonnements />
          </Suspense>
        );
      case 'factures':
        return (
          <Suspense fallback={<PageLoader />}>
            <Factures />
          </Suspense>
        );
      case 'comptabilite':
        return (
          <Suspense fallback={<PageLoader />}>
            <Comptabilite />
          </Suspense>
        );
      case 'finance':
        return (
          <Suspense fallback={<PageLoader />}>
            <Finance />
          </Suspense>
        );
      case 'modules':
        return (
          <Suspense fallback={<PageLoader />}>
            <Modules />
          </Suspense>
        );
      case 'collaborateurs':
        return (
          <Suspense fallback={<PageLoader />}>
            <Collaborateurs />
          </Suspense>
        );
      case 'documents':
        return (
          <Suspense fallback={<PageLoader />}>
            <Documents />
          </Suspense>
        );
      case 'gestion-equipe':
        return (
          <Suspense fallback={<PageLoader />}>
            <GestionEquipe />
          </Suspense>
        );
      case 'gestion-projets':
        return (
          <Suspense fallback={<PageLoader />}>
            <GestionProjets />
          </Suspense>
        );
      case 'gestion-stock':
        return (
          <Suspense fallback={<PageLoader />}>
            <GestionStock />
          </Suspense>
        );
      case 'crm-avance':
        return (
          <Suspense fallback={<PageLoader />}>
            <GestionCRM />
          </Suspense>
        );
      case 'gestion-plans':
        return (
          <Suspense fallback={<PageLoader />}>
            <GestionPlans />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <Parametres />
          </Suspense>
        );
      case 'notifications':
        return (
          <Suspense fallback={<PageLoader />}>
            <Notifications />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        );
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={(page) => {
      // Mettre à jour le hash pour persister la navigation
      window.location.hash = page;
      setCurrentPage(page);
    }}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContentWrapper />
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Wrapper pour s'assurer que le contexte est bien disponible
function AppContentWrapper() {
  return <AppContent />;
}

export default App;
