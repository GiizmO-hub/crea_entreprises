import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, FileText, DollarSign, Building2, Plus } from 'lucide-react';

interface Stats {
  nbEntreprises: number;
  nbClients: number;
  nbFactures: number;
  caTotal: number;
}

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

  useEffect(() => {
    if (user) {
      checkUserRole().then(() => {
        // Attendre que le rôle soit vérifié avant de charger les stats
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

  const checkUserRole = async () => {
    if (!user) {
      setIsClient(false);
      return;
    }

    try {
      // D'abord vérifier si c'est un super admin plateforme
      const { data: isPlatformAdmin } = await supabase.rpc('is_platform_super_admin');
      
      if (isPlatformAdmin === true) {
        setIsClient(false);
        return;
      }

      // Ensuite vérifier si l'utilisateur a un espace_membre_client
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
        // Pour un client : récupérer son entreprise ET son client_id depuis l'espace membre
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
        // Pour un super admin plateforme : récupérer TOUTES les entreprises (pas seulement celles créées par lui)
        const { data: entreprises } = await supabase
          .from('entreprises')
          .select('id');

        entrepriseIds = entreprises?.map((e) => e.id) || [];
      }

      if (entrepriseIds.length === 0) {
        setLoading(false);
        return;
      }

      // Compter les clients (uniquement pour super admin plateforme)
      let nbClients = 0;
      if (!isClient) {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .in('entreprise_id', entrepriseIds);
        nbClients = count || 0;
      }

      // Compter les factures (pour la plateforme, exclure celles avec source='client')
      let facturesQuery = supabase
        .from('factures')
        .select('*', { count: 'exact', head: true })
        .in('entreprise_id', entrepriseIds);
      
      // Si l'utilisateur n'est pas un client, exclure les factures créées par les clients
      if (!isClient) {
        // Pour la plateforme, on ne peut pas filtrer directement par source dans le count
        // On va récupérer les données et filtrer côté client
        const { data: allFactures, count: totalCount } = await supabase
          .from('factures')
          .select('id, source', { count: 'exact' })
          .in('entreprise_id', entrepriseIds);
        
        const nbFactures = (allFactures || []).filter(f => {
          const source = f.source || 'plateforme';
          return source !== 'client';
        }).length;
        
        // Calculer le CA total (factures payées, uniquement celles de la plateforme)
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
        // Pour les clients, compter uniquement LEURS factures (filtrées par client_id)
        if (!userClientId) {
          setLoading(false);
          return;
        }
        
        const { count: nbFactures } = await supabase
          .from('factures')
          .select('*', { count: 'exact', head: true })
          .in('entreprise_id', entrepriseIds)
          .eq('client_id', userClientId);
        
        // Calculer le CA total (factures payées, uniquement celles du client)
        const { data: factures } = await supabase
          .from('factures')
          .select('montant_ttc')
          .in('entreprise_id', entrepriseIds)
          .eq('client_id', userClientId)
          .eq('statut', 'payee');

        const caTotal = factures?.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0) || 0;

        setStats({
          nbEntreprises: isClient ? 1 : entrepriseIds.length, // Pour un client, toujours 1 entreprise
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tableau de bord</h1>
        <p className="text-gray-300">
          {isClient ? 'Vue d\'ensemble de votre espace client' : 'Vue d\'ensemble de votre activité'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isClient ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6 mb-8`}>
        {/* Carte Entreprise - Masquée pour les clients */}
        {!isClient && (
          <div
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
        )}

        {/* Carte Clients - Masquée pour les clients */}
        {!isClient && (
          <div
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
        )}

        <div
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
        <div className={`grid grid-cols-1 ${isClient ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
          {/* Bouton "Créer une entreprise" - Masqué pour les clients */}
          {!isClient && (
            <button
              onClick={() => window.location.hash = 'entreprises'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-left flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Créer une entreprise
            </button>
          )}
          {/* Bouton "Ajouter un client" - Masqué pour les clients */}
          {!isClient && (
            <button
              onClick={() => window.location.hash = 'clients'}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-left flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Ajouter un client
            </button>
          )}
          <button
            onClick={() => window.location.hash = 'factures'}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-left flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer une facture
          </button>
          {isClient && (
            <button
              onClick={() => window.location.hash = 'documents'}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all text-left flex items-center gap-2"
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
