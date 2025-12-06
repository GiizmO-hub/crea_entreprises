import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, FileText, DollarSign, Building2, Plus, Sun, Cloud, CloudRain } from 'lucide-react';

interface Stats {
  nbEntreprises: number;
  nbClients: number;
  nbFactures: number;
  caTotal: number;
}

type WeatherMode = 'sunny' | 'cloudy' | 'stormy';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [stats, setStats] = useState<Stats>({
    nbEntreprises: 0,
    nbClients: 0,
    nbFactures: 0,
    caTotal: 0,
  });
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('sunny');
  const [caPrevision, setCaPrevision] = useState(0);

  useEffect(() => {
    if (user) {
      checkUserRole().then(() => {
        if (!loading) {
          loadStats();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isClient]);

  useEffect(() => {
    if (caPrevision > 0) {
      const ratio = stats.caTotal / caPrevision;
      if (ratio >= 1.0) {
        setWeatherMode('sunny');
      } else if (ratio >= 0.7) {
        setWeatherMode('cloudy');
      } else {
        setWeatherMode('stormy');
      }
    } else {
      calculatePrevisionFromHistory();
    }
  }, [stats.caTotal, caPrevision]);

  const calculatePrevisionFromHistory = async () => {
    if (!user) return;
    try {
      let entrepriseIds: string[] = [];
      let userClientId: string | null = null;

      if (isClient) {
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('entreprise_id, client_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (espaceClient?.entreprise_id) {
          entrepriseIds = [espaceClient.entreprise_id];
          userClientId = espaceClient.client_id;
        }
      } else {
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id');
        entrepriseIds = entreprises?.map((e) => e.id) || [];
      }

      if (entrepriseIds.length === 0) return;

      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      
      let query = supabase
        .from('factures')
        .select('montant_ttc, date_emission')
        .in('entreprise_id', entrepriseIds)
        .eq('statut', 'payee')
        .gte('date_emission', threeMonthsAgo.toISOString().split('T')[0]);

      if (isClient && userClientId) {
        query = query.eq('client_id', userClientId);
      }

      const { data: factures } = await query;

      if (factures && factures.length > 0) {
        const total = factures.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
        const moyenne = total / 3;
        setCaPrevision(moyenne);
      } else {
        setCaPrevision(stats.caTotal || 1000);
      }
    } catch (error) {
      console.error('Erreur calcul prévision:', error);
      setCaPrevision(stats.caTotal || 1000);
    }
  };

  const checkUserRole = async () => {
    if (!user) {
      setIsClient(false);
      return;
    }

    try {
      const { data: isPlatformAdmin } = await supabase.rpc('is_platform_super_admin');
      
      if (isPlatformAdmin === true) {
        setIsClient(false);
        return;
      }

      const { data: espaceClient, error: espaceError } = await supabase
        .from('espaces_membres_clients')
        .select('id, entreprise_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!espaceError && espaceClient) {
        setIsClient(true);
      } else {
        setIsClient(false);
      }
    } catch (error) {
      console.error('❌ Erreur vérification rôle:', error);
      setIsClient(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      let entrepriseIds: string[] = [];
      let userClientId: string | null = null;
      
      if (isClient) {
        const { data: espaceClient } = await supabase
          .from('espaces_membres_clients')
          .select('entreprise_id, client_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (espaceClient?.entreprise_id) {
          entrepriseIds = [espaceClient.entreprise_id];
          userClientId = espaceClient.client_id;
        }
      } else {
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id');

        entrepriseIds = entreprises?.map((e) => e.id) || [];
      }

      if (entrepriseIds.length === 0) {
        setLoading(false);
        return;
      }

      let nbClients = 0;
      if (!isClient) {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .in('entreprise_id', entrepriseIds);
        nbClients = count || 0;
      }

      let facturesQuery = supabase
        .from('factures')
        .select('*', { count: 'exact', head: true })
        .in('entreprise_id', entrepriseIds);
      
      if (!isClient) {
        const { data: allFactures } = await supabase
          .from('factures')
          .select('id, source')
          .in('entreprise_id', entrepriseIds);
        
        const nbFactures = (allFactures || []).filter(f => {
          const source = f.source || 'plateforme';
          return source !== 'client';
        }).length;
        
        const { data: factures } = await supabase
          .from('factures')
          .select('montant_ttc, source')
          .in('entreprise_id', entrepriseIds)
          .eq('statut', 'payee');
        
        const facturesPlateforme = (factures || []).filter(f => {
          const source = f.source || 'plateforme';
          return source !== 'client';
        });
        
        const caTotal = facturesPlateforme.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
        
        setStats({
          nbEntreprises: isClient ? 1 : entrepriseIds.length,
          nbClients,
          nbFactures,
          caTotal,
        });
        return;
      } else {
        if (!userClientId) {
          setLoading(false);
          return;
        }
        
        const { count: nbFactures } = await supabase
          .from('factures')
          .select('*', { count: 'exact', head: true })
          .in('entreprise_id', entrepriseIds)
          .eq('client_id', userClientId);
        
        const { data: factures } = await supabase
          .from('factures')
          .select('montant_ttc')
          .in('entreprise_id', entrepriseIds)
          .eq('client_id', userClientId)
          .eq('statut', 'payee');

        const caTotal = factures?.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) || 0;

        setStats({
          nbEntreprises: isClient ? 1 : entrepriseIds.length,
          nbClients,
          nbFactures: nbFactures || 0,
          caTotal,
        });
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0e27]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-400"></div>
      </div>
    );
  }

  const weatherConfig = {
    sunny: {
      bgGradient: 'from-[#0a0e27] via-[#1a1f3a] to-[#0f1629]',
      cardBg: 'bg-[#1a2332]/60 backdrop-blur-xl',
      border: 'border-cyan-500/20',
      cardHover: 'hover:border-cyan-400/40',
      icon: Sun,
      iconColor: 'text-cyan-300',
      iconBg: 'bg-cyan-500/10',
      textColor: 'text-cyan-200',
    },
    cloudy: {
      bgGradient: 'from-[#0a0e27] via-[#1a1f3a] to-[#0f1629]',
      cardBg: 'bg-[#1a2332]/60 backdrop-blur-xl',
      border: 'border-blue-500/20',
      cardHover: 'hover:border-blue-400/40',
      icon: Cloud,
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-500/10',
      textColor: 'text-blue-200',
    },
    stormy: {
      bgGradient: 'from-[#0a0e27] via-[#1a1f3a] to-[#0f1629]',
      cardBg: 'bg-[#1a2332]/60 backdrop-blur-xl',
      border: 'border-slate-500/20',
      cardHover: 'hover:border-slate-400/40',
      icon: CloudRain,
      iconColor: 'text-slate-300',
      iconBg: 'bg-slate-500/10',
      textColor: 'text-slate-200',
    },
  };

  const config = weatherConfig[weatherMode];
  const WeatherIcon = config.icon;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
        {/* En-tête */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
              Tableau de bord
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              {isClient ? 'Vue d\'ensemble de votre espace client' : 'Vue d\'ensemble de votre activité'}
            </p>
          </div>
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-xl ${config.cardBg} ${config.border} border backdrop-blur-xl`}>
            <div className={`p-2 rounded-lg ${config.iconBg}`}>
              <WeatherIcon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className={`text-sm font-medium ${config.textColor}`}>
              {weatherMode === 'sunny' && 'Beau temps'}
              {weatherMode === 'cloudy' && 'Temps mitigé'}
              {weatherMode === 'stormy' && 'Orage'}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isClient ? 'lg:grid-cols-3' : 'lg:grid-cols-2 xl:grid-cols-4'} gap-5 mb-8`}>
          {!isClient && (
            <div className={`${config.cardBg} rounded-2xl p-6 ${config.border} ${config.cardHover} border transition-all duration-300 group`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                  <Building2 className="w-6 h-6 text-cyan-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-cyan-400/60" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.nbEntreprises}</div>
              <div className="text-sm text-slate-400">Entreprise{stats.nbEntreprises > 1 ? 's' : ''}</div>
            </div>
          )}

          {!isClient && (
            <div className={`${config.cardBg} rounded-2xl p-6 ${config.border} ${config.cardHover} border transition-all duration-300 group`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.nbClients}</div>
              <div className="text-sm text-slate-400">Client{stats.nbClients > 1 ? 's' : ''}</div>
            </div>
          )}

          <div className={`${config.cardBg} rounded-2xl p-6 ${config.border} ${config.cardHover} border transition-all duration-300 group`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.nbFactures}</div>
            <div className="text-sm text-slate-400">Facture{stats.nbFactures > 1 ? 's' : ''}</div>
          </div>

          <div className={`${config.cardBg} rounded-2xl p-6 ${config.border} ${config.cardHover} border transition-all duration-300 group relative overflow-hidden`}>
            {/* Effet de brillance subtile */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                <DollarSign className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats.caTotal.toFixed(2)}€
            </div>
            <div className="text-sm text-slate-400">Chiffre d'affaires</div>
            {caPrevision > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="text-xs text-slate-500 mb-1">Prévision: {caPrevision.toFixed(2)}€</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.caTotal >= caPrevision 
                          ? 'bg-cyan-400' 
                          : stats.caTotal >= caPrevision * 0.7 
                          ? 'bg-blue-400' 
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${Math.min((stats.caTotal / caPrevision) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs font-medium ${
                    stats.caTotal >= caPrevision 
                      ? 'text-cyan-400' 
                      : stats.caTotal >= caPrevision * 0.7 
                      ? 'text-blue-400' 
                      : 'text-slate-400'
                  }`}>
                    {((stats.caTotal / caPrevision) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Rapides */}
        <div className={`${config.cardBg} rounded-2xl p-6 ${config.border} border backdrop-blur-xl`}>
          <h2 className="text-xl font-bold text-white mb-5">Actions rapides</h2>
          <div className={`grid grid-cols-1 ${isClient ? 'sm:grid-cols-2' : 'sm:grid-cols-2 md:grid-cols-3'} gap-4`}>
            {!isClient && (
              <button
                onClick={() => window.location.hash = 'entreprises'}
                className="px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded-xl font-medium transition-all text-left flex items-center gap-2 border border-cyan-500/20 hover:border-cyan-500/40"
              >
                <Plus className="w-5 h-5" />
                Créer une entreprise
              </button>
            )}
            {!isClient && (
              <button
                onClick={() => window.location.hash = 'clients'}
                className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl font-medium transition-all text-left flex items-center gap-2 border border-blue-500/20 hover:border-blue-500/40"
              >
                <Plus className="w-5 h-5" />
                Ajouter un client
              </button>
            )}
            <button
              onClick={() => window.location.hash = 'factures'}
              className="px-6 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl font-medium transition-all text-left flex items-center gap-2 border border-indigo-500/20 hover:border-indigo-500/40"
            >
              <Plus className="w-5 h-5" />
              Créer une facture
            </button>
            {isClient && (
              <button
                onClick={() => window.location.hash = 'documents'}
                className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl font-medium transition-all text-left flex items-center gap-2 border border-purple-500/20 hover:border-purple-500/40"
              >
                <Plus className="w-5 h-5" />
                Ajouter un document
              </button>
            )}
          </div>
        </div>
    </div>
  );
}
