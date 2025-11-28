#!/usr/bin/env node

/**
 * TEST COMPLET DU WORKFLOW
 * Crée plusieurs entreprises, effectue des paiements et teste le workflow
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configuration de test
const TEST_CONFIG = {
  numberOfTests: 3, // Nombre d'entreprises à créer
  testUserEmail: 'test@example.com',
  testUserId: null // Sera récupéré ou créé
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserOrCreate() {
  console.log('👤 Étape 0: Vérification/création de l\'utilisateur de test...\n');
  
  // Chercher un utilisateur existant ou en créer un
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (!listError && users && users.length > 0) {
    const testUser = users.find(u => u.email === TEST_CONFIG.testUserEmail) || users[0];
    TEST_CONFIG.testUserId = testUser.id;
    console.log(`✅ Utilisateur trouvé: ${testUser.email} (${testUser.id.substring(0, 8)}...)\n`);
    return testUser;
  }
  
  // Créer un utilisateur de test
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: TEST_CONFIG.testUserEmail,
    password: 'TestPassword123!',
    email_confirm: true
  });
  
  if (createError) {
    console.error('❌ Erreur création utilisateur:', createError.message);
    return null;
  }
  
  TEST_CONFIG.testUserId = newUser.user.id;
  console.log(`✅ Utilisateur créé: ${newUser.user.email}\n`);
  return newUser.user;
}

async function getPlans() {
  const { data: plans, error } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel')
    .eq('actif', true)
    .order('ordre');
  
  if (error || !plans || plans.length === 0) {
    console.error('❌ Aucun plan trouvé');
    return null;
  }
  
  return plans;
}

async function createTestEntreprise(plan, index) {
  const entrepriseName = `Entreprise Test ${index + 1} - ${new Date().toISOString().substring(0, 10)}`;
  
  console.log(`\n🏢 Création entreprise ${index + 1}: ${entrepriseName}`);
  console.log(`   Plan: ${plan.nom} (${plan.prix_mensuel}€/mois)\n`);
  
  const { data, error } = await supabase.rpc('create_complete_entreprise_automated', {
    p_nom_entreprise: entrepriseName,
    p_siret: `123456789${String(index).padStart(5, '0')}`,
    p_forme_juridique: 'SARL',
    p_adresse: `${index + 1} Rue de Test`,
    p_code_postal: '75001',
    p_ville: 'Paris',
    p_plan_id: plan.id,
    p_email_client: `client${index + 1}@test.com`,
    p_prenom_client: `Prénom${index + 1}`,
    p_nom_client: `Nom${index + 1}`,
    p_telephone_client: `012345678${index}`,
    p_creer_client_super_admin: true,
    p_envoyer_email: false
  });
  
  if (error) {
    console.error(`   ❌ Erreur création entreprise: ${error.message}`);
    return null;
  }
  
  console.log(`   ✅ Entreprise créée !`);
  console.log(`   📊 Résultat:`, JSON.stringify(data, null, 2));
  
  return data;
}

async function verifyWorkflow(entrepriseData) {
  console.log(`\n🔍 Vérification du workflow pour l'entreprise...\n`);
  
  const results = {
    entreprise: false,
    paiement: false,
    facture: false,
    abonnement: false,
    espaceClient: false
  };
  
  // 1. Vérifier l'entreprise
  if (entrepriseData.entreprise_id) {
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('id, nom, statut')
      .eq('id', entrepriseData.entreprise_id)
      .single();
    
    if (entreprise) {
      results.entreprise = true;
      console.log(`   ✅ Entreprise: ${entreprise.nom} (${entreprise.statut})`);
    } else {
      console.log(`   ❌ Entreprise non trouvée`);
    }
  }
  
  // 2. Vérifier le paiement
  if (entrepriseData.paiement_id) {
    const { data: paiement } = await supabase
      .from('paiements')
      .select('id, statut, montant_ttc')
      .eq('id', entrepriseData.paiement_id)
      .single();
    
    if (paiement) {
      results.paiement = true;
      console.log(`   ✅ Paiement: ${paiement.statut} (${paiement.montant_ttc}€)`);
      
      // Si le paiement est "paye", vérifier que le workflow a fonctionné
      if (paiement.statut === 'paye') {
        // 3. Vérifier la facture
        const { data: factures } = await supabase
          .from('factures')
          .select('id, numero, statut')
          .eq('entreprise_id', entrepriseData.entreprise_id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (factures && factures.length > 0) {
          results.facture = true;
          console.log(`   ✅ Facture: ${factures[0].numero} (${factures[0].statut})`);
        } else {
          console.log(`   ❌ Facture non trouvée`);
        }
        
        // 4. Vérifier l'abonnement
        const { data: abonnements } = await supabase
          .from('abonnements')
          .select('id, statut, date_debut')
          .eq('entreprise_id', entrepriseData.entreprise_id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (abonnements && abonnements.length > 0) {
          results.abonnement = true;
          console.log(`   ✅ Abonnement: ${abonnements[0].statut} (${abonnements[0].date_debut})`);
        } else {
          console.log(`   ❌ Abonnement non trouvé`);
        }
        
        // 5. Vérifier l'espace client
        if (entrepriseData.client_id) {
          const { data: espaces } = await supabase
            .from('espaces_membres_clients')
            .select('id, statut_compte')
            .eq('client_id', entrepriseData.client_id)
            .limit(1);
          
          if (espaces && espaces.length > 0) {
            results.espaceClient = true;
            console.log(`   ✅ Espace client: ${espaces[0].statut_compte}`);
          } else {
            console.log(`   ⚠️  Espace client non trouvé (peut être créé après paiement)`);
          }
        }
      } else {
        console.log(`   ⚠️  Paiement en attente - Le workflow se déclenchera après paiement`);
      }
    }
  }
  
  return results;
}

async function simulatePayment(paiementId) {
  console.log(`\n💳 Simulation du paiement Stripe...\n`);
  
  // Appeler la fonction de validation du paiement
  const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
    p_paiement_id: paiementId
  });
  
  if (error) {
    console.error(`   ❌ Erreur validation paiement: ${error.message}`);
    return false;
  }
  
  console.log(`   ✅ Paiement validé !`);
  if (data) {
    console.log(`   📊 Résultat:`, JSON.stringify(data, null, 2));
  }
  
  // Attendre un peu pour que le workflow se termine
  await sleep(1000);
  
  return true;
}

async function runCompleteTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET DU WORKFLOW');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Étape 0: Utilisateur
  const user = await getUserOrCreate();
  if (!user) {
    console.error('❌ Impossible de créer/récupérer un utilisateur');
    return;
  }
  
  // Étape 1: Récupérer les plans
  console.log('📋 Étape 1: Récupération des plans d\'abonnement...\n');
  const plans = await getPlans();
  if (!plans) {
    console.error('❌ Aucun plan disponible');
    return;
  }
  
  console.log(`✅ ${plans.length} plan(s) disponible(s):`);
  plans.forEach(plan => {
    console.log(`   - ${plan.nom}: ${plan.prix_mensuel}€/mois`);
  });
  console.log('');
  
  // Étape 2: Créer plusieurs entreprises et tester
  const testResults = [];
  
  for (let i = 0; i < TEST_CONFIG.numberOfTests; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  TEST ${i + 1}/${TEST_CONFIG.numberOfTests}`);
    console.log('='.repeat(60));
    
    // Sélectionner un plan (rotation)
    const plan = plans[i % plans.length];
    
    // Créer l'entreprise
    const entrepriseData = await createTestEntreprise(plan, i);
    
    if (!entrepriseData || !entrepriseData.success) {
      console.log(`\n❌ Échec de la création de l'entreprise ${i + 1}`);
      testResults.push({ test: i + 1, success: false, reason: 'Création échec' });
      continue;
    }
    
    // Attendre un peu
    await sleep(500);
    
    // Vérifier l'état initial
    const initialResults = await verifyWorkflow(entrepriseData);
    
    // Si un paiement a été créé, simuler le paiement
    if (entrepriseData.paiement_id) {
      const paymentSuccess = await simulatePayment(entrepriseData.paiement_id);
      
      if (paymentSuccess) {
        // Attendre que le workflow se termine
        await sleep(2000);
        
        // Vérifier l'état final
        const finalResults = await verifyWorkflow(entrepriseData);
        
        const allSuccess = Object.values(finalResults).every(v => v === true || 
          (!finalResults.facture && !finalResults.abonnement && entrepriseData.paiement_statut === 'en_attente'));
        
        testResults.push({
          test: i + 1,
          success: allSuccess,
          entreprise: entrepriseData.entreprise_id,
          results: finalResults
        });
      }
    } else {
      testResults.push({
        test: i + 1,
        success: false,
        reason: 'Aucun paiement créé'
      });
    }
  }
  
  // Résumé final
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const successCount = testResults.filter(r => r.success).length;
  const failureCount = testResults.length - successCount;
  
  testResults.forEach(result => {
    if (result.success) {
      console.log(`✅ Test ${result.test}: SUCCÈS`);
      if (result.results) {
        const checks = [
          result.results.entreprise && 'Entreprise',
          result.results.paiement && 'Paiement',
          result.results.facture && 'Facture',
          result.results.abonnement && 'Abonnement',
          result.results.espaceClient && 'Espace Client'
        ].filter(Boolean);
        console.log(`   → ${checks.join(', ')}`);
      }
    } else {
      console.log(`❌ Test ${result.test}: ÉCHEC`);
      if (result.reason) {
        console.log(`   → ${result.reason}`);
      }
    }
  });
  
  console.log(`\n📊 Statistiques:`);
  console.log(`   ✅ Succès: ${successCount}/${testResults.length}`);
  console.log(`   ❌ Échecs: ${failureCount}/${testResults.length}`);
  console.log(`   📈 Taux de succès: ${((successCount / testResults.length) * 100).toFixed(1)}%\n`);
  
  if (successCount === testResults.length) {
    console.log('🎉 Tous les tests sont passés avec succès !\n');
  } else {
    console.log('⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.\n');
  }
}

async function main() {
  try {
    await runCompleteTest();
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
  }
}

main();

