#!/usr/bin/env node

/**
 * Script pour analyser l'abonnement et les modules d'un client
 * Usage: node scripts/analyze-client-modules.mjs groupemclem@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userEmail = process.argv[2] || 'groupemclem@gmail.com';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🔍 ANALYSE : Abonnement et modules pour ${userEmail}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function analyzeClient() {
  try {
    // 1. Trouver l'utilisateur
    console.log('📋 1. Recherche de l\'utilisateur...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erreur liste users:', usersError.message);
      return;
    }
    
    const user = usersData.users.find(u => u.email === userEmail);
    
    if (!user) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé`);
      return;
    }
    
    console.log(`✅ Utilisateur trouvé: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rôle metadata: ${user.user_metadata?.role || 'N/A'}`);
    console.log(`   Rôle app metadata: ${user.app_metadata?.role || 'N/A'}\n`);

    // 2. Trouver l'espace membre client
    console.log('📋 2. Recherche de l\'espace membre client...');
    const { data: espaceClient, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('*, client:clients(*), entreprise:entreprises(*)')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (espaceError) {
      console.error('❌ Erreur recherche espace client:', espaceError.message);
      return;
    }
    
    if (!espaceClient) {
      console.log('⚠️  Aucun espace membre client trouvé');
      return;
    }
    
    console.log(`✅ Espace membre client trouvé:`);
    console.log(`   ID: ${espaceClient.id}`);
    console.log(`   Client ID: ${espaceClient.client_id}`);
    console.log(`   Entreprise ID: ${espaceClient.entreprise_id}`);
    console.log(`   Actif: ${espaceClient.actif}`);
    console.log(`   Modules actifs (JSON):`, JSON.stringify(espaceClient.modules_actifs, null, 2));
    console.log(`\n   Modules actifs (liste):`);
    if (espaceClient.modules_actifs) {
      Object.entries(espaceClient.modules_actifs).forEach(([code, actif]) => {
        if (actif === true || actif === 'true' || actif === 1) {
          console.log(`     ✅ ${code}`);
        }
      });
    }
    console.log('');

    // 3. Trouver l'abonnement
    console.log('📋 3. Recherche de l\'abonnement...');
    const { data: abonnement, error: abonnementError } = await supabase
      .from('abonnements')
      .select(`
        *,
        plan:plans_abonnement(*)
      `)
      .eq('client_id', espaceClient.client_id)
      .maybeSingle();
    
    if (abonnementError) {
      console.error('❌ Erreur recherche abonnement:', abonnementError.message);
    } else if (!abonnement) {
      console.log('⚠️  Aucun abonnement trouvé');
    } else {
      console.log(`✅ Abonnement trouvé:`);
      console.log(`   ID: ${abonnement.id}`);
      console.log(`   Plan: ${abonnement.plan?.nom || 'N/A'}`);
      console.log(`   Statut: ${abonnement.statut}`);
      console.log(`   Date début: ${abonnement.date_debut}`);
      console.log(`   Date fin: ${abonnement.date_fin || 'N/A'}`);
      console.log('');
      
      // 4. Trouver les modules du plan
      if (abonnement.plan_id) {
        console.log('📋 4. Recherche des modules du plan...');
        const { data: planModules, error: planModulesError } = await supabase
          .from('plan_modules')
          .select(`
            *,
            module:modules_activation(*)
          `)
          .eq('plan_id', abonnement.plan_id);
        
        if (planModulesError) {
          console.error('❌ Erreur recherche modules plan:', planModulesError.message);
        } else if (!planModules || planModules.length === 0) {
          console.log('⚠️  Aucun module trouvé pour ce plan');
        } else {
          console.log(`✅ Modules du plan (${planModules.length}):`);
          planModules.forEach((pm) => {
            console.log(`   ${pm.inclus ? '✅' : '❌'} ${pm.module_code} (inclus: ${pm.inclus})`);
          });
          console.log('');
        }
      }
    }

    // 5. Comparaison avec le screenshot
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 COMPARAISON AVEC LE SCREENSHOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const modulesScreen = [
      'dashboard',      // Tableau de bord
      'entreprises',    // Mon Entreprise
      'clients',        // Clients
      'factures',       // Facturation
      'collaborateurs', // Collaborateurs
      'comptabilite',   // Comptabilité
      'settings',       // Paramètres
    ];
    
    console.log('📱 Modules affichés dans le screenshot:');
    modulesScreen.forEach(m => console.log(`   ✅ ${m}`));
    console.log('');
    
    // Mapper les modules actifs depuis la BDD vers les IDs du menu
    const moduleMapping = {
      'tableau_de_bord': 'dashboard',
      'mon_entreprise': 'entreprises',
      'gestion_clients': 'clients',
      'facturation': 'factures',
      'collaborateurs': 'collaborateurs',
      'comptabilite': 'comptabilite',
      'comptabilité': 'comptabilite',
      'parametres': 'settings',
      'paramètres': 'settings',
    };
    
    const modulesFromDB = new Set();
    if (espaceClient.modules_actifs) {
      Object.entries(espaceClient.modules_actifs).forEach(([code, actif]) => {
        if (actif === true || actif === 'true' || actif === 1) {
          const menuId = moduleMapping[code] || code;
          modulesFromDB.add(menuId);
        }
      });
    }
    
    // Toujours ajouter les modules de base
    modulesFromDB.add('dashboard');
    modulesFromDB.add('entreprises');
    modulesFromDB.add('settings');
    
    console.log('💾 Modules actifs dans la BDD (mappés):');
    Array.from(modulesFromDB).forEach(m => console.log(`   ✅ ${m}`));
    console.log('');
    
    // Comparaison
    console.log('🔍 ANALYSE DES DIFFÉRENCES:');
    const missingInDB = modulesScreen.filter(m => !modulesFromDB.has(m));
    const missingInScreen = Array.from(modulesFromDB).filter(m => !modulesScreen.includes(m));
    
    if (missingInDB.length === 0 && missingInScreen.length === 0) {
      console.log('   ✅ Parfait ! Tous les modules correspondent.');
    } else {
      if (missingInDB.length > 0) {
        console.log(`   ⚠️  Modules dans le screenshot mais PAS dans la BDD:`);
        missingInDB.forEach(m => console.log(`      ❌ ${m}`));
      }
      if (missingInScreen.length > 0) {
        console.log(`   ⚠️  Modules dans la BDD mais PAS dans le screenshot:`);
        missingInScreen.forEach(m => console.log(`      ℹ️  ${m}`));
      }
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

analyzeClient();

