#!/usr/bin/env node
/**
 * Script de diagnostic pour analyser pourquoi le workflow reste à 40% dans le frontend
 * 
 * Analyse:
 * 1. Les paiements en attente
 * 2. Si les webhooks Stripe ont été reçus
 * 3. Si valider_paiement_carte_immediat a été appelé
 * 4. L'état des entreprises récentes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnosticFrontend() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC WORKFLOW FRONTEND');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Analyser les entreprises récentes (dernières 24h)
    console.log('📊 ÉTAPE 1: Analyse des entreprises récentes...\n');
    
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (entreprisesError) {
      throw new Error(`Erreur récupération entreprises: ${entreprisesError.message}`);
    }
    
    if (!entreprises || entreprises.length === 0) {
      console.log('⚠️ Aucune entreprise créée dans les dernières 24h\n');
    } else {
      console.log(`✅ ${entreprises.length} entreprise(s) trouvée(s)\n`);
      
      for (const entreprise of entreprises) {
        console.log(`─`.repeat(60));
        console.log(`🏢 Entreprise: ${entreprise.nom} (ID: ${entreprise.id})`);
        console.log(`   → Statut: ${entreprise.statut}`);
        console.log(`   → Statut paiement: ${entreprise.statut_paiement || 'N/A'}`);
        console.log(`   → Créée le: ${new Date(entreprise.created_at).toLocaleString('fr-FR')}`);
        
        // 2. Analyser les paiements pour cette entreprise
        console.log(`\n   💳 Paiements associés:`);
        const { data: paiements } = await supabase
          .from('paiements')
          .select('*')
          .eq('entreprise_id', entreprise.id)
          .order('created_at', { ascending: false });
        
        if (paiements && paiements.length > 0) {
          paiements.forEach((p, i) => {
            console.log(`      ${i + 1}. Paiement ID: ${p.id}`);
            console.log(`         → Statut: ${p.statut}`);
            console.log(`         → Montant: ${p.montant_ttc}€`);
            console.log(`         → Stripe Payment ID: ${p.stripe_payment_id || 'NULL'}`);
            console.log(`         → Date paiement: ${p.date_paiement || 'NULL'}`);
            console.log(`         → Créé le: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
            
            // Vérifier si une facture existe
            const factureResponse = await supabase
              .from('factures')
              .select('*')
              .eq('entreprise_id', entreprise.id)
              .limit(1);
            
            const factures = factureResponse.data;
            if (factures && factures.length > 0) {
              console.log(`         ✅ Facture créée: ${factures[0].numero} (${factures[0].statut})`);
            } else {
              console.log(`         ❌ Aucune facture trouvée`);
            }
            
            // Vérifier si un abonnement existe
            const abonnementResponse = await supabase
              .from('abonnements')
              .select('*')
              .eq('entreprise_id', entreprise.id)
              .limit(1);
            
            const abonnements = abonnementResponse.data;
            if (abonnements && abonnements.length > 0) {
              console.log(`         ✅ Abonnement créé: ${abonnements[0].statut}`);
            } else {
              console.log(`         ❌ Aucun abonnement trouvé`);
            }
            
            // Calculer le pourcentage
            const completion = [
              entreprise.id && true,  // Entreprise créée
              paiements.length > 0,    // Paiement créé
              p.statut === 'paye',     // Paiement validé
              factures && factures.length > 0,  // Facture créée
              abonnements && abonnements.length > 0,  // Abonnement créé
            ].filter(Boolean).length * 20;
            
            console.log(`         📊 Progression: ${completion}%`);
          });
        } else {
          console.log(`      ❌ Aucun paiement trouvé`);
        }
        
        // 3. Analyser les clients
        console.log(`\n   👤 Clients associés:`);
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .eq('entreprise_id', entreprise.id);
        
        if (clients && clients.length > 0) {
          clients.forEach((c, i) => {
            console.log(`      ${i + 1}. ${c.prenom} ${c.nom} (${c.email})`);
            console.log(`         → Statut: ${c.statut}`);
            
            // Vérifier l'espace membre
            const { data: espaces } = await supabase
              .from('espaces_membres_clients')
              .select('*')
              .eq('client_id', c.id)
              .eq('entreprise_id', entreprise.id)
              .limit(1);
            
            if (espaces && espaces.length > 0) {
              console.log(`         ✅ Espace membre créé: ${espaces[0].statut_compte || 'actif'}`);
            } else {
              console.log(`         ❌ Aucun espace membre trouvé`);
            }
          });
        } else {
          console.log(`      ❌ Aucun client trouvé`);
        }
        
        console.log('');
      }
    }
    
    // 4. Analyser les paiements en attente globalement
    console.log('📋 ÉTAPE 2: Analyse des paiements en attente...\n');
    
    const { data: paiementsEnAttente } = await supabase
      .from('paiements')
      .select('*, entreprises(nom), clients(nom, prenom)')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (paiementsEnAttente && paiementsEnAttente.length > 0) {
      console.log(`⚠️ ${paiementsEnAttente.length} paiement(s) en attente trouvé(s)\n`);
      
      paiementsEnAttente.forEach((p, i) => {
        console.log(`${i + 1}. Paiement ID: ${p.id}`);
        console.log(`   → Entreprise: ${p.entreprises?.nom || 'N/A'}`);
        console.log(`   → Client: ${p.clients?.prenom || ''} ${p.clients?.nom || 'N/A'}`);
        console.log(`   → Montant: ${p.montant_ttc}€`);
        console.log(`   → Stripe Payment ID: ${p.stripe_payment_id || 'NULL'}`);
        console.log(`   → Créé le: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
        console.log(`   → Âge: ${Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000 / 60)} minutes\n`);
      });
      
      console.log('💡 RECOMMANDATIONS:');
      console.log('   → Si Stripe Payment ID est NULL, le paiement Stripe n\'a pas été validé');
      console.log('   → Vérifiez les logs du webhook Stripe dans Supabase Dashboard');
      console.log('   → Vérifiez que la page PaymentSuccess.tsx est bien appelée après paiement');
      console.log('   → Vérifiez que valider_paiement_carte_immediat est bien appelé\n');
    } else {
      console.log('✅ Aucun paiement en attente trouvé\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📋 DIAGNOSTIC TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR lors du diagnostic:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

diagnosticFrontend().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

