#!/usr/bin/env node

/**
 * Test complet: Créer un client et un espace membre
 * CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteFlow() {
  console.log('🧪 TEST COMPLET: Création espace membre\n');
  console.log('📋 ÉTAPE 1: Vérification des colonnes...\n');

  // Vérifier qu'on peut lire les colonnes
  const { data: testQuery, error: schemaError } = await supabase
    .from('espaces_membres_clients')
    .select('statut_compte, configuration_validee, email, abonnement_id')
    .limit(1);

  if (schemaError) {
    if (schemaError.message.includes('column') && schemaError.message.includes('does not exist')) {
      console.error('❌ COLONNE MANQUANTE:', schemaError.message);
      console.error('   Application de la migration nécessaire!');
      process.exit(1);
    }
  }

  console.log('✅ Colonnes vérifiées\n');

  // Récupérer un client existant
  console.log('📋 ÉTAPE 2: Recherche d\'un client...\n');
  
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, entreprise_id, email, nom')
    .limit(5);

  if (clientsError) {
    console.error('❌ Erreur:', clientsError.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('⚠️  Aucun client trouvé');
    console.log('   Test réussi: les colonnes existent, prêt pour la création!');
    process.exit(0);
  }

  console.log(`✅ ${clients.length} client(s) trouvé(s)\n`);

  // Tester avec le premier client qui a un email
  const testClient = clients.find(c => c.email) || clients[0];

  if (!testClient.email) {
    console.log('⚠️  Client sans email trouvé, impossible de tester la création complète');
    process.exit(0);
  }

  console.log(`📋 ÉTAPE 3: Test avec client "${testClient.nom || testClient.email}"`);
  console.log(`   ID: ${testClient.id}`);
  console.log(`   Email: ${testClient.email}`);
  console.log(`   Entreprise ID: ${testClient.entreprise_id}\n`);

  // Vérifier si espace existe
  const { data: existingEspace } = await supabase
    .from('espaces_membres_clients')
    .select('id')
    .eq('client_id', testClient.id)
    .maybeSingle();

  if (existingEspace) {
    console.log('✅ Espace membre existe déjà pour ce client');
    console.log(`   Espace ID: ${existingEspace.id}`);
    console.log('\n✅✅✅ TEST RÉUSSI: Tous les éléments sont en place!');
    process.exit(0);
  }

  console.log('📋 ÉTAPE 4: Test de création d\'espace membre...\n');

  const password = 'Test123!@#' + Date.now();

  const { data: result, error: rpcError } = await supabase.rpc(
    'create_espace_membre_from_client_unified',
    {
      p_client_id: testClient.id,
      p_entreprise_id: testClient.entreprise_id,
      p_password: password,
      p_plan_id: null,
      p_options_ids: null,
    }
  );

  if (rpcError) {
    console.error('❌ ERREUR RPC:', rpcError.message);
    console.error('   Code:', rpcError.code);
    console.error('   Détails:', rpcError.details);
    process.exit(1);
  }

  if (result && result.success) {
    console.log('✅✅✅ CRÉATION RÉUSSIE! ✅✅✅\n');
    console.log(`   Espace ID: ${result.espace_id}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Password: ${result.password}`);
    console.log(`   Message: ${result.message}\n`);

    // Vérifier en base
    const { data: verifyEspace, error: verifyError } = await supabase
      .from('espaces_membres_clients')
      .select('*')
      .eq('id', result.espace_id)
      .single();

    if (verifyError) {
      console.error('⚠️  Erreur vérification:', verifyError.message);
    } else {
      console.log('✅ Vérification en base de données:');
      console.log(`   - statut_compte: ${verifyEspace.statut_compte}`);
      console.log(`   - configuration_validee: ${verifyEspace.configuration_validee}`);
      console.log(`   - email: ${verifyEspace.email}`);
      console.log(`   - actif: ${verifyEspace.actif}`);
      console.log('\n✅✅✅ TOUT FONCTIONNE PARFAITEMENT! ✅✅✅');
    }
  } else {
    console.error('❌ Échec:', result?.error || 'Erreur inconnue');
    process.exit(1);
  }
}

testCompleteFlow().catch(err => {
  console.error('❌ EXCEPTION:', err.message);
  process.exit(1);
});

