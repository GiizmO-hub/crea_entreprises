#!/usr/bin/env node

/**
 * TEST COMPLET DU WORKFLOW - Création directe des entreprises
 * Crée les entreprises directement via l'API, puis teste le workflow de paiement
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONFIG = {
  numberOfTests: 2 // Réduire à 2 pour être plus rapide
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserOrCreate() {
  console.log('👤 Récupération d\'un utilisateur de test...\n');
  
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error || !users || users.length === 0) {
    console.error('❌ Aucun utilisateur trouvé');
    return null;
  }
  
  const user = users[0];
  console.log(`✅ Utilisateur: ${user.email} (${user.id.substring(0, 8)}...)\n`);
  return user;
}

async function getPlans() {
  const { data: plans, error } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, prix_annuel')
    .eq('actif', true)
    .order('ordre')
    .limit(3);
  
  if (error || !plans || plans.length === 0) {
    console.error('❌ Aucun plan trouvé');
    return null;
  }
  
  return plans;
}

async function createEntrepriseDirect(user, plan, index) {
  const entrepriseName = `Test Entreprise ${index + 1} - ${Date.now()}`;
  
  console.log(`\n🏢 Création entreprise ${index + 1}: ${entrepriseName}`);
  console.log(`   Plan: ${plan.nom} (${plan.prix_mensuel}€/mois)\n`);
  
  // 1. Créer l'entreprise
  const { data: entreprise, error: entrepriseError } = await supabase
    .from('entreprises')
    .insert({
      user_id: user.id,
      nom: entrepriseName,
      siret: `123456789${String(index).padStart(5, '0')}`,
      forme_juridique: 'SARL',
      adresse: `${index + 1} Rue de Test`,
      code_postal: '75001',
      ville: 'Paris',
      statut: 'active'
    })
    .select()
    .single();
  
  if (entrepriseError) {
    console.error(`   ❌ Erreur création entreprise: ${entrepriseError.message}`);
    return null;
  }
  
  console.log(`   ✅ Entreprise créée: ${entreprise.id}`);
  
  // 2. Créer un client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      entreprise_id: entreprise.id,
      email: `client${index + 1}@test.com`,
      nom: `Nom${index + 1}`,
      prenom: `Prénom${index + 1}`,
      telephone: `012345678${index}`,
      statut: 'actif'
    })
    .select()
    .single();
  
  if (clientError) {
    console.error(`   ❌ Erreur création client: ${clientError.message}`);
    return { entreprise, client: null };
  }
  
  console.log(`   ✅ Client créé: ${client.id}`);
  
  // 3. Créer un paiement en attente
  const montantHT = plan.prix_mensuel || 0;
  const montantTVA = montantHT * 0.20;
  const montantTTC = montantHT + montantTVA;
  
  const { data: paiement, error: paiementError } = await supabase
    .from('paiements')
    .insert({
      user_id: user.id,
      entreprise_id: entreprise.id,
      montant_ht: montantHT,
      montant_tva: montantTVA,
      montant_ttc: montantTTC,
      statut: 'en_attente',
      methode_paiement: 'stripe',
      type_paiement: 'abonnement',
      notes: JSON.stringify({
        plan_id: plan.id,
        client_id: client.id,
        entreprise_id: entreprise.id,
        description: `Paiement pour création entreprise: ${entrepriseName}`
      })
    })
    .select()
    .single();
  
  if (paiementError) {
    console.error(`   ❌ Erreur création paiement: ${paiementError.message}`);
    return { entreprise, client, paiement: null };
  }
  
  console.log(`   ✅ Paiement créé: ${paiement.id} (${montantTTC}€)`);
  
  return { entreprise, client, paiement, plan };
}

async function verifyWorkflow(entrepriseData) {
  console.log(`\n🔍 Vérification du workflow...\n`);
  
  const results = {
    entreprise: false,
    paiement: false,
    facture: false,
    abonnement: false,
    espaceClient: false
  };
  
  if (!entrepriseData.entreprise) return results;
  
  // 1. Vérifier l'entreprise
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('id, nom, statut')
    .eq('id', entrepriseData.entreprise.id)
    .single();
  
  if (entreprise) {
    results.entreprise = true;
    console.log(`   ✅ Entreprise: ${entreprise.nom} (${entreprise.statut})`);
  }
  
  // 2. Vérifier le paiement
  if (entrepriseData.paiement) {
    const { data: paiement } = await supabase
      .from('paiements')
      .select('id, statut, montant_ttc')
      .eq('id', entrepriseData.paiement.id)
      .single();
    
    if (paiement) {
      results.paiement = true;
      console.log(`   ✅ Paiement: ${paiement.statut} (${paiement.montant_ttc}€)`);
      
      if (paiement.statut === 'paye') {
        // Vérifier facture
        const { data: factures } = await supabase
          .from('factures')
          .select('id, numero, statut')
          .eq('entreprise_id', entrepriseData.entreprise.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (factures && factures.length > 0) {
          results.facture = true;
          console.log(`   ✅ Facture: ${factures[0].numero}`);
        }
        
        // Vérifier abonnement
        const { data: abonnements } = await supabase
          .from('abonnements')
          .select('id, statut')
          .eq('entreprise_id', entrepriseData.entreprise.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (abonnements && abonnements.length > 0) {
          results.abonnement = true;
          console.log(`   ✅ Abonnement: ${abonnements[0].statut}`);
        }
        
        // Vérifier espace client
        if (entrepriseData.client) {
          const { data: espaces } = await supabase
            .from('espaces_membres_clients')
            .select('id, statut_compte')
            .eq('client_id', entrepriseData.client.id)
            .limit(1);
          
          if (espaces && espaces.length > 0) {
            results.espaceClient = true;
            console.log(`   ✅ Espace client: ${espaces[0].statut_compte}`);
          }
        }
      }
    }
  }
  
  return results;
}

async function simulatePayment(paiementId) {
  console.log(`\n💳 Validation du paiement...\n`);
  
  const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
    p_paiement_id: paiementId
  });
  
  if (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
    return false;
  }
  
  console.log(`   ✅ Paiement validé !`);
  await sleep(2000); // Attendre que le workflow se termine
  return true;
}

async function runCompleteTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET DU WORKFLOW');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Utilisateur
  const user = await getUserOrCreate();
  if (!user) return;
  
  // Plans
  console.log('📋 Récupération des plans...\n');
  const plans = await getPlans();
  if (!plans) return;
  
  console.log(`✅ ${plans.length} plan(s) disponible(s)\n`);
  
  // Tests
  const testResults = [];
  
  for (let i = 0; i < TEST_CONFIG.numberOfTests; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  TEST ${i + 1}/${TEST_CONFIG.numberOfTests}`);
    console.log('='.repeat(60));
    
    const plan = plans[i % plans.length];
    const entrepriseData = await createEntrepriseDirect(user, plan, i);
    
    if (!entrepriseData || !entrepriseData.paiement) {
      testResults.push({ test: i + 1, success: false });
      continue;
    }
    
    // Vérifier état initial
    await verifyWorkflow(entrepriseData);
    
    // Simuler paiement
    const paymentSuccess = await simulatePayment(entrepriseData.paiement.id);
    
    if (paymentSuccess) {
      const finalResults = await verifyWorkflow(entrepriseData);
      const allSuccess = finalResults.entreprise && finalResults.paiement && 
                         (finalResults.facture || finalResults.abonnement);
      
      testResults.push({ test: i + 1, success: allSuccess, results: finalResults });
    }
  }
  
  // Résumé
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('  📊 RÉSUMÉ');
  console.log('='.repeat(60));
  
  testResults.forEach(r => {
    console.log(r.success ? `✅ Test ${r.test}: SUCCÈS` : `❌ Test ${r.test}: ÉCHEC`);
  });
  
  const successCount = testResults.filter(r => r.success).length;
  console.log(`\n📈 Taux de succès: ${successCount}/${testResults.length}\n`);
}

runCompleteTest();

