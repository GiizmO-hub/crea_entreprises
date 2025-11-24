import { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, CheckCircle, Clock, AlertCircle, XCircle, CreditCard } from 'lucide-react';

interface EntrepriseConfig {
  id: string;
  nom: string;
  statut_paiement?: string;
  statut?: string;
  clients: number;
  espaces: number;
  abonnements: number;
  superAdmins: number;
  created_at?: string;
}

interface EntrepriseAccordionProps {
  entreprises: EntrepriseConfig[];
  loading?: boolean;
}

export function EntrepriseAccordion({ entreprises, loading }: EntrepriseAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getStatutPaiementBadge = (statut?: string) => {
    switch (statut) {
      case 'paye':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 inline-flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Paiement validé</span>
          </span>
        );
      case 'en_attente':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>En attente de paiement</span>
          </span>
        );
      case 'refuse':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Paiement refusé</span>
          </span>
        );
      case 'non_requis':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            <span>Non requis</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/5 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-white/10 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (entreprises.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400 text-lg mb-2">Aucune entreprise créée pour votre compte.</p>
        <p className="text-gray-500 text-sm">
          Créez votre entreprise depuis l'onglet "Mon Entreprise" dans le menu principal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entreprises.map((entreprise) => {
        const isExpanded = expandedIds.has(entreprise.id);
        const progress = calculateProgress(entreprise);

        return (
          <div
            key={entreprise.id}
            className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg border border-white/10 overflow-hidden transition-all hover:border-white/20"
          >
            {/* Header - Toujours visible */}
            <button
              onClick={() => toggleExpanded(entreprise.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 text-left">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-semibold text-lg">{entreprise.nom}</h3>
                    {getStatutPaiementBadge(entreprise.statut_paiement)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>{entreprise.clients} client(s)</span>
                    <span>•</span>
                    <span>{entreprise.espaces} espace(s)</span>
                    <span>•</span>
                    <span>{entreprise.abonnements} abonnement(s)</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Configuration</div>
                  <div className="text-sm font-semibold text-white">
                    {progress}%
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Contenu - Visible quand expandé */}
            {isExpanded && (
              <div className="px-6 pb-6 border-t border-white/10 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Statut de configuration */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Statut de configuration
                    </h4>
                    <div className="space-y-3">
                      <ConfigStatusItem
                        label="Entreprise"
                        status={entreprise.statut === 'active' ? 'complete' : 'pending'}
                        value={entreprise.statut === 'active' ? 'Créée' : 'En attente'}
                      />
                      <ConfigStatusItem
                        label="Client"
                        status={entreprise.clients > 0 ? 'complete' : 'pending'}
                        value={entreprise.clients > 0 ? `${entreprise.clients} créé(s)` : 'En attente de création'}
                      />
                      <ConfigStatusItem
                        label="Espace client"
                        status={entreprise.espaces > 0 ? 'complete' : 'pending'}
                        value={entreprise.espaces > 0 ? `${entreprise.espaces} créé(s)` : 'En attente de création'}
                      />
                      <ConfigStatusItem
                        label="Abonnement"
                        status={entreprise.abonnements > 0 ? 'complete' : 'pending'}
                        value={entreprise.abonnements > 0 ? 'Actif' : 'En attente de configuration'}
                      />
                      <ConfigStatusItem
                        label="Administrateur client"
                        status={entreprise.superAdmins > 0 ? 'complete' : 'pending'}
                        value={entreprise.superAdmins > 0 ? `${entreprise.superAdmins} activé(s)` : 'En attente d\'activation'}
                      />
                    </div>
                  </div>

                  {/* Informations complémentaires */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-4">Informations</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Statut</span>
                        <span className="text-white font-medium capitalize">
                          {entreprise.statut || 'N/A'}
                        </span>
                      </div>
                      {entreprise.created_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date de création</span>
                          <span className="text-white">
                            {new Date(entreprise.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Super Administrateurs</span>
                        <span className="text-white font-medium">
                          {entreprise.superAdmins}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message de prochaine étape */}
                {progress < 100 && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-yellow-400 text-sm font-medium mb-1">
                          Prochaine étape
                        </p>
                        <p className="text-gray-300 text-sm">
                          Configurez vos clients, espaces membres et abonnements depuis l'onglet "Gestion des clients" ci-dessus.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConfigStatusItem({ 
  label, 
  status, 
  value 
}: { 
  label: string; 
  status: 'complete' | 'pending'; 
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        {status === 'complete' ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Clock className="w-4 h-4 text-yellow-400" />
        )}
        <span className="text-gray-300 text-sm">{label}</span>
      </div>
      <span className={`text-sm font-medium ${
        status === 'complete' ? 'text-green-400' : 'text-yellow-400'
      }`}>
        {value}
      </span>
    </div>
  );
}

function calculateProgress(entreprise: EntrepriseConfig): number {
  let steps = 0;
  let completed = 0;

  // Entreprise
  steps++;
  if (entreprise.statut === 'active') completed++;

  // Client
  steps++;
  if (entreprise.clients > 0) completed++;

  // Espace client
  steps++;
  if (entreprise.espaces > 0) completed++;

  // Abonnement
  steps++;
  if (entreprise.abonnements > 0) completed++;

  // Super Admin
  steps++;
  if (entreprise.superAdmins > 0) completed++;

  return Math.round((completed / steps) * 100);
}

