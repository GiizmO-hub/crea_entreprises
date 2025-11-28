#!/usr/bin/env node

/**
 * TEST COMPLET AVEC VÉRIFICATION DE SYNCHRONISATION
 * Vérifie toutes les contraintes et teste le workflow complet
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyAllConstraints() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION DES CONTRAINTES');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let allGood = true;
  
  // 1. Vérifier les utilisateurs
  console.log('👤 1. Vérification des utilisateurs...');
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError || !users || users.length === 0) {
    console.log('   ❌ Aucun utilisateur trouvé');
    console.log('   ⚠️  Créez un utilisateur via l\'interface web d\'abord\n');
    return { success: false, users: [] };
  }
  
  console.log(`   ✅ ${users.length} utilisateur(s) trouvé(s)\n`);
  
  // 2. Vérifier les contraintes FK de la table entreprises
  console.log('🔗 2. Vérification de la contrainte user_id dans entreprises...');
  
  // Vérifier les entreprises avec user_id invalide
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('id, nom, user_id')
    .limit(100);
  
  if (!entreprisesError && entreprises && entreprises.length > 0) {
    let invalidCount = 0;
    for (const entreprise of entreprises) {
      if (entreprise.user_id) {
        const userExists = users.find(u => u.id === entreprise.user_id);
        if (!userExists) {
          console.log(`   ❌ Entreprise "${entreprise.nom}" a un user_id invalide: ${entreprise.user_id.substring(0, 8)}...`);
          invalidCount++;
          allGood = false;
        }
      }
    }
    
    if (invalidCount === 0) {
      console.log(`   ✅ Toutes les entreprises ont un user_id valide\n`);
    } else {
      console.log(`   ⚠️  ${invalidCount} entreprise(s) avec user_id invalide\n`);
    }
  } else {
    console.log(`   ✅ Aucune entreprise trouvée (normal si base vide)\n`);
  }
  
  // 3. Vérifier les plans
  console.log('📋 3. Vérification des plans d\'abonnement...');
  const { data: plans } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (!plans || plans.length === 0) {
    console.log('   ❌ Aucun plan trouvé');
    allGood = false;
  } else {
    console.log(`   ✅ ${plans.length} plan(s) disponible(s)\n`);
  }
  
  return { success: allGood, users, plans };
}

async function createTestEntrepriseWithValidation(user, plan, index) {
  const entrepriseName = `Test Synchro ${index + 1} - ${Date.now()}`;
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🏢 TEST ${index + 1}: Création entreprise "${entrepriseName}"`);
  console.log(`${'─'.repeat(60)}\n`);
  
  // 1. Créer l'entreprise avec validation
  console.log('📝 Étape 1: Création de l\'entreprise...');
  
  const { data: entreprise, error: entrepriseError } = await supabase
    .from('entreprises')
    .insert({
      user_id: user.id, // ✅ Utiliser le user_id valide
      nom: entrepriseName,
      siret: `123456789${String(index).padStart(5, '0')}`,
      forme_juridique: 'SARL',
      adresse: `${index + 1} Rue Test`,
      code_postal: '75001',
      ville: 'Paris',
      statut: 'active'
    })
    .select()
    .single();
  
  if (entrepriseError) {
    console.error(`   ❌ Erreur: ${entrepriseError.message}`);
    console.error(`   Code: ${entrepriseError.code}`);
    console.error(`   Details: ${JSON.stringify(entrepriseError, null, 2)}\n`);
    return { success: false, error: entrepriseError };
  }
  
  console.log(`   ✅ Entreprise créée: ${entreprise.id.substring(0, 8)}...`);
  console.log(`   ✅ user_id: ${entreprise.user_id.substring(0, 8)}... (valide)\n`);
  
  // 2. Créer un client
  console.log('👤 Étape 2: Création du client...');
  
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      entreprise_id: entreprise.id,
      email: `client.test${index}@example.com`,
      nom: `Nom${index}`,
      prenom: `Prénom${index}`,
      telephone: `012345678${index}`,
      statut: 'actif'
    })
    .select()
    .single();
  
  if (clientError) {
    console.error(`   ❌ Erreur: ${clientError.message}\n`);
    return { success: false, entreprise, error: clientError };
  }
  
  console.log(`   ✅ Client créé: ${client.id.substring(0, 8)}...\n`);
  
  // 3. Créer un paiement
  console.log('💰 Étape 3: Création du paiement...');
  
  const montantHT = plan.prix_mensuel || 0;
  const montantTVA = montantHT * 0.20;
  const montantTTC = montantHT + montantTVA;
  
  const { data: paiement, error: paiementError } = await supabase
    .from('paiements')
    .insert({
      user_id: user.id, // ✅ Utiliser le user_id valide
      entreprise_id: entreprise.id, // ✅ Référence valide
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
        description: `Paiement test pour: ${entrepriseName}`
      })
    })
    .select()
    .single();
  
  if (paiementError) {
    console.error(`   ❌ Erreur: ${paiementError.message}`);
    console.error(`   Code: ${paiementError.code}\n`);
    return { success: false, entreprise, client, error: paiementError };
  }
  
  console.log(`   ✅ Paiement créé: ${paiement.id.substring(0, 8)}... (${montantTTC}€)\n`);
  
  // 4. Vérifier les relations avant validation
  console.log('🔍 Étape 4: Vérification des relations...');
  
  const checks = {
    entrepriseExists: false,
    userExists: false,
    clientExists: false,
    planExists: false,
    allValid: false
  };
  
  // Vérifier entreprise
  const { data: entrepriseCheck } = await supabase
    .from('entreprises')
    .select('id, user_id')
    .eq('id', entreprise.id)
    .single();
  
  checks.entrepriseExists = !!entrepriseCheck;
  
  // Vérifier user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  checks.userExists = users?.some(u => u.id === entrepriseCheck?.user_id) || false;
  
  // Vérifier client
  const { data: clientCheck } = await supabase
    .from('clients')
    .select('id, entreprise_id')
    .eq('id', client.id)
    .single();
  
  checks.clientExists = !!clientCheck;
  
  // Vérifier plan
  const { data: planCheck } = await supabase
    .from('plans_abonnement')
    .select('id')
    .eq('id', plan.id)
    .single();
  
  checks.planExists = !!planCheck;
  
  checks.allValid = checks.entrepriseExists && checks.userExists && 
                    checks.clientExists && checks.planExists;
  
  if (checks.allValid) {
    console.log('   ✅ Toutes les relations sont valides\n');
  } else {
    console.log('   ❌ Problèmes détectés:');
    Object.entries(checks).forEach(([key, value]) => {
      if (key !== 'allValid') {
        console.log(`      ${value ? '✅' : '❌'} ${key}`);
      }
    });
    console.log('');
  }
  
  // 5. Valider le paiement
  if (checks.allValid) {
    console.log('💳 Étape 5: Validation du paiement...');
    
    const { data: validationResult, error: validationError } = await supabase.rpc(
      'valider_paiement_carte_immediat',
      { p_paiement_id: paiement.id }
    );
    
    if (validationError) {
      console.error(`   ❌ Erreur validation: ${validationError.message}\n`);
      return { success: false, entreprise, client, paiement, error: validationError };
    }
    
    console.log('   ✅ Paiement validé !');
    await sleep(2000); // Attendre le workflow
    
    // 6. Vérifier les résultats
    console.log('\n🔍 Étape 6: Vérification du workflow complet...\n');
    
    const { data: factures } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('entreprise_id', entreprise.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const { data: abonnements } = await supabase
      .from('abonnements')
      .select('id, statut')
      .eq('entreprise_id', entreprise.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const { data: espaces } = await supabase
      .from('espaces_membres_clients')
      .select('id, statut_compte')
      .eq('client_id', client.id)
      .limit(1);
    
    const workflowResults = {
      entreprise: checks.entrepriseExists,
      paiement: true,
      facture: factures && factures.length > 0,
      abonnement: abonnements && abonnements.length > 0,
      espaceClient: espaces && espaces.length > 0
    };
    
    console.log('📊 Résultats du workflow:');
    console.log(`   ${workflowResults.entreprise ? '✅' : '❌'} Entreprise`);
    console.log(`   ${workflowResults.paiement ? '✅' : '❌'} Paiement validé`);
    console.log(`   ${workflowResults.facture ? '✅' : '❌'} Facture créée`);
    if (factures && factures.length > 0) {
      console.log(`      → Numéro: ${factures[0].numero}`);
    }
    console.log(`   ${workflowResults.abonnement ? '✅' : '❌'} Abonnement créé`);
    console.log(`   ${workflowResults.espaceClient ? '✅' : '❌'} Espace client créé\n`);
    
    const workflowSuccess = Object.values(workflowResults).every(v => v === true);
    
    return {
      success: workflowSuccess,
      entreprise,
      client,
      paiement,
      workflowResults
    };
  }
  
  return { success: checks.allValid, entreprise, client, paiement };
}

async function runCompleteTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET AVEC VÉRIFICATION DE SYNCHRONISATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Vérifier les contraintes
  const { success: constraintsOk, users, plans } = await verifyAllConstraints();
  
  if (!constraintsOk || !users || users.length === 0) {
    console.log('\n❌ Impossible de continuer: problèmes de contraintes ou aucun utilisateur');
    return;
  }
  
  if (!plans || plans.length === 0) {
    console.log('\n❌ Impossible de continuer: aucun plan disponible');
    return;
  }
  
  // Tests
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🚀 LANCEMENT DES TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const testResults = [];
  const numberOfTests = 2;
  
  for (let i = 0; i < numberOfTests; i++) {
    const user = users[i % users.length];
    const plan = plans[i % plans.length];
    
    const result = await createTestEntrepriseWithValidation(user, plan, i);
    testResults.push({ test: i + 1, ...result });
    
    await sleep(1000);
  }
  
  // Résumé
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const successCount = testResults.filter(r => r.success).length;
  
  testResults.forEach(result => {
    if (result.success) {
      console.log(`✅ Test ${result.test}: SUCCÈS COMPLET`);
      if (result.workflowResults) {
        const checks = Object.entries(result.workflowResults)
          .filter(([_, v]) => v)
          .map(([k]) => k);
        console.log(`   → ${checks.join(', ')}`);
      }
    } else {
      console.log(`❌ Test ${result.test}: ÉCHEC`);
      if (result.error) {
        console.log(`   → ${result.error.message}`);
      }
    }
    console.log('');
  });
  
  console.log(`📈 Taux de succès: ${successCount}/${testResults.length} (${((successCount / testResults.length) * 100).toFixed(1)}%)\n`);
  
  if (successCount === testResults.length) {
    console.log('🎉 Tous les tests sont passés avec succès !\n');
  }
}

runCompleteTest();

