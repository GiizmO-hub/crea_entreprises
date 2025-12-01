import { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, CheckCircle, Clock, AlertCircle, XCircle, CreditCard, Send, FileText, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendClientCredentialsEmail } from '../services/emailService';

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
  isPlatformUser?: boolean; // Nouvelle prop pour vérifier si c'est un utilisateur plateforme
}

export function EntrepriseAccordion({ entreprises, loading, isPlatformUser = false }: EntrepriseAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());
  const [generatingInvoices, setGeneratingInvoices] = useState<Set<string>>(new Set());
  const [validatingPayments, setValidatingPayments] = useState<Set<string>>(new Set());

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

                {/* ✅ Section Paiement & Facturation (Uniquement pour plateforme) */}
                {isPlatformUser && (
                  <div className="mt-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 p-6">
                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                      Gestion Paiement & Facturation
                      <span className="ml-2 px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                        Plateforme uniquement
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Bouton Valider Paiement */}
                      <button
                        onClick={() => handleValidatePayment(entreprise.id, setValidatingPayments)}
                        disabled={validatingPayments.has(entreprise.id) || entreprise.statut_paiement === 'paye'}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {validatingPayments.has(entreprise.id) ? (
                          <>
                            <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Validation...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>
                              {entreprise.statut_paiement === 'paye' ? 'Paiement Validé' : 'Valider Paiement'}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Bouton Générer Facture - Désactivé si workflow < 100% */}
                      <button
                        onClick={() => handleGenerateInvoice(entreprise.id, setGeneratingInvoices)}
                        disabled={generatingInvoices.has(entreprise.id) || progress < 100}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={progress < 100 ? 'Le workflow doit être à 100% avant de générer la facture' : 'Générer la facture'}
                      >
                        {generatingInvoices.has(entreprise.id) ? (
                          <>
                            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Génération...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            <span>Générer Facture {progress < 100 && `(${progress}%)`}</span>
                          </>
                        )}
                      </button>

                      {/* Bouton Envoyer Identifiants */}
                      <button
                        onClick={() => handleSendCredentials(entreprise.id, setSendingEmails)}
                        disabled={sendingEmails.has(entreprise.id)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingEmails.has(entreprise.id) ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Envoi...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Envoyer Identifiants</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Statut paiement détaillé */}
                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Statut du paiement:</span>
                        <span className={`font-semibold ${
                          entreprise.statut_paiement === 'paye' ? 'text-green-400' :
                          entreprise.statut_paiement === 'en_attente' ? 'text-yellow-400' :
                          entreprise.statut_paiement === 'refuse' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {entreprise.statut_paiement === 'paye' ? '✅ Payé' :
                           entreprise.statut_paiement === 'en_attente' ? '⏳ En attente' :
                           entreprise.statut_paiement === 'refuse' ? '❌ Refusé' :
                           '📋 Non requis'}
                        </span>
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

// ✅ Fonctions pour gérer paiement, facturation et email (réservées plateforme)
async function handleValidatePayment(
  entrepriseId: string,
  setValidatingPayments: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  setValidatingPayments((prev) => new Set(prev).add(entrepriseId));
  
  try {
    const { data, error } = await supabase.rpc('valider_paiement_entreprise', {
      p_entreprise_id: entrepriseId
    });

    if (error) {
      console.error('Erreur validation paiement:', error);
      alert('❌ Erreur lors de la validation du paiement: ' + error.message);
      return;
    }

    if (data?.success) {
      // ✅ NOUVEAU : Si l'email doit être envoyé, l'envoyer automatiquement
      if (data.email_a_envoyer && data.email && data.password) {
        // Récupérer les informations du client pour l'email
        const { data: clientData } = await supabase
          .from('clients')
          .select('nom, prenom, email')
          .eq('entreprise_id', entrepriseId)
          .limit(1)
          .single();

        const { data: entrepriseData } = await supabase
          .from('entreprises')
          .select('nom')
          .eq('id', entrepriseId)
          .single();

        if (clientData && entrepriseData) {
          try {
            const emailResult = await sendClientCredentialsEmail({
              clientEmail: data.email,
              clientName: `${clientData.prenom || ''} ${clientData.nom || ''}`.trim(),
              email: data.email,
              password: data.password,
              entrepriseNom: entrepriseData.nom || '',
            });

            if (emailResult.success) {
              alert('✅ Paiement validé avec succès !\n✅ Espace client créé avec Super Admin automatique.\n✅ Identifiants envoyés par email.');
            } else {
              alert('✅ Paiement validé avec succès !\n✅ Espace client créé.\n⚠️ Erreur lors de l\'envoi de l\'email: ' + emailResult.error);
            }
          } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
            alert('✅ Paiement validé avec succès !\n✅ Espace client créé.\n⚠️ Erreur lors de l\'envoi de l\'email.');
          }
        } else {
          alert('✅ Paiement validé avec succès !\n✅ Espace client créé avec Super Admin automatique.');
        }
      } else {
        alert('✅ Paiement validé avec succès !\n✅ Espace client créé avec Super Admin automatique.');
      }
      
      // Recharger la page pour mettre à jour les données
      window.location.reload();
    } else {
      alert('❌ Erreur: ' + (data?.error || 'Erreur inconnue'));
    }
  } catch (error) {
    console.error('Erreur validation paiement:', error);
    alert('❌ Erreur lors de la validation du paiement');
  } finally {
    setValidatingPayments((prev) => {
      const next = new Set(prev);
      next.delete(entrepriseId);
      return next;
    });
  }
}

async function handleGenerateInvoice(
  entrepriseId: string,
  setGeneratingInvoices: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  setGeneratingInvoices((prev) => new Set(prev).add(entrepriseId));
  
  try {
    // Récupérer les informations de l'entreprise avec les compteurs pour vérifier le workflow
    const { data: entreprise, error: entrepriseError } = await supabase
      .from('entreprises')
      .select('id, nom, email, statut_paiement, statut')
      .eq('id', entrepriseId)
      .single();

    if (entrepriseError || !entreprise) {
      alert('❌ Erreur: Entreprise non trouvée');
      return;
    }

    // ✅ VÉRIFICATION CRITIQUE : Vérifier que le workflow est à 100% avant de générer la facture
    // Récupérer les compteurs pour calculer le workflow
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entrepriseId);

    // Récupérer le client pour vérifier l'espace
    const { data: firstClient } = await supabase
      .from('clients')
      .select('id')
      .eq('entreprise_id', entrepriseId)
      .limit(1)
      .single();

    const { count: espacesCount } = await supabase
      .from('espaces_membres_clients')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', firstClient?.id || '');

    const { count: abonnementsCount } = await supabase
      .from('abonnements')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entrepriseId)
      .eq('statut', 'actif');

    // Vérifier les super admins
    let superAdminsCount = 0;
    if (firstClient?.id) {
      const { data: espaceData } = await supabase
        .from('espaces_membres_clients')
        .select('user_id')
        .eq('client_id', firstClient.id)
        .maybeSingle();

      if (espaceData?.user_id) {
        const { data: userData } = await supabase
          .from('utilisateurs')
          .select('role')
          .eq('id', espaceData.user_id)
          .eq('role', 'client_super_admin')
          .maybeSingle();
        
        if (userData) superAdminsCount = 1;
      }
    }

    // Calculer le pourcentage du workflow
    let steps = 0;
    let completed = 0;
    const missingSteps: string[] = [];

    steps++;
    if (entreprise.statut === 'active') {
      completed++;
    } else {
      missingSteps.push('Entreprise non active');
    }

    steps++;
    if (clientsCount && clientsCount > 0) {
      completed++;
    } else {
      missingSteps.push('Aucun client créé');
    }

    steps++;
    if (espacesCount && espacesCount > 0) {
      completed++;
    } else {
      missingSteps.push('Aucun espace client créé');
    }

    steps++;
    if (abonnementsCount && abonnementsCount > 0) {
      completed++;
    } else {
      missingSteps.push('Aucun abonnement actif');
    }

    steps++;
    if (superAdminsCount > 0) {
      completed++;
    } else {
      missingSteps.push('Aucun Super Admin activé');
    }

    const workflowProgress = Math.round((completed / steps) * 100);

    // ✅ BLOQUER la génération de facture si le workflow n'est pas à 100%
    if (workflowProgress < 100) {
      alert(`❌ Impossible de générer la facture : le workflow n'est qu'à ${workflowProgress}%.\n\nLe workflow doit être à 100% avant de générer la facture.\n\nÉtapes manquantes :\n${missingSteps.map(s => `• ${s}`).join('\n')}`);
      return;
    }

    // ✅ CORRECTION: Utiliser correctement la fonction RPC existante generate_invoice_for_entreprise
    // Cette fonction existe dans la migration 20250123000012_add_payment_and_invoice_functions.sql
    const { data, error } = await supabase.rpc('generate_invoice_for_entreprise', {
      p_entreprise_id: entrepriseId
    });

    // ✅ CORRECTION: Vérifier l'erreur dans le résultat de supabase.rpc()
    if (error) {
      console.error('Erreur génération facture:', error);
      
      // Si la fonction RPC n'existe pas ou a une erreur, créer une facture manuellement
      if (error.code === '42883' || error.message?.includes('does not exist')) {
        console.warn('⚠️ Fonction RPC non trouvée, création manuelle de la facture...');
        
        // Récupérer le client de l'entreprise
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('id, nom, prenom, email')
          .eq('entreprise_id', entrepriseId)
          .limit(1)
          .single();

        if (clientsError || !clients) {
          alert('❌ Erreur: Aucun client trouvé pour cette entreprise');
          return;
        }

        // Récupérer l'abonnement pour calculer le montant
        const { data: abonnements } = await supabase
          .from('abonnements')
          .select('montant_mensuel, plan_id')
          .eq('entreprise_id', entrepriseId)
          .eq('statut', 'actif')
          .limit(1)
          .single();

        const montant = abonnements?.montant_mensuel || 0;

        if (montant === 0) {
          alert('⚠️ Aucun abonnement actif trouvé. Montant de la facture: 0€');
        }

        // ✅ Générer un numéro unique pour la facture
        const generateUniqueNumero = async (entrepriseId: string, maxRetries: number = 10): Promise<string> => {
          const prefix = 'FAC';
          
          // Chercher tous les numéros existants pour cette entreprise
          const { data: allNumeros } = await supabase
            .from('factures')
            .select('numero')
            .eq('entreprise_id', entrepriseId);

          if (!allNumeros || allNumeros.length === 0) {
            return `${prefix}-001`;
          }

          // Extraire tous les numéros numériques
          const numerosNumeriques: number[] = [];
          allNumeros.forEach(item => {
            const numeroStr = item.numero || '';
            const matches = numeroStr.match(/(\d+)(?!.*\d)/);
            if (matches && matches[1]) {
              const num = parseInt(matches[1]);
              if (!isNaN(num)) {
                numerosNumeriques.push(num);
              }
            }
          });

          const maxNum = numerosNumeriques.length > 0 ? Math.max(...numerosNumeriques) : 0;
          let nextNum = maxNum + 1;
          let numero = `${prefix}-${String(nextNum).padStart(3, '0')}`;

          // Vérifier l'unicité et réessayer si nécessaire
          let retries = 0;
          while (retries < maxRetries) {
            const { data: existing } = await supabase
              .from('factures')
              .select('id')
              .eq('entreprise_id', entrepriseId)
              .eq('numero', numero)
              .maybeSingle();

            if (!existing) {
              return numero;
            }

            nextNum++;
            numero = `${prefix}-${String(nextNum).padStart(3, '0')}`;
            retries++;
          }

          // Si on n'a pas trouvé, utiliser un timestamp
          const timestamp = Date.now().toString().slice(-6);
          return `${prefix}-${timestamp}`;
        };

        const numero = await generateUniqueNumero(entrepriseId);
        
        // ✅ Réessayer avec un nouveau numéro en cas d'erreur de doublon
        let retries = 0;
        let numeroFinal = numero;
        let factureData: any = null;
        
        while (retries < 3) {
          const { data, error: factureError } = await supabase
            .from('factures')
            .insert({
              entreprise_id: entrepriseId,
              client_id: clients.id,
              numero: numeroFinal,
              type: 'facture',
              date_emission: new Date().toISOString().split('T')[0],
              montant_ht: montant,
              tva: montant * 0.20,
              montant_ttc: montant * 1.20,
              statut: 'envoyee',
              source: 'plateforme' // ✅ Facture créée par la plateforme
            })
            .select()
            .single();

          if (!factureError) {
            factureData = data;
            break;
          }

          // Si c'est une erreur de doublon, générer un nouveau numéro
          if (factureError.code === '23505' && factureError.message?.includes('factures_entreprise_id_numero_key')) {
            console.warn(`⚠️ [EntrepriseAccordion] Doublon détecté (tentative ${retries + 1}/3), génération d'un nouveau numéro`);
            numeroFinal = await generateUniqueNumero(entrepriseId);
            retries++;
          } else {
            console.error('Erreur création facture:', factureError);
            alert('❌ Erreur lors de la création de la facture: ' + factureError.message);
            return;
          }
        }

        if (!factureData) {
          alert('❌ Impossible de créer la facture après plusieurs tentatives');
          return;
        }

        alert('✅ Facture générée avec succès !\n\nNuméro: ' + numeroFinal);
        return;
      }
      
      alert('❌ Erreur lors de la génération de la facture: ' + error.message);
      return;
    }

    // Vérifier le résultat de la fonction RPC
    if (data?.success || data?.facture_id) {
      alert('✅ Facture générée avec succès !\n\nNuméro: ' + (data.numero || data.numero_facture || 'N/A'));
      // Optionnel: télécharger la facture en PDF
      // TODO: Implémenter le téléchargement PDF
    } else if (data?.error) {
      alert('❌ Erreur: ' + data.error);
    } else {
      alert('❌ Erreur: Réponse inattendue de la fonction RPC');
    }
  } catch (error) {
    console.error('Erreur génération facture:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    alert('❌ Erreur lors de la génération de la facture: ' + errorMessage);
  } finally {
    setGeneratingInvoices((prev) => {
      const next = new Set(prev);
      next.delete(entrepriseId);
      return next;
    });
  }
}

