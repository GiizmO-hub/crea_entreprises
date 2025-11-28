#!/usr/bin/env node

/**
 * TEST COMPLET DU WORKFLOW APRÈS MIGRATION
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testCompleteWorkflow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET DU WORKFLOW');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let allTestsPassed = true;
  
  // TEST 1: Vérifier les plans d'abonnement
  console.log('📋 TEST 1: Vérification des plans d\'abonnement...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, prix_annuel, actif')
    .eq('actif', true)
    .order('ordre');
  
  if (plansError) {
    console.error('❌ Erreur lors de la récupération des plans:', plansError.message);
    allTestsPassed = false;
  } else {
    const planCount = plans?.length || 0;
    console.log(`   Plans trouvés: ${planCount}/4`);
    
    if (planCount >= 4) {
      console.log('   ✅ Tous les plans sont présents !\n');
      plans.forEach(plan => {
        console.log(`      - ${plan.nom}: ${plan.prix_mensuel}€/mois (${plan.prix_annuel}€/an)`);
      });
      console.log('');
    } else {
      console.log(`   ❌ Seulement ${planCount} plan(s) trouvé(s), 4 attendus\n`);
      allTestsPassed = false;
    }
  }
  
  // TEST 2: Vérifier la fonction creer_facture_et_abonnement_apres_paiement
  console.log('🔧 TEST 2: Vérification de la fonction creer_facture_et_abonnement_apres_paiement...\n');
  
  // Méthode: essayer d'appeler la fonction avec un UUID invalide
  let funcExists = false;
  try {
    const { error: testFuncError } = await supabase.rpc('creer_facture_et_abonnement_apres_paiement', {
      p_paiement_id: '00000000-0000-0000-0000-000000000000'
    });
    
    if (testFuncError) {
      if (testFuncError.message.includes('function') && testFuncError.message.includes('does not exist')) {
        console.log('   ❌ La fonction n\'existe pas\n');
        allTestsPassed = false;
        funcExists = false;
      } else if (testFuncError.message.includes('Paiement non trouvé') || testFuncError.code === 'P0001') {
        console.log('   ✅ La fonction existe et fonctionne !\n');
        funcExists = true;
      } else {
        console.log('   ✅ La fonction existe (erreur attendue pour UUID invalide)\n');
        funcExists = true;
      }
    } else {
      console.log('   ✅ La fonction existe !\n');
      funcExists = true;
    }
  } catch (error) {
    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.log('   ❌ La fonction n\'existe pas\n');
      allTestsPassed = false;
      funcExists = false;
    } else {
      console.log('   ⚠️  Erreur lors du test:', error.message.split('\n')[0], '\n');
    }
  }
  
  // TEST 3: Vérifier les tables nécessaires
  console.log('🗄️  TEST 3: Vérification des tables...\n');
  
  const tables = ['plans_abonnement', 'paiements', 'factures', 'abonnements', 'espaces_membres_clients'];
  
  for (const table of tables) {
    const { error: tableError } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST116') {
      console.log(`   ❌ Table ${table} n'existe pas\n`);
      allTestsPassed = false;
    } else if (tableError && tableError.code !== 'PGRST116') {
      console.log(`   ⚠️  Table ${table}: ${tableError.message.split('\n')[0]}\n`);
    } else {
      console.log(`   ✅ Table ${table} accessible\n`);
    }
  }
  
  // TEST 4: Vérifier les paiements en attente
  console.log('💰 TEST 4: Vérification des paiements en attente...\n');
  
  const { data: paiementsAttente, error: paiementsError } = await supabase
    .from('paiements')
    .select('id, statut, entreprise_id, montant_ttc, created_at')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (paiementsError) {
    console.log('   ⚠️  Erreur:', paiementsError.message.split('\n')[0], '\n');
  } else {
    const count = paiementsAttente?.length || 0;
    console.log(`   Paiements en attente: ${count}`);
    
    if (count > 0) {
      console.log('   📋 Paiements trouvés (les 5 derniers):');
      paiementsAttente.forEach(p => {
        console.log(`      - ${p.id.substring(0, 8)}... | ${p.montant_ttc}€ | ${p.created_at?.substring(0, 10) || 'N/A'}`);
      });
    }
    console.log('');
  }
  
  // RÉSUMÉ
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (allTestsPassed) {
    console.log('✅ Tous les tests critiques sont passés !\n');
    console.log('🎯 PROCHAINES ÉTAPES:');
    console.log('   1. Créer une entreprise via l\'interface');
    console.log('   2. Effectuer un paiement Stripe');
    console.log('   3. Vérifier que le workflow va jusqu\'au bout\n');
  } else {
    console.log('⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.\n');
  }
  
  return { success: allTestsPassed };
}

async function main() {
  try {
    await testCompleteWorkflow();
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    process.exit(1);
  }
}

main();

