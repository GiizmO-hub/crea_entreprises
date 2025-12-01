import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Calendar,
  Users,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';

interface FinancialStats {
  caTotal: number;
  caHT: number;
  caTTC: number;
  tvaTotal: number;
  facturesPayees: number;
  facturesEnAttente: number;
  facturesEnRetard: number;
  montantEnAttente: number;
  montantEnRetard: number;
  facturesTotal: number;
  evolutionMensuelle: Array<{
    mois: string;
    ca: number;
    factures: number;
  }>;
  repartitionClients: Array<{
    client_id: string;
    client_nom: string;
    montant: number;
    factures: number;
  }>;
  repartitionTypes: {
    factures: number;
    proformas: number;
    avoirs: number;
  };
}

export default function Finance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [stats, setStats] = useState<FinancialStats>({
    caTotal: 0,
    caHT: 0,
    caTTC: 0,
    tvaTotal: 0,
    facturesPayees: 0,
    facturesEnAttente: 0,
    facturesEnRetard: 0,
    montantEnAttente: 0,
    montantEnRetard: 0,
    facturesTotal: 0,
    evolutionMensuelle: [],
    repartitionClients: [],
    repartitionTypes: {
      factures: 0,
      proformas: 0,
      avoirs: 0,
    },
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'mois' | 'trimestre' | 'annee' | 'toutes'>('toutes');

  // Formater une date en AAAA-MM-JJ en heure locale (sans décalage UTC)
  const formatDateLocal = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (user && isClient !== null) {
      loadFinancialStats();
    }
  }, [user, isClient, selectedPeriod]);

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

      const { data: espaceClient } = await supabase
        .from('espaces_membres_clients')
        .select('id, entreprise_id, client_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsClient(!!espaceClient);
    } catch (error) {
      console.error('❌ Erreur vérification rôle:', error);
      setIsClient(false);
    }
  };

  const loadFinancialStats = async () => {
    if (!user) return;

    setLoading(true);
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

      // Calculer la période en utilisant des dates locales (pour éviter le décalage UTC)
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      if (selectedPeriod === 'mois') {
        // 1er jour du mois courant
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        // Dernier jour du même mois (géré automatiquement, y compris février 28/29 jours)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (selectedPeriod === 'trimestre') {
        const quarter = Math.floor(now.getMonth() / 3); // 0,1,2,3
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      } else if (selectedPeriod === 'annee') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }
      // Si 'toutes', startDate et endDate restent null et on charge toutes les factures

      // Charger toutes les factures
      // ✅ Utiliser left join pour ne pas exclure les factures sans client
      let facturesQuery = supabase
        .from('factures')
        .select('*, clients(nom, prenom, entreprise_nom)')
        .in('entreprise_id', entrepriseIds);

      // ❌ Ne pas filtrer par date côté base pour éviter les incohérences
      // On appliquera le filtre de période côté client sur la même logique que l'affichage (date_facturation || date_emission || created_at)

      if (isClient && userClientId) {
        facturesQuery = facturesQuery.eq('client_id', userClientId);
      } else {
        // Pour la plateforme, exclure les factures créées par les clients
        facturesQuery = facturesQuery.or('source.is.null,source.neq.client');
      }

      const { data: factures, error } = await facturesQuery;

      if (error) {
        console.error('❌ [Finance] Erreur chargement factures:', error);
        throw error;
      }

      let facturesList = factures || [];
      
      // ✅ Filtrer côté client pour les périodes spécifiques
      if (startDate && endDate && selectedPeriod !== 'toutes') {
        const startDateObj = new Date(startDate.getTime());
        const endDateObj = new Date(endDate.getTime());
        endDateObj.setHours(23, 59, 59, 999); // Fin de journée locale
        
        facturesList = facturesList.filter(f => {
          const rawDate = (f as any).date_facturation || (f as any).date_emission || f.created_at;
          if (!rawDate) return false;
          const factureDate = new Date(rawDate);
          return factureDate >= startDateObj && factureDate <= endDateObj;
        });
        
        console.log(`🔍 [Finance] Filtrage côté client (période ${selectedPeriod}): ${facturesList.length} factures après filtrage (sur ${factures?.length || 0} chargées)`);
      }
      
      console.log(`📊 [Finance] Factures chargées: ${facturesList.length} (période: ${selectedPeriod}, date début: ${formatDateLocal(startDate) || 'toutes'}, date fin: ${formatDateLocal(endDate) || 'toutes'})`);
      console.log(`📊 [Finance] Détails factures:`, facturesList.map(f => ({
        id: f.id,
        numero: f.numero,
        statut: f.statut,
        date_facturation: f.date_emission,
        montant_ttc: f.montant_ttc,
        source: f.source
      })));

      // Calculer les statistiques
      // ✅ Inclure TOUTES les factures dans le total, pas seulement les payées
      const facturesPayees = facturesList.filter(f => f.statut === 'payee');
      const facturesEnAttente = facturesList.filter(f => f.statut === 'en_attente');
      const facturesEnRetard = facturesList.filter(f => {
        if (f.statut !== 'payee' && f.date_echeance) {
          return new Date(f.date_echeance) < now;
        }
        return false;
      });

      // ✅ Calculer le CA sur TOUTES les factures (pas seulement payées) pour avoir une vue complète
      // Le CA "payé" sera calculé séparément
      const caHTTotal = facturesList.reduce((sum, f) => sum + Number(f.montant_ht || 0), 0);
      const caTTCTotal = facturesList.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
      
      // CA des factures payées uniquement
      const caHT = facturesPayees.reduce((sum, f) => sum + Number(f.montant_ht || 0), 0);
      const caTTC = facturesPayees.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
      const tvaTotal = caTTC - caHT;
      const montantEnAttente = facturesEnAttente.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);
      const montantEnRetard = facturesEnRetard.reduce((sum, f) => sum + Number(f.montant_ttc || 0), 0);

      console.log(`📊 [Finance] Stats calculées:`, {
        totalFactures: facturesList.length,
        payees: facturesPayees.length,
        enAttente: facturesEnAttente.length,
        enRetard: facturesEnRetard.length,
        caTTC: caTTC,
        caHT: caHT,
        caTTCTotal: caTTCTotal,
        caHTTotal: caHTTotal
      });

      // Évolution mensuelle
      const evolutionMap = new Map<string, { ca: number; factures: number }>();
      facturesPayees.forEach(f => {
        const date = new Date(f.date_emission || f.created_at);
        const moisKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const moisLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        
        if (!evolutionMap.has(moisKey)) {
          evolutionMap.set(moisKey, { ca: 0, factures: 0 });
        }
        const current = evolutionMap.get(moisKey)!;
        current.ca += Number(f.montant_ttc || 0);
        current.factures += 1;
        evolutionMap.set(moisKey, current);
      });

      const evolutionMensuelle = Array.from(evolutionMap.entries())
        .map(([key, data]) => ({
          mois: new Date(key + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          ca: data.ca,
          factures: data.factures,
        }))
        .sort((a, b) => a.mois.localeCompare(b.mois));

      // Répartition par client
      const clientsMap = new Map<string, { nom: string; montant: number; factures: number }>();
      facturesPayees.forEach(f => {
        const clientId = f.client_id;
        const clientNom = (f.clients as any)?.entreprise_nom || 
                         `${(f.clients as any)?.prenom || ''} ${(f.clients as any)?.nom || ''}`.trim() || 
                         'Client inconnu';
        
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, { nom: clientNom, montant: 0, factures: 0 });
        }
        const current = clientsMap.get(clientId)!;
        current.montant += Number(f.montant_ttc || 0);
        current.factures += 1;
        clientsMap.set(clientId, current);
      });

      const repartitionClients = Array.from(clientsMap.entries())
        .map(([client_id, data]) => ({
          client_id,
          client_nom: data.nom,
          montant: data.montant,
          factures: data.factures,
        }))
        .sort((a, b) => b.montant - a.montant)
        .slice(0, 10); // Top 10

      // Répartition par type
      const repartitionTypes = {
        factures: facturesList.filter(f => f.type === 'facture' && f.statut !== 'annulee').length,
        proformas: facturesList.filter(f => f.type === 'proforma').length,
        avoirs: 0, // Les avoirs sont dans une table séparée, on peut les charger si nécessaire
      };

      setStats({
        caTotal: caTTC, // CA des factures payées uniquement
        caHT,
        caTTC,
        tvaTotal,
        facturesPayees: facturesPayees.length,
        facturesEnAttente: facturesEnAttente.length,
        facturesEnRetard: facturesEnRetard.length,
        montantEnAttente,
        montantEnRetard,
        facturesTotal: facturesList.length,
        evolutionMensuelle,
        repartitionClients,
        repartitionTypes,
      });
      
      console.log(`✅ [Finance] Stats mises à jour:`, {
        caTotal: caTTC,
        facturesTotal: facturesList.length,
        facturesPayees: facturesPayees.length
      });
    } catch (error) {
      console.error('❌ Erreur chargement stats financières:', error);
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

  const maxCA = Math.max(...stats.evolutionMensuelle.map(e => e.ca), 1);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Finance</h1>
          <p className="text-sm sm:text-base text-gray-300">
            Vue d'ensemble financière de votre activité
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPeriod('toutes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === 'toutes'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setSelectedPeriod('mois')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === 'mois'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            Mois
          </button>
          <button
            onClick={() => setSelectedPeriod('trimestre')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === 'trimestre'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            Trimestre
          </button>
          <button
            onClick={() => setSelectedPeriod('annee')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === 'annee'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            Année
          </button>
        </div>
      </div>

      {/* Cartes principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {stats.caTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <div className="text-sm text-gray-300">Chiffre d'affaires TTC (payé)</div>
          <div className="text-xs text-gray-400 mt-1">
            HT: {stats.caHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <div className="text-xs text-blue-300 mt-1">
            {stats.facturesPayees} facture{stats.facturesPayees > 1 ? 's' : ''} payée{stats.facturesPayees > 1 ? 's' : ''} sur {stats.facturesTotal}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.facturesPayees}</div>
          <div className="text-sm text-gray-300">Factures payées</div>
          <div className="text-xs text-gray-400 mt-1">
            Sur {stats.facturesTotal} factures
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-400" />
            </div>
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.facturesEnAttente}</div>
          <div className="text-sm text-gray-300">En attente</div>
          <div className="text-xs text-gray-400 mt-1">
            {stats.montantEnAttente.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-lg rounded-xl p-6 border border-red-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <ArrowDownRight className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.facturesEnRetard}</div>
          <div className="text-sm text-gray-300">En retard</div>
          <div className="text-xs text-gray-400 mt-1">
            {stats.montantEnRetard.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8">
        {/* Évolution mensuelle */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Évolution du CA
            </h2>
          </div>
          {stats.evolutionMensuelle.length > 0 ? (
            <div className="space-y-4">
              {stats.evolutionMensuelle.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">{item.mois}</span>
                    <span className="text-sm font-semibold text-white">
                      {item.ca.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${(item.ca / maxCA) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {item.factures} facture{item.factures > 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune donnée disponible</p>
            </div>
          )}
        </div>

        {/* Répartition par client */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Clients
            </h2>
          </div>
          {stats.repartitionClients.length > 0 ? (
            <div className="space-y-4">
              {stats.repartitionClients.map((client, index) => (
                <div key={client.client_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{client.client_nom}</p>
                      <p className="text-xs text-gray-400">{client.factures} facture{client.factures > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">
                      {client.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                    <p className="text-xs text-gray-400">
                      {((client.montant / stats.caTTC) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun client trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Répartition par type */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Répartition par type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
            <div className="text-sm text-gray-300 mb-1">Factures</div>
            <div className="text-2xl font-bold text-white">{stats.repartitionTypes.factures}</div>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
            <div className="text-sm text-gray-300 mb-1">Proformas</div>
            <div className="text-2xl font-bold text-white">{stats.repartitionTypes.proformas}</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
            <div className="text-sm text-gray-300 mb-1">Avoirs</div>
            <div className="text-2xl font-bold text-white">{stats.repartitionTypes.avoirs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