async function handleSendCredentials(
  entrepriseId: string,
  setSendingEmails: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  setSendingEmails((prev) => new Set(prev).add(entrepriseId));
  
  try {
    // Récupérer le client de l'entreprise
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, email, nom, prenom')
      .eq('entreprise_id', entrepriseId)
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      alert('❌ Aucun client trouvé pour cette entreprise');
      return;
    }

    const client = clients[0];
    
    if (!client.email) {
      alert('❌ Le client doit avoir un email pour recevoir les identifiants');
      return;
    }

    // Récupérer l'entreprise pour le nom
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('nom')
      .eq('id', entrepriseId)
      .single();

    // Récupérer ou régénérer les identifiants
    const { data: credentialsData, error: credentialsError } = await supabase.rpc(
      'get_or_regenerate_client_credentials',
      { p_client_id: client.id }
    );

    if (credentialsError || !credentialsData?.success) {
      // Si la fonction échoue, récupérer depuis espaces_membres_clients
      const { data: espace } = await supabase
        .from('espaces_membres_clients')
        .select('email, mot_de_passe_temporaire')
        .eq('client_id', client.id)
        .single();

      if (!espace?.email || !espace?.mot_de_passe_temporaire) {
        alert('❌ Erreur: Aucun espace membre trouvé pour ce client');
        return;
      }

      // Envoyer l'email avec les identifiants existants
      const emailResult = await sendClientCredentialsEmail({
        clientEmail: espace.email,
        clientName: `${client.prenom || ''} ${client.nom || ''}`.trim(),
        email: espace.email,
        password: espace.mot_de_passe_temporaire || '',
        entrepriseNom: entreprise?.nom || 'Votre entreprise',
      });

      if (emailResult.success) {
        alert('✅ Identifiants envoyés par email avec succès !\n\nDestinataire: ' + espace.email);
      } else {
        alert('❌ Erreur lors de l\'envoi de l\'email: ' + emailResult.error);
      }
      return;
    }

    // Envoyer l'email avec les identifiants
    const emailResult = await sendClientCredentialsEmail({
      clientEmail: credentialsData.email || client.email,
      clientName: `${credentialsData.client_prenom || client.prenom || ''} ${credentialsData.client_nom || client.nom || ''}`.trim(),
      email: credentialsData.email || client.email,
      password: credentialsData.password || '',
      entrepriseNom: credentialsData.entreprise_nom || entreprise?.nom || 'Votre entreprise',
    });

    if (emailResult.success) {
      alert('✅ Identifiants envoyés par email avec succès !\n\nDestinataire: ' + (credentialsData.email || client.email));
    } else {
      alert('❌ Erreur lors de l\'envoi de l\'email: ' + emailResult.error);
    }
  } catch (error) {
    console.error('Erreur envoi identifiants:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    alert('❌ Erreur lors de l\'envoi des identifiants: ' + errorMessage);
  } finally {
    setSendingEmails((prev) => {
      const next = new Set(prev);
      next.delete(entrepriseId);
      return next;
    });
  }
}

