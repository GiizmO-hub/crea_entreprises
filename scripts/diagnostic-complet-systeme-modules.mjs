#!/usr/bin/env node
/**
 * Script de diagnostic complet du système de modules et plans
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

async function diagnosticComplet() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC COMPLET DU SYSTÈME');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Vérifier les plans
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
      console.error('   ❌ Aucun plan trouvé !\n');
      return false;
    }
    
    console.log(`   ✅ ${plans.length} plan(s) trouvé(s):\n`);
    plans.forEach(plan => {
      console.log(`   • ${plan.nom} (${plan.prix_mensuel}€/mois) - ID: ${plan.id}`);
    });
    console.log('');
    
    // 2. Vérifier les modules activés dans modules_activation
    console.log('📋 ÉTAPE 2: Vérification des modules créés...\n');
    
    let modulesCrees = [];
    try {
      const { data: modulesActivation, error: modulesError } = await supabase
        .from('modules_activation')
        .select('module_code, module_nom, est_cree, actif')
        .or('est_cree.eq.true,actif.eq.true');
      
      if (!modulesError && modulesActivation) {
        modulesCrees = modulesActivation;
        console.log(`   ✅ ${modulesCrees.length} module(s) créé(s) trouvé(s):\n`);
        modulesCrees.forEach(m => {
          console.log(`   • ${m.module_code} (${m.module_nom || 'N/A'})`);
        });
      } else {
        console.log(`   ⚠️  ${modulesError?.message || 'Aucun module trouvé'}`);
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur: ${e.message}`);
    }
    console.log('');
    
    // 3. Vérifier plan_modules pour chaque plan
    console.log('📋 ÉTAPE 3: Vérification des modules par plan...\n');
    
    for (const plan of plans) {
      const { data: planModules, error: modulesError } = await supabase
        .from('plan_modules')
        .select('module_code, module_nom, activer')
        .eq('plan_id', plan.id);
      
      if (modulesError) {
        console.error(`   ❌ Erreur pour ${plan.nom}: ${modulesError.message}`);
      } else {
        const modulesActives = planModules?.filter(m => m.activer === true) || [];
        console.log(`   📦 Plan "${plan.nom}": ${planModules?.length || 0} module(s) total, ${modulesActives.length} activé(s)`);
        
        if (modulesActives.length === 0) {
          console.error(`      ❌ PROBLÈME: Aucun module activé pour ce plan !`);
        } else {
          modulesActives.slice(0, 5).forEach(m => {
            console.log(`      → ${m.module_code} (${m.module_nom || 'N/A'})`);
          });
          if (modulesActives.length > 5) {
            console.log(`      ... et ${modulesActives.length - 5} autre(s)`);
          }
        }
      }
      console.log('');
    }
    
    // 4. Vérifier les fonctions
    console.log('📋 ÉTAPE 4: Vérification des fonctions...\n');
    
    if (pool) {
      try {
        const { rows: functions } = await pool.query(`
          SELECT 
            proname as function_name,
            pg_get_function_arguments(oid) as arguments,
            pronargs as arg_count
          FROM pg_proc 
          WHERE proname IN ('sync_client_modules_from_plan', 'get_user_available_modules', 'verify_modules_configuration')
          ORDER BY proname;
        `);
        
        if (functions.length > 0) {
          console.log(`   ✅ ${functions.length} fonction(s) trouvée(s):\n`);
          functions.forEach(f => {
            console.log(`   • ${f.function_name}(${f.arguments}) - ${f.arg_count} paramètre(s)`);
          });
        } else {
          console.error('   ❌ Aucune fonction trouvée !\n');
        }
      } catch (e) {
        console.error(`   ❌ Erreur vérification fonctions: ${e.message}\n`);
      }
    } else {
      console.log('   ⚠️  DATABASE_URL non configuré, impossible de vérifier les fonctions directement\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 DIAGNOSTIC TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERREUR lors du diagnostic:');
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

diagnosticComplet().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

