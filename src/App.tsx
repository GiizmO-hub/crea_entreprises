import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Entreprises from './pages/Entreprises';
import Clients from './pages/Clients';
import Factures from './pages/Factures';

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
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'entreprises':
        return <Entreprises onNavigate={setCurrentPage} />;
      case 'clients':
        return <Clients onNavigate={setCurrentPage} />;
      case 'factures':
        return <Factures onNavigate={setCurrentPage} />;
      case 'comptabilite':
        return <div className="p-8 text-white">Module Comptabilité - À venir</div>;
      case 'finance':
        return <div className="p-8 text-white">Module Finance - À venir</div>;
      case 'settings':
        return <div className="p-8 text-white">Paramètres - À venir</div>;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
