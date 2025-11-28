#!/usr/bin/env node
/**
 * Script de diagnostic du workflow après paiement
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC WORKFLOW APRÈS PAIEMENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver les paiements récents (derniers 24h)
    console.log('📋 1. Recherche des paiements récents (dernières 24h)...\n');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: paiements, error: paiementsError } = await supabase
      .from('paiements')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (paiementsError) {
      console.error('❌ Erreur récupération paiements:', paiementsError);
      return;
    }

    if (!paiements || paiements.length === 0) {
      console.log('⚠️  Aucun paiement récent trouvé');
      return;
    }

    console.log(`✅ ${paiements.length} paiement(s) trouvé(s)\n`);

    // 2. Analyser chaque paiement
    for (const paiement of paiements) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 Paiement ID: ${paiement.id}`);
      console.log(`   Statut: ${paiement.statut}`);
      console.log(`   Montant: ${paiement.montant_ttc}€`);
      console.log(`   Type: ${paiement.type_paiement}`);
      console.log(`   Créé le: ${new Date(paiement.created_at).toLocaleString('fr-FR')}`);
      console.log('');

      // Analyser les notes
      console.log('📝 Analyse des notes du paiement:');
      if (paiement.notes) {
        try {
          let notesParsed;
          if (typeof paiement.notes === 'string') {
            notesParsed = JSON.parse(paiement.notes);
          } else {
            notesParsed = paiement.notes;
          }

          console.log('   Notes (JSON):', JSON.stringify(notesParsed, null, 2));
          
          const entrepriseId = notesParsed?.entreprise_id || notesParsed?.['entreprise_id'];
          const clientId = notesParsed?.client_id || notesParsed?.['client_id'];
          const planId = notesParsed?.plan_id || notesParsed?.['plan_id'];
          const authUserId = notesParsed?.auth_user_id || notesParsed?.['auth_user_id'];

          console.log('');
          console.log('🔍 Informations extraites:');
          console.log(`   ✅ Entreprise ID: ${entrepriseId || '❌ MANQUANT'}`);
          console.log(`   ✅ Client ID: ${clientId || '❌ MANQUANT'}`);
          console.log(`   ✅ Plan ID: ${planId || '❌ MANQUANT'}`);
          console.log(`   ✅ Auth User ID: ${authUserId || '❌ MANQUANT'}`);

          // Vérifier si l'entreprise existe
          if (entrepriseId) {
            const { data: entreprise, error: entError } = await supabase
              .from('entreprises')
              .select('id, nom, statut')
              .eq('id', entrepriseId)
              .single();

            if (entError) {
              console.log(`   ❌ Entreprise non trouvée: ${entError.message}`);
            } else {
              console.log(`   ✅ Entreprise trouvée: ${entreprise.nom} (${entreprise.statut})`);
            }
          }

          // Vérifier si le client existe
          if (clientId) {
            const { data: client, error: clientError } = await supabase
              .from('clients')
              .select('id, nom, prenom, email')
              .eq('id', clientId)
              .single();

            if (clientError) {
              console.log(`   ❌ Client non trouvé: ${clientError.message}`);
            } else {
              const clientName = client.entreprise_nom || `${client.prenom || ''} ${client.nom || ''}`.trim();
              console.log(`   ✅ Client trouvé: ${clientName} (${client.email})`);
            }
          }

          // Vérifier si le plan existe
          if (planId) {
            const { data: plan, error: planError } = await supabase
              .from('plans_abonnement')
              .select('id, nom')
              .eq('id', planId)
              .single();

            if (planError) {
              console.log(`   ❌ Plan non trouvé: ${planError.message}`);
            } else {
              console.log(`   ✅ Plan trouvé: ${plan.nom}`);
            }
          }

          // Vérifier la facture
          const { data: factures, error: facturesError } = await supabase
            .from('factures')
            .select('id, numero_facture, statut')
            .eq('entreprise_id', entrepriseId || '00000000-0000-0000-0000-000000000000')
            .limit(1);

          if (facturesError) {
            console.log(`   ❌ Erreur vérification facture: ${facturesError.message}`);
          } else if (factures && factures.length > 0) {
            console.log(`   ✅ Facture trouvée: ${factures[0].numero_facture} (${factures[0].statut})`);
          } else {
            console.log(`   ❌ Aucune facture trouvée pour cette entreprise`);
          }

          // Vérifier l'abonnement
          if (clientId) {
            const { data: abonnements, error: abonnementsError } = await supabase
              .from('abonnements')
              .select('id, statut, plan_id')
              .eq('client_id', authUserId || clientId)
              .limit(1);

            if (abonnementsError) {
              console.log(`   ❌ Erreur vérification abonnement: ${abonnementsError.message}`);
            } else if (abonnements && abonnements.length > 0) {
              console.log(`   ✅ Abonnement trouvé: ${abonnements[0].id} (${abonnements[0].statut})`);
            } else {
              console.log(`   ❌ Aucun abonnement trouvé pour ce client`);
            }
          }

          // Vérifier l'espace membre
          if (clientId) {
            const { data: espaces, error: espacesError } = await supabase
              .from('espaces_membres_clients')
              .select('id, statut_compte, actif')
              .eq('client_id', clientId)
              .limit(1);

            if (espacesError) {
              console.log(`   ❌ Erreur vérification espace membre: ${espacesError.message}`);
            } else if (espaces && espaces.length > 0) {
              console.log(`   ✅ Espace membre trouvé: ${espaces[0].id} (${espaces[0].statut_compte})`);
            } else {
              console.log(`   ❌ Aucun espace membre trouvé pour ce client`);
            }
          }

        } catch (parseError) {
          console.log(`   ❌ Erreur parsing notes: ${parseError.message}`);
          console.log(`   Notes brutes: ${paiement.notes}`);
        }
      } else {
        console.log('   ❌ Pas de notes dans le paiement');
      }

      console.log('');
    }

    console.log('\n✅ Diagnostic terminé !\n');

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
    process.exit(1);
  }
}

diagnostic();

