#!/usr/bin/env node

/**
 * Script de test pour créer un espace membre et vérifier qu'il n'y a pas d'erreurs
 * 
 * Usage:
 *   node scripts/test-create-espace-membre.js
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
  console.error('❌ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateEspaceMembre() {
  console.log('🧪 TEST: Création d\'espace membre\n');

  try {
    // 1. Récupérer un client existant pour tester
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, entreprise_id, email')
      .limit(1);

    if (clientsError) {
      console.error('❌ Erreur récupération clients:', clientsError.message);
      process.exit(1);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  Aucun client trouvé pour tester');
      console.log('   Créez d\'abord un client dans l\'application');
      process.exit(0);
    }

    const testClient = clients[0];
    console.log(`📋 Client de test trouvé:`);
    console.log(`   ID: ${testClient.id}`);
    console.log(`   Email: ${testClient.email || 'N/A'}`);
    console.log(`   Entreprise ID: ${testClient.entreprise_id}\n`);

    if (!testClient.email) {
      console.log('⚠️  Le client n\'a pas d\'email, impossible de créer l\'espace membre');
      process.exit(0);
    }

    // 2. Vérifier si un espace existe déjà
    const { data: existingEspace, error: espaceCheckError } = await supabase
      .from('espaces_membres_clients')
      .select('id')
      .eq('client_id', testClient.id)
      .maybeSingle();

    if (espaceCheckError) {
      console.error('❌ Erreur vérification espace:', espaceCheckError.message);
      process.exit(1);
    }

    if (existingEspace) {
      console.log('⚠️  Un espace membre existe déjà pour ce client');
      console.log(`   Espace ID: ${existingEspace.id}`);
      console.log('   Test avec un autre client ou supprimez cet espace d\'abord\n');
      process.exit(0);
    }

    // 3. Tester la fonction RPC
    console.log('📝 Test de create_espace_membre_from_client_unified...');
    
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
      console.error('   Détails:', rpcError.details);
      console.error('   Code:', rpcError.code);
      process.exit(1);
    }

    if (!result) {
      console.error('❌ Aucun résultat retourné');
      process.exit(1);
    }

    if (result.success) {
      console.log('✅✅✅ SUCCÈS! ✅✅✅\n');
      console.log(`   Espace ID: ${result.espace_id}`);
      console.log(`   Email: ${result.email}`);
      console.log(`   Password: ${result.password}`);
      console.log(`   Message: ${result.message}\n`);
      
      // Vérifier que l'espace a été créé en base
      const { data: createdEspace, error: verifyError } = await supabase
        .from('espaces_membres_clients')
        .select('*')
        .eq('id', result.espace_id)
        .single();

      if (verifyError) {
        console.error('⚠️  Espace créé mais erreur de vérification:', verifyError.message);
      } else {
        console.log('✅ Vérification en base:');
        console.log(`   - statut_compte: ${createdEspace.statut_compte || 'NULL'}`);
        console.log(`   - configuration_validee: ${createdEspace.configuration_validee}`);
        console.log(`   - email: ${createdEspace.email || 'NULL'}`);
        console.log(`   - actif: ${createdEspace.actif}`);
      }
    } else {
      console.error('❌ Échec:', result.error || result.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ EXCEPTION:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Vérifier la connexion d'abord
supabase.auth.getSession().then(() => {
  testCreateEspaceMembre();
}).catch(err => {
  console.error('❌ Erreur de connexion:', err.message);
  console.log('⚠️  Continuons quand même avec le test...');
  testCreateEspaceMembre();
});

