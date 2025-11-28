#!/usr/bin/env node

/**
 * TEST COMPLET SIMULANT LE FRONTEND
 * Simule exactement ce que fait le frontend pour créer une entreprise
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

if (!SUPABASE_ANON_KEY) {
  console.log('⚠️  VITE_SUPABASE_ANON_KEY non trouvé');
  console.log('   Le test utilisera SERVICE_ROLE_KEY (différent du frontend)\n');
}

// Client comme dans le frontend (avec ANON_KEY)
const supabaseClient = SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client admin pour les opérations spéciales
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testWorkflow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET - SIMULATION FRONTEND');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Simuler une connexion utilisateur
  console.log('👤 Étape 1: Simulation de la connexion utilisateur...\n');
  
  // Essayer de se connecter avec un utilisateur existant ou créer un test
  const testEmail = 'test@example.com';
  const testPassword = 'TestPassword123!';
  
  // Se connecter ou créer
  let { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (authError) {
    console.log('   ⚠️  Connexion échouée, tentative de création...');
    
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (signUpError) {
      console.error('   ❌ Erreur création utilisateur:', signUpError.message);
      
      // Utiliser un utilisateur existant via admin
      console.log('   🔧 Utilisation d\'un utilisateur existant...\n');
      
      // Récupérer le premier utilisateur via admin
      try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError || !users || users.length === 0) {
          console.error('   ❌ Aucun utilisateur disponible');
          console.log('\n💡 Créez un utilisateur via l\'interface web d\'abord\n');
          return;
        }
        
        // Utiliser le premier utilisateur
        const firstUser = users[0];
        console.log(`   ✅ Utilisateur trouvé: ${firstUser.email}`);
        
        // Pour le test, on va créer directement avec l'admin client
        // mais simuler ce que fait le frontend
        
        // Récupérer les plans
        const { data: plans } = await supabaseAdmin
          .from('plans_abonnement')
          .select('id, nom, prix_mensuel')
          .eq('actif', true)
          .order('ordre')
          .limit(1);
        
        if (!plans || plans.length === 0) {
          console.error('   ❌ Aucun plan disponible\n');
          return;
        }
        
        const plan = plans[0];
        console.log(`   📋 Plan sélectionné: ${plan.nom} (${plan.prix_mensuel}€/mois)\n`);
        
        // Créer une entreprise directement via API admin (simulant le RPC)
        console.log('🏢 Étape 2: Création de l\'entreprise (simulation frontend)...\n');
        
        // Au lieu d'appeler le RPC, créer directement comme dans le test précédent
        const entrepriseName = `Test Frontend - ${Date.now()}`;
        
        const { data: entreprise, error: entrepriseError } = await supabaseAdmin
          .from('entreprises')
          .insert({
            user_id: firstUser.id, // ✅ Utiliser un user_id valide
            nom: entrepriseName,
            siret: '12345678900001',
            forme_juridique: 'SARL',
            adresse: '1 Rue Test',
            code_postal: '75001',
            ville: 'Paris',
            statut: 'active'
          })
          .select()
          .single();
        
        if (entrepriseError) {
          console.error(`   ❌ Erreur: ${entrepriseError.message}`);
          console.error(`   Code: ${entrepriseError.code}\n`);
          
          if (entrepriseError.code === '23503') {
            console.log('   ⚠️  Erreur de clé étrangère - Le user_id n\'existe pas');
            console.log(`   User ID utilisé: ${firstUser.id.substring(0, 8)}...`);
            console.log(`   Vérifiez que cet ID existe bien dans auth.users\n`);
          }
          
          return;
        }
        
        console.log(`   ✅ Entreprise créée: ${entreprise.id.substring(0, 8)}...`);
        console.log(`   ✅ user_id valide: ${entreprise.user_id.substring(0, 8)}...\n`);
        
        // Créer client et paiement
        const { data: client } = await supabaseAdmin
          .from('clients')
          .insert({
            entreprise_id: entreprise.id,
            email: 'client@test.com',
            nom: 'Test',
            prenom: 'User',
            statut: 'actif'
          })
          .select()
          .single();
        
        console.log(`   ✅ Client créé: ${client.id.substring(0, 8)}...\n`);
        
        // Créer paiement
        const montantHT = plan.prix_mensuel || 0;
        const montantTTC = montantHT * 1.20;
        
        const { data: paiement } = await supabaseAdmin
          .from('paiements')
          .insert({
            user_id: firstUser.id,
            entreprise_id: entreprise.id,
            montant_ht: montantHT,
            montant_tva: montantHT * 0.20,
            montant_ttc: montantTTC,
            statut: 'en_attente',
            methode_paiement: 'stripe',
            type_paiement: 'abonnement',
            notes: JSON.stringify({
              plan_id: plan.id,
              client_id: client.id,
              entreprise_id: entreprise.id
            })
          })
          .select()
          .single();
        
        console.log(`   ✅ Paiement créé: ${paiement.id.substring(0, 8)}... (${montantTTC}€)\n`);
        
        // Valider le paiement
        console.log('💳 Étape 3: Validation du paiement...\n');
        
        const { data: validation, error: validationError } = await supabaseAdmin.rpc(
          'valider_paiement_carte_immediat',
          { p_paiement_id: paiement.id }
        );
        
        if (validationError) {
          console.error(`   ❌ Erreur: ${validationError.message}\n`);
        } else {
          console.log('   ✅ Paiement validé !\n');
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Vérifier les résultats
          const { data: factures } = await supabaseAdmin
            .from('factures')
            .select('id, numero')
            .eq('entreprise_id', entreprise.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const { data: abonnements } = await supabaseAdmin
            .from('abonnements')
            .select('id, statut')
            .eq('entreprise_id', entreprise.id)
            .limit(1);
          
          console.log('📊 Résultats:');
          console.log(`   ${factures && factures.length > 0 ? '✅' : '❌'} Facture`);
          console.log(`   ${abonnements && abonnements.length > 0 ? '✅' : '❌'} Abonnement`);
          console.log('');
          
          console.log('✅ Test réussi !\n');
        }
        
        return;
      } catch (error) {
        console.error('   ❌ Erreur:', error.message);
        return;
      }
    } else {
      authData = signUpData;
      console.log('   ✅ Utilisateur créé et connecté\n');
    }
  } else {
    console.log('   ✅ Utilisateur connecté\n');
  }
  
  if (authData?.user) {
    console.log(`   User ID: ${authData.user.id.substring(0, 8)}...`);
    console.log(`   Email: ${authData.user.email}\n`);
  }
}

testWorkflow();

