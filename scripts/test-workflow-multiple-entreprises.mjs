#!/usr/bin/env node
/**
 * Script de test complet du workflow de création d'entreprises
 * 
 * Teste :
 * 1. Création de plusieurs entreprises avec données aléatoires
 * 2. Création des paiements
 * 3. Simulation de validation Stripe
 * 4. Vérification du workflow complet (facture, abonnement, espace client)
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
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.error('   VITE_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Générer des données aléatoires
function generateRandomData() {
  const nomsEntreprises = [
    'Tech Solutions', 'Digital Agency', 'Cloud Services', 'Innovation Lab',
    'Smart Business', 'Global Systems', 'Future Tech', 'Next Level',
    'Pro Solutions', 'Enterprise Plus', 'Business Hub', 'Creative Studio'
  ];
  
  const prenoms = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Lucas', 'Emma', 'Thomas', 'Camille'];
  const noms = ['Dupont', 'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand'];
  const villes = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux'];
  const formesJuridiques = ['SARL', 'SAS', 'SASU', 'SA', 'EURL'];
  
  const nomEntreprise = nomsEntreprises[Math.floor(Math.random() * nomsEntreprises.length)] + 
    ' ' + Math.floor(Math.random() * 1000);
  const prenom = prenoms[Math.floor(Math.random() * prenoms.length)];
  const nom = noms[Math.floor(Math.random() * noms.length)];
  const ville = villes[Math.floor(Math.random() * villes.length)];
  const formeJuridique = formesJuridiques[Math.floor(Math.random() * formesJuridiques.length)];
  
  return {
    nomEntreprise,
    prenom,
    nom,
    email: `test.${nom.toLowerCase()}.${prenom.toLowerCase()}.${Date.now()}@example.com`,
    telephone: `0${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 100000000)}`,
    adresse: `${Math.floor(Math.random() * 100)} rue de la ${ville}`,
    codePostal: `${Math.floor(Math.random() * 90000) + 10000}`,
    ville,
    siret: `${Math.floor(Math.random() * 90000000000000) + 10000000000000}`,
    formeJuridique
  };
}

// Obtenir un plan d'abonnement aléatoire
async function getRandomPlan() {
  const { data: plans, error } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel')
    .eq('actif', true)
    .order('prix_mensuel', { ascending: true });
  
  if (error || !plans || plans.length === 0) {
    throw new Error('Aucun plan d\'abonnement trouvé');
  }
  
  return plans[Math.floor(Math.random() * plans.length)];
}

// Créer un utilisateur de test et retourner ses credentials
async function createTestUser(email) {
  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    const password = `Test${Date.now()}!`;
    
    if (existingUser) {
      console.log(`   ✅ Utilisateur existant trouvé: ${email}`);
      // Réinitialiser le mot de passe pour être sûr qu'on peut se connecter
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password
      });
      return { id: existingUser.id, email, password };
    }
    
    // Créer un nouvel utilisateur
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        type: 'test'
      }
    });
    
    if (error) throw error;
    
    console.log(`   ✅ Utilisateur créé: ${email}`);
    return { id: newUser.user.id, email, password };
  } catch (error) {
    console.error(`   ❌ Erreur création utilisateur: ${error.message}`);
    throw error;
  }
}

// Test de création d'entreprise
async function testCreateEntreprise(userCredentials, planId, data, testNumber) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 TEST ${testNumber}: ${data.nomEntreprise}`);
  console.log('='.repeat(60));
  
  try {
    // 1. Créer l'entreprise via RPC
    console.log('🏢 Étape 1: Création de l\'entreprise...');
    
    // Créer un client avec ANON_KEY pour l'authentification normale
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Se connecter en tant que cet utilisateur
    console.log(`   🔐 Connexion de l'utilisateur...`);
    const { data: sessionData, error: signInError } = await userClient.auth.signInWithPassword({
      email: userCredentials.email,
      password: userCredentials.password
    });
    
    if (signInError || !sessionData?.session) {
      console.error(`   ❌ Erreur connexion utilisateur: ${signInError?.message || 'Session non créée'}`);
      return { success: false, error: 'Erreur authentification', step: 'auth' };
    }
    
    console.log(`   ✅ Utilisateur authentifié: ${userCredentials.email}`);
    
    const { data: result, error: createError } = await userClient.rpc('create_complete_entreprise_automated', {
      p_nom_entreprise: data.nomEntreprise,
      p_siret: data.siret,
      p_forme_juridique: data.formeJuridique,
      p_adresse: data.adresse,
      p_code_postal: data.codePostal,
      p_ville: data.ville,
      p_telephone_entreprise: data.telephone,
      p_email_client: data.email,
      p_nom_client: data.nom,
      p_prenom_client: data.prenom,
      p_telephone_client: data.telephone,
      p_plan_id: planId,
      p_creer_client_super_admin: true,
      p_envoyer_email: false
    });
    
    if (createError) {
      console.error(`   ❌ Erreur création entreprise: ${createError.message}`);
      console.error(`   Détails:`, createError);
      return { success: false, error: createError.message, step: 'creation' };
    }
    
    if (!result || !result.success) {
      console.error(`   ❌ Échec création entreprise: ${result?.error || 'Erreur inconnue'}`);
      return { success: false, error: result?.error || 'Erreur inconnue', step: 'creation' };
    }
    
    console.log(`   ✅ Entreprise créée: ${result.entreprise_id}`);
    console.log(`   ✅ Client créé: ${result.client_id || 'N/A'}`);
    
    if (!result.paiement_id) {
      console.log(`   ⚠️  Pas de paiement créé (plan gratuit?)`);
      return { success: true, entreprise_id: result.entreprise_id, paiement_id: null };
    }
    
    console.log(`   ✅ Paiement créé: ${result.paiement_id}`);
    console.log(`   💰 Montant: ${result.montant_ttc}€`);
    
    // 2. Simuler la validation Stripe
    console.log('\n💳 Étape 2: Simulation validation paiement Stripe...');
    
    const { data: validationResult, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: result.paiement_id,
      p_stripe_payment_id: `pi_test_${Date.now()}`
    });
    
    if (validationError) {
      console.error(`   ❌ Erreur validation paiement: ${validationError.message}`);
      console.error(`   Détails:`, validationError);
      return { 
        success: false, 
        error: validationError.message, 
        step: 'validation',
        entreprise_id: result.entreprise_id,
        paiement_id: result.paiement_id
      };
    }
    
    if (!validationResult || !validationResult.success) {
      console.error(`   ❌ Échec validation paiement: ${validationResult?.error || 'Erreur inconnue'}`);
      return { 
        success: false, 
        error: validationResult?.error || 'Erreur inconnue', 
        step: 'validation',
        entreprise_id: result.entreprise_id,
        paiement_id: result.paiement_id
      };
    }
    
    console.log(`   ✅ Paiement validé`);
    if (validationResult.facture_id) {
      console.log(`   ✅ Facture créée: ${validationResult.facture_id}`);
    }
    if (validationResult.abonnement_id) {
      console.log(`   ✅ Abonnement créé: ${validationResult.abonnement_id}`);
    }
    if (validationResult.espace_membre_id) {
      console.log(`   ✅ Espace membre créé: ${validationResult.espace_membre_id}`);
    }
    
    // 3. Vérifier le workflow complet
    console.log('\n🔍 Étape 3: Vérification du workflow complet...');
    
    const checks = {
      entreprise: false,
      client: false,
      facture: false,
      abonnement: false,
      espace_membre: false,
      paiement_paye: false
    };
    
    // Vérifier entreprise
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('*')
      .eq('id', result.entreprise_id)
      .single();
    
    if (entreprise) {
      checks.entreprise = true;
      console.log(`   ✅ Entreprise: ${entreprise.nom} (${entreprise.statut})`);
    } else {
      console.log(`   ❌ Entreprise non trouvée`);
    }
    
    // Vérifier client
    if (result.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', result.client_id)
        .single();
      
      if (client) {
        checks.client = true;
        console.log(`   ✅ Client: ${client.prenom} ${client.nom} (${client.statut})`);
      }
    }
    
    // Vérifier facture
    if (validationResult.facture_id) {
      const { data: facture } = await supabase
        .from('factures')
        .select('*')
        .eq('id', validationResult.facture_id)
        .single();
      
      if (facture) {
        checks.facture = true;
        console.log(`   ✅ Facture: ${facture.numero} (${facture.statut})`);
      }
    }
    
    // Vérifier abonnement
    if (validationResult.abonnement_id) {
      const { data: abonnement } = await supabase
        .from('abonnements')
        .select('*')
        .eq('id', validationResult.abonnement_id)
        .single();
      
      if (abonnement) {
        checks.abonnement = true;
        console.log(`   ✅ Abonnement: ${abonnement.statut}`);
      }
    }
    
    // Vérifier espace membre
    if (validationResult.espace_membre_id) {
      const { data: espace } = await supabase
        .from('espaces_membres_clients')
        .select('*')
        .eq('id', validationResult.espace_membre_id)
        .single();
      
      if (espace) {
        checks.espace_membre = true;
        console.log(`   ✅ Espace membre: ${espace.statut_compte || 'actif'}`);
      }
    }
    
    // Vérifier paiement
    const { data: paiement } = await supabase
      .from('paiements')
      .select('*')
      .eq('id', result.paiement_id)
      .single();
    
    if (paiement && paiement.statut === 'paye') {
      checks.paiement_paye = true;
      console.log(`   ✅ Paiement: ${paiement.statut}`);
    } else {
      console.log(`   ⚠️  Paiement: ${paiement?.statut || 'non trouvé'}`);
    }
    
    // Calculer le pourcentage de complétion
    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const completion = Math.round((passedChecks / totalChecks) * 100);
    
    console.log(`\n📊 RÉSULTAT DU TEST:`);
    console.log(`   Progression: ${completion}%`);
    console.log(`   ${passedChecks}/${totalChecks} vérifications réussies`);
    
    if (completion === 100) {
      console.log(`   ✅ TEST RÉUSSI - Workflow complet validé !\n`);
    } else {
      console.log(`   ⚠️  TEST PARTIEL - Certaines étapes manquantes\n`);
    }
    
    return {
      success: completion === 100,
      completion,
      checks,
      entreprise_id: result.entreprise_id,
      paiement_id: result.paiement_id,
      ...validationResult
    };
    
  } catch (error) {
    console.error(`\n❌ ERREUR FATALE lors du test:`);
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    return { success: false, error: error.message, step: 'unknown' };
  }
}

// Fonction principale
async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TESTS DE CRÉATION D\'ENTREPRISES MULTIPLES');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Nombre d'entreprises à créer
  const numberOfTests = 3;
  console.log(`📋 Configuration:`);
  console.log(`   → Nombre de tests: ${numberOfTests}`);
  console.log(`   → Données: aléatoires\n`);
  
  try {
    // Récupérer un plan d'abonnement
    console.log('📦 Récupération d\'un plan d\'abonnement...');
    const plan = await getRandomPlan();
    console.log(`   ✅ Plan sélectionné: ${plan.nom} (${plan.prix_mensuel}€/mois)\n`);
    
    const results = [];
    
    // Lancer les tests
    for (let i = 1; i <= numberOfTests; i++) {
      const data = generateRandomData();
      console.log(`\n🔄 Préparation test ${i}/${numberOfTests}...`);
      console.log(`   Entreprise: ${data.nomEntreprise}`);
      console.log(`   Email: ${data.email}`);
      
      // Créer un utilisateur de test
      const userCredentials = await createTestUser(data.email);
      
      // Lancer le test
      const result = await testCreateEntreprise(userCredentials, plan.id, data, i);
      results.push(result);
      
      // Attendre un peu entre les tests
      if (i < numberOfTests) {
        console.log('\n⏳ Attente de 2 secondes avant le prochain test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const partial = results.filter(r => r.completion && r.completion > 50 && !r.success).length;
    const failed = results.filter(r => !r.success && (!r.completion || r.completion <= 50)).length;
    
    console.log(`\n✅ Tests réussis: ${successful}/${numberOfTests}`);
    console.log(`⚠️  Tests partiels: ${partial}/${numberOfTests}`);
    console.log(`❌ Tests échoués: ${failed}/${numberOfTests}\n`);
    
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`   ✅ Test ${index + 1}: SUCCÈS (100%)`);
      } else if (result.completion) {
        console.log(`   ⚠️  Test ${index + 1}: PARTIEL (${result.completion}%)`);
        if (result.error) {
          console.log(`      Erreur: ${result.error}`);
        }
      } else {
        console.log(`   ❌ Test ${index + 1}: ÉCHEC`);
        if (result.error) {
          console.log(`      Erreur: ${result.error} (étape: ${result.step || 'unknown'})`);
        }
      }
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  🎯 TESTS TERMINÉS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return results;
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Lancer les tests
runTests().then((results) => {
  const allSuccess = results.every(r => r.success);
  process.exit(allSuccess ? 0 : 1);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

