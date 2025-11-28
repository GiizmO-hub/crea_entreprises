#!/usr/bin/env node
/**
 * Script pour activer automatiquement les modules déjà créés dans chaque plan
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

async function activerModulesCrees() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 ACTIVATION DES MODULES CRÉÉS DANS LES PLANS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer tous les modules créés (est_cree = true ou actif = true)
    console.log('📋 ÉTAPE 1: Recherche des modules déjà créés...\n');
    
    let modulesCrees = [];
    
    // Essayer modules_activation
    const { data: modulesActivation, error: error1 } = await supabase
      .from('modules_activation')
      .select('module_code, module_nom, est_cree, actif')
      .or('est_cree.eq.true,actif.eq.true');
    
    if (!error1 && modulesActivation && modulesActivation.length > 0) {
      modulesCrees = modulesActivation.map(m => ({
        code: m.module_code,
        nom: m.module_nom || m.module_code,
        source: 'modules_activation'
      }));
      console.log(`   ✅ ${modulesCrees.length} module(s) trouvé(s) dans modules_activation`);
    }
    
    // Si aucun module trouvé, utiliser les modules définis dans le code
    if (modulesCrees.length === 0) {
      console.log('   ⚠️  Aucun module dans modules_activation, utilisation de la liste par défaut');
      
      // Modules de base toujours créés
      modulesCrees = [
        { code: 'dashboard', nom: 'Tableau de bord', source: 'default' },
        { code: 'clients', nom: 'Gestion des clients', source: 'default' },
        { code: 'factures', nom: 'Facturation', source: 'default' },
        { code: 'documents', nom: 'Gestion de documents', source: 'default' },
        { code: 'collaborateurs', nom: 'Gestion des collaborateurs', source: 'default' },
        { code: 'gestion-equipe', nom: 'Gestion d\'équipe', source: 'default' },
        { code: 'gestion-projets', nom: 'Gestion de projets', source: 'default' },
        { code: 'modules', nom: 'Gestion des modules', source: 'default' },
        { code: 'gestion-plans', nom: 'Gestion des plans', source: 'default' },
        { code: 'parametres', nom: 'Paramètres', source: 'default' }
      ];
    }
    
    console.log(`\n   📦 Modules créés identifiés: ${modulesCrees.length}`);
    modulesCrees.forEach(m => {
      console.log(`      → ${m.code} (${m.nom})`);
    });
    console.log('');
    
    // 2. Récupérer tous les plans
    console.log('📋 ÉTAPE 2: Récupération des plans d\'abonnement...\n');
    
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('id, nom, ordre')
      .eq('actif', true)
      .order('ordre', { ascending: true });
    
    if (plansError) {
      throw new Error(`Erreur récupération plans: ${plansError.message}`);
    }
    
    if (!plans || plans.length === 0) {
      throw new Error('Aucun plan d\'abonnement trouvé');
    }
    
    console.log(`   ✅ ${plans.length} plan(s) trouvé(s)\n`);
    
    // 3. Pour chaque plan, activer les modules créés selon le niveau du plan
    console.log('📋 ÉTAPE 3: Activation des modules dans les plans...\n');
    
    const mappingModulesParPlan = {
      'Starter': ['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements'],
      'Business': ['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements', 'comptabilite', 'salaries', 'automatisations', 'messagerie'],
      'Professional': ['dashboard', 'clients', 'factures', 'documents', 'tableau_de_bord', 'mon_entreprise', 'abonnements', 'comptabilite', 'salaries', 'automatisations', 'messagerie', 'administration', 'api', 'support_prioritaire', 'collaborateurs', 'gestion-equipe', 'gestion-projets'],
      'Enterprise': [] // Tous les modules
    };
    
    let totalActives = 0;
    
    for (const plan of plans) {
      console.log(`   🔧 Plan "${plan.nom}"...`);
      
      // Déterminer quels modules activer pour ce plan
      let modulesAActiver = [];
      
      if (plan.nom === 'Enterprise') {
        // Enterprise : activer TOUS les modules créés
        modulesAActiver = modulesCrees.map(m => m.code);
      } else {
        // Autres plans : utiliser le mapping
        const modulesPlan = mappingModulesParPlan[plan.nom] || [];
        modulesAActiver = modulesCrees
          .filter(m => modulesPlan.includes(m.code))
          .map(m => m.code);
      }
      
      // Activer chaque module dans le plan
      let activationsPlan = 0;
      for (const moduleCode of modulesAActiver) {
        const moduleInfo = modulesCrees.find(m => m.code === moduleCode);
        
        const { error: insertError } = await supabase
          .from('plan_modules')
          .upsert({
            plan_id: plan.id,
            module_code: moduleCode,
            module_nom: moduleInfo?.nom || moduleCode,
            activer: true
          }, {
            onConflict: 'plan_id,module_code'
          });
        
        if (insertError) {
          console.error(`      ❌ Erreur activation ${moduleCode}: ${insertError.message}`);
        } else {
          activationsPlan++;
        }
      }
      
      console.log(`      ✅ ${activationsPlan} module(s) activé(s)`);
      totalActives += activationsPlan;
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ ACTIVATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   📊 Total : ${totalActives} module(s) activé(s) dans ${plans.length} plan(s)\n`);
    
  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'activation:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

activerModulesCrees().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

