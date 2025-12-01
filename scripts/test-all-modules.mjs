#!/usr/bin/env node

/**
 * SCRIPT DE TEST COMPLET - TOUS LES MODULES
 * 
 * Teste chaque module de l'application pour détecter les erreurs
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erreur: VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurés');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const modules = [
  { name: 'Factures', table: 'factures', required: true },
  { name: 'Clients', table: 'clients', required: true },
  { name: 'Entreprises', table: 'entreprises', required: true },
  { name: 'Abonnements', table: 'abonnements', required: true },
  { name: 'Paiements', table: 'paiements', required: true },
  { name: 'Plans', table: 'plans_abonnement', required: true },
  { name: 'Espaces Membres', table: 'espaces_membres_clients', required: true },
  { name: 'Notifications', table: 'notifications', required: false },
  { name: 'Paramètres Documents', table: 'parametres_documents', required: false },
];

async function testModule(module) {
  try {
    const { data, error } = await supabase
      .from(module.table)
      .select('*')
      .limit(1);
    
    if (error) {
      if (module.required) {
        return { success: false, error: error.message };
      } else {
        return { success: true, warning: `Table ${module.table} n'existe pas (optionnelle)` };
      }
    }
    
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAllModules() {
  console.log('🧪 TEST COMPLET DE TOUS LES MODULES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];
  
  for (const module of modules) {
    console.log(`📦 Test ${module.name} (${module.table})...`);
    const result = await testModule(module);
    results.push({ module: module.name, ...result });
    
    if (result.success) {
      if (result.warning) {
        console.log(`   ⚠️  ${result.warning}`);
      } else {
        console.log(`   ✅ OK`);
      }
    } else {
      console.log(`   ❌ ERREUR: ${result.error}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ\n');
  
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  
  console.log(`   ✅ Modules OK: ${successCount}/${modules.length}`);
  console.log(`   ❌ Modules en erreur: ${errorCount}/${modules.length}`);
  
  if (errorCount > 0) {
    console.log('\n   📋 Modules en erreur:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`      - ${r.module}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Tests terminés !');
}

testAllModules().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

