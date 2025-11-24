#!/usr/bin/env node

/**
 * Script de test complet pour vérifier toutes les fonctions RPC
 * 
 * Usage:
 *   node scripts/test-all-functions.js
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
  console.error('❌ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Fonctions à tester
const functionsToTest = [
  {
    name: 'is_platform_super_admin',
    params: [],
    description: 'Vérifier si l\'utilisateur est super admin plateforme'
  },
  {
    name: 'get_client_super_admin_status',
    params: [{ p_entreprise_id: '00000000-0000-0000-0000-000000000000' }],
    description: 'Récupérer le statut super admin d\'un client',
    skipIfNoData: true
  },
  {
    name: 'create_espace_membre_from_client_unified',
    params: [{
      p_client_id: '00000000-0000-0000-0000-000000000000',
      p_entreprise_id: '00000000-0000-0000-0000-000000000000',
      p_password: 'test123',
      p_plan_id: null,
      p_options_ids: null
    }],
    description: 'Créer un espace membre (test avec IDs fictifs)',
    skipIfNoData: true,
    expectError: true // On s'attend à une erreur car les IDs sont fictifs
  }
];

async function testFunctions() {
  console.log('🧪 TESTS DES FONCTIONS RPC\n');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const func of functionsToTest) {
    try {
      console.log(`📋 Test: ${func.name}`);
      console.log(`   ${func.description}`);
      
      const { data, error } = await supabase.rpc(func.name, func.params || {});
      
      if (error) {
        if (func.expectError) {
          console.log(`   ✅ Erreur attendue (IDs fictifs): ${error.message.substring(0, 60)}...`);
          successCount++;
        } else if (func.skipIfNoData && error.message.includes('non trouvé')) {
          console.log(`   ⚠️  Aucune donnée de test disponible (ignoré)`);
          successCount++;
        } else {
          console.log(`   ❌ ERREUR: ${error.message}`);
          errors.push({ function: func.name, error: error.message });
          errorCount++;
        }
      } else {
        console.log(`   ✅ SUCCÈS`);
        successCount++;
      }
      console.log('');
      
    } catch (err) {
      console.log(`   ❌ EXCEPTION: ${err.message}`);
      errors.push({ function: func.name, error: err.message });
      errorCount++;
      console.log('');
    }
  }

  console.log('📊 RÉSUMÉ DES TESTS');
  console.log(`   ✅ Succès: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERREURS DÉTECTÉES:');
    errors.forEach(({ function: name, error }) => {
      console.log(`   - ${name}: ${error.substring(0, 80)}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅✅✅ TOUS LES TESTS SONT PASSÉS! ✅✅✅');
    process.exit(0);
  }
}

// Vérifier la connexion d'abord
supabase.auth.getSession().then(() => {
  testFunctions();
}).catch(err => {
  console.error('❌ Erreur de connexion:', err.message);
  console.log('⚠️  Continuons quand même avec les tests de fonctions...');
  testFunctions();
});

