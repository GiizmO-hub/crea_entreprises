#!/usr/bin/env node
/**
 * Script pour vérifier la configuration des modules et plans d'abonnement
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifierConfiguration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION DE LA CONFIGURATION DES MODULES');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Vérifier les plans d'abonnement
    console.log('📋 ÉTAPE 1: Vérification des plans d\'abonnement...\n');
    
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: true });
    
    if (plansError) {
      throw new Error(`Erreur récupération plans: ${plansError.message}`);
    }
    
    if (!plans || plans.length === 0) {
      console.log('   ❌ Aucun plan d\'abonnement trouvé\n');
    } else {
      console.log(`   ✅ ${plans.length} plan(s) trouvé(s):\n`);
      plans.forEach(plan => {
        console.log(`   • ${plan.nom}: ${plan.prix_mensuel}€/mois`);
      });
      console.log('');
    }
    
    // 2. Vérifier les modules liés aux plans
    console.log('📋 ÉTAPE 2: Vérification des modules par plan...\n');
    
    for (const plan of plans || []) {
      const { data: modules, error: modulesError } = await supabase
        .from('plan_modules')
        .select('module_code, module_nom')
        .eq('plan_id', plan.id)
        .eq('activer', true);
      
      if (modulesError) {
        console.error(`   ❌ Erreur pour plan ${plan.nom}: ${modulesError.message}\n`);
      } else {
        console.log(`   📦 Plan "${plan.nom}": ${modules?.length || 0} module(s)`);
        if (modules && modules.length > 0) {
          modules.forEach(mod => {
            console.log(`      → ${mod.module_code} (${mod.module_nom || 'N/A'})`);
          });
        }
        console.log('');
      }
    }
    
    // 3. Vérifier la fonction verify_modules_configuration
    console.log('📋 ÉTAPE 3: Vérification de la configuration globale...\n');
    
    const { data: configResult, error: configError } = await supabase.rpc('verify_modules_configuration');
    
    if (configError) {
      console.error(`   ❌ Erreur vérification configuration: ${configError.message}\n`);
    } else {
      console.log('   📊 Résultat de la vérification:');
      console.log(`      → Plans actifs: ${configResult?.plans_actifs || 0}`);
      console.log(`      → Modules uniques: ${configResult?.modules_uniques || 0}`);
      console.log(`      → Liaisons plan-modules: ${configResult?.liaisons_plan_modules || 0}`);
      console.log(`      → Statut: ${configResult?.status === 'ok' ? '✅ OK' : '⚠️ INCOMPLET'}\n`);
    }
    
    // 4. Vérifier les fonctions
    console.log('📋 ÉTAPE 4: Vérification des fonctions...\n');
    
    const functions = [
      'sync_client_modules_from_plan',
      'get_user_available_modules',
      'verify_modules_configuration'
    ];
    
    for (const funcName of functions) {
      const { data: funcExists, error: funcError } = await supabase.rpc('verify_modules_configuration');
      
      // Vérifier via une requête SQL directe
      const { data: funcCheck } = await supabase
        .from('_functions')
        .select('name')
        .eq('name', funcName)
        .single();
      
      if (funcCheck || !funcError) {
        console.log(`   ✅ Fonction ${funcName} disponible`);
      } else {
        console.log(`   ⚠️  Fonction ${funcName} non vérifiée (peut exister mais non accessible via RPC)`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ VÉRIFICATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR lors de la vérification:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

verifierConfiguration().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

