import { useState, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Auth from './pages/Auth';

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
const GestionPlans = lazy(() => import('./pages/GestionPlans'));
const Parametres = lazy(() => import('./pages/Parametres'));

// Composant de chargement pour les pages lazy-loaded
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

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
        return <div className="p-8 text-white">Module Comptabilité - À venir</div>;
      case 'finance':
        return <div className="p-8 text-white">Module Finance - À venir</div>;
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
      default:
        return (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        );
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
