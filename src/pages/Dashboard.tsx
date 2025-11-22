import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, FileText, DollarSign, Building2 } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

interface Stats {
  nbEntreprises: number;
  nbClients: number;
  nbFactures: number;
  caTotal: number;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    nbEntreprises: 0,
    nbClients: 0,
    nbFactures: 0,
    caTotal: 0,
  });

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      // Récupérer les entreprises de l'utilisateur
      const { data: entreprises } = await supabase
        .from('entreprises')
        .select('id')
        .eq('user_id', user.id);

      const entrepriseIds = entreprises?.map((e) => e.id) || [];

      if (entrepriseIds.length === 0) {
        setLoading(false);
        return;
      }

      // Compter les clients
      const { count: nbClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .in('entreprise_id', entrepriseIds);

      // Compter les factures
      const { count: nbFactures } = await supabase
        .from('factures')
        .select('*', { count: 'exact', head: true })
        .in('entreprise_id', entrepriseIds);

      // Calculer le CA total (factures payées)
      const { data: factures } = await supabase
        .from('factures')
        .select('montant_ttc')
        .in('entreprise_id', entrepriseIds)
        .eq('statut', 'payee');

      const caTotal = factures?.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) || 0;

      setStats({
        nbEntreprises: entrepriseIds.length,
        nbClients: nbClients || 0,
        nbFactures: nbFactures || 0,
        caTotal,
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tableau de bord</h1>
        <p className="text-gray-300">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          onClick={() => onNavigate('entreprises')}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.nbEntreprises}</div>
          <div className="text-sm text-gray-400">Entreprise{stats.nbEntreprises > 1 ? 's' : ''}</div>
        </div>

        <div
          onClick={() => onNavigate('clients')}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Users className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.nbClients}</div>
          <div className="text-sm text-gray-400">Client{stats.nbClients > 1 ? 's' : ''}</div>
        </div>

        <div
          onClick={() => onNavigate('factures')}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.nbFactures}</div>
          <div className="text-sm text-gray-400">Facture{stats.nbFactures > 1 ? 's' : ''}</div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {stats.caTotal.toFixed(2)}€
          </div>
          <div className="text-sm text-gray-400">Chiffre d'affaires</div>
        </div>
      </div>

      {/* Actions Rapides */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('entreprises')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-left"
          >
            Créer une entreprise
          </button>
          <button
            onClick={() => onNavigate('clients')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-left"
          >
            Ajouter un client
          </button>
          <button
            onClick={() => onNavigate('factures')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-left"
          >
            Créer une facture
          </button>
        </div>
      </div>
    </div>
  );
}
