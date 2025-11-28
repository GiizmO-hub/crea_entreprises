#!/usr/bin/env node
/**
 * Script de test complet pour vérifier que les modules sont bien activés dans les plans
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
let pool = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
}

async function testComplet() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST COMPLET : MODULES ET PLANS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Vérifier les plans
    console.log('📋 ÉTAPE 1: Vérification des plans...\n');
    
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: true });
    
    if (plansError || !plans || plans.length === 0) {
      throw new Error('Aucun plan trouvé !');
    }
    
    console.log(`   ✅ ${plans.length} plan(s) trouvé(s)\n`);
    
    // 2. Vérifier les modules créés
    console.log('📋 ÉTAPE 2: Vérification des modules créés...\n');
    
    const { data: modulesCrees, error: modulesError } = await supabase
      .from('modules_activation')
      .select('module_code, module_nom, est_cree')
      .or('est_cree.eq.true,actif.eq.true');
    
    if (modulesError) {
      console.error(`   ❌ Erreur: ${modulesError.message}`);
    } else {
      console.log(`   ✅ ${modulesCrees?.length || 0} module(s) créé(s) trouvé(s)\n`);
    }
    
    // 3. Pour chaque plan, tester get_plan_modules et vérifier plan_modules
    console.log('📋 ÉTAPE 3: Test de get_plan_modules pour chaque plan...\n');
    
    for (const plan of plans) {
      console.log(`   🔧 Plan "${plan.nom}" (${plan.id}):\n`);
      
      // Test RPC get_plan_modules
      try {
        const { data: rpcModules, error: rpcError } = await supabase.rpc('get_plan_modules', {
          p_plan_id: plan.id
        });
        
        if (rpcError) {
          console.error(`      ❌ Erreur RPC get_plan_modules: ${rpcError.message}`);
        } else {
          const modulesInclus = rpcModules?.filter(m => m.inclus === true) || [];
          console.log(`      ✅ RPC get_plan_modules: ${rpcModules?.length || 0} module(s) retourné(s), ${modulesInclus.length} inclus`);
          
          if (modulesInclus.length > 0) {
            console.log(`         → Modules inclus: ${modulesInclus.slice(0, 5).map(m => m.module_code).join(', ')}${modulesInclus.length > 5 ? '...' : ''}`);
          }
        }
      } catch (e) {
        console.error(`      ❌ Exception RPC: ${e.message}`);
      }
      
      // Vérifier directement dans plan_modules
      const { data: planModules, error: pmError } = await supabase
        .from('plan_modules')
        .select('module_code, module_nom, activer')
        .eq('plan_id', plan.id);
      
      if (pmError) {
        console.error(`      ❌ Erreur plan_modules: ${pmError.message}`);
      } else {
        const modulesActives = planModules?.filter(m => m.activer === true) || [];
        console.log(`      ✅ Table plan_modules: ${planModules?.length || 0} module(s) total, ${modulesActives.length} activé(s)`);
        
        if (modulesActives.length === 0) {
          console.error(`      ❌ PROBLÈME: Aucun module activé dans plan_modules pour ce plan !`);
        }
      }
      
      console.log('');
    }
    
    // 4. Test de sync_client_modules_from_plan avec les deux signatures
    console.log('📋 ÉTAPE 4: Test de sync_client_modules_from_plan...\n');
    
    if (pool) {
      try {
        // Tester si les fonctions existent
        const { rows: functions } = await pool.query(`
          SELECT 
            proname as function_name,
            pg_get_function_arguments(oid) as arguments,
            pronargs as arg_count
          FROM pg_proc 
          WHERE proname = 'sync_client_modules_from_plan'
          ORDER BY pronargs;
        `);
        
        console.log(`   ✅ ${functions.length} version(s) de sync_client_modules_from_plan trouvée(s):\n`);
        functions.forEach(f => {
          console.log(`      • ${f.function_name}(${f.arguments}) - ${f.arg_count} paramètre(s)`);
        });
      } catch (e) {
        console.error(`   ❌ Erreur vérification fonctions: ${e.message}`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ TEST TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERREUR lors du test:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testComplet().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

