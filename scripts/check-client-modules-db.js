/**
 * Script pour vérifier directement dans la base de données
 * les modules d'un espace client et diagnostiquer pourquoi ils ne s'affichent pas
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClientModules(clientEmail) {
  console.log('\n🔍 DIAGNOSTIC COMPLET ESPACE CLIENT\n');
  console.log('='.repeat(70));
  console.log(`📧 Email client: ${clientEmail}`);
  console.log('='.repeat(70));

  try {
    // 1. Trouver le client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, entreprise_id')
      .ilike('email', `%${clientEmail}%`);

    if (clientError) {
      console.error('❌ Erreur recherche client:', clientError.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ Aucun client trouvé avec cet email');
      return;
    }

    console.log(`\n✅ ${clients.length} client(s) trouvé(s):`);
    clients.forEach((client, idx) => {
      console.log(`\n  [${idx + 1}] Client ID: ${client.id}`);
      console.log(`      Nom: ${client.nom || 'N/A'} ${client.prenom || ''}`);
      console.log(`      Email: ${client.email}`);
      console.log(`      Entreprise ID: ${client.entreprise_id}`);

      // Pour chaque client, vérifier son espace
      checkClientEspace(client);
    });

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

async function checkClientEspace(client) {
  console.log(`\n  📦 Vérification espace membre pour client ${client.id}...`);

  // 1. Trouver l'espace membre
  const { data: espace, error: espaceError } = await supabase
    .from('espaces_membres_clients')
    .select('id, user_id, modules_actifs, abonnement_id, actif')
    .eq('client_id', client.id)
    .maybeSingle();

  if (espaceError) {
    console.log(`    ❌ Erreur: ${espaceError.message}`);
    return;
  }

  if (!espace) {
    console.log(`    ⚠️ Pas d'espace membre trouvé pour ce client`);
    console.log(`    💡 Il faut créer un espace membre pour ce client`);
    return;
  }

  console.log(`    ✅ Espace membre trouvé: ${espace.id}`);
  console.log(`    👤 User ID: ${espace.user_id || 'NON DÉFINI'}`);
  console.log(`    📋 Abonnement ID: ${espace.abonnement_id || 'NON DÉFINI'}`);
  console.log(`    ✅ Actif: ${espace.actif}`);

  // 2. Afficher les modules actifs
  console.log(`\n    📦 Modules actifs dans la base:`);
  if (espace.modules_actifs && typeof espace.modules_actifs === 'object') {
    const modules = espace.modules_actifs;
    const modulesList = Object.keys(modules).filter(key => {
      const value = modules[key];
      return value === true || value === 'true' || value === 1 || value === '1';
    });

    if (modulesList.length === 0) {
      console.log(`      ⚠️ AUCUN MODULE ACTIF !`);
      console.log(`      📋 Contenu de modules_actifs:`, JSON.stringify(modules, null, 2));
    } else {
      console.log(`      ✅ ${modulesList.length} module(s) actif(s):`);
      modulesList.forEach(module => {
        console.log(`         - ${module}`);
      });
    }

    console.log(`\n    📋 Tous les modules (actifs et inactifs):`);
    Object.keys(modules).forEach(module => {
      const value = modules[module];
      const isActive = value === true || value === 'true' || value === 1 || value === '1';
      console.log(`      ${isActive ? '✅' : '❌'} ${module}: ${value} (type: ${typeof value})`);
    });
  } else {
    console.log(`      ⚠️ modules_actifs est vide ou invalide:`, espace.modules_actifs);
  }

  // 3. Vérifier l'abonnement et les modules du plan
  if (espace.abonnement_id) {
    console.log(`\n    💳 Vérification abonnement...`);
    
    const { data: abonnement, error: aboError } = await supabase
      .from('abonnements')
      .select('id, plan_id, statut')
      .eq('id', espace.abonnement_id)
      .maybeSingle();

    if (aboError) {
      console.log(`      ❌ Erreur: ${aboError.message}`);
    } else if (!abonnement) {
      console.log(`      ⚠️ Abonnement non trouvé`);
    } else {
      console.log(`      ✅ Abonnement trouvé: ${abonnement.id}`);
      console.log(`      📋 Plan ID: ${abonnement.plan_id}`);
      console.log(`      📊 Statut: ${abonnement.statut}`);

      if (abonnement.plan_id) {
        const { data: planModules, error: planError } = await supabase
          .from('plans_modules')
          .select('module_code, inclus')
          .eq('plan_id', abonnement.plan_id)
          .eq('inclus', true);

        if (planError) {
          console.log(`      ❌ Erreur lecture modules: ${planError.message}`);
        } else if (!planModules || planModules.length === 0) {
          console.log(`      ⚠️ Aucun module inclus dans le plan`);
        } else {
          console.log(`\n      📦 Modules inclus dans le plan (${planModules.length}):`);
          planModules.forEach(pm => {
            console.log(`         ✅ ${pm.module_code}`);
          });

          // Comparer avec les modules actifs
          const modulesActifs = espace.modules_actifs || {};
          const modulesPlan = planModules.map(pm => pm.module_code);
          const modulesManquants = modulesPlan.filter(code => {
            const value = modulesActifs[code];
            return !(value === true || value === 'true' || value === 1 || value === '1');
          });

          if (modulesManquants.length > 0) {
            console.log(`\n      ⚠️ MODULES DU PLAN NON SYNCHRONISÉS:`);
            modulesManquants.forEach(code => {
              console.log(`         ❌ ${code} (dans le plan mais pas dans modules_actifs)`);
            });
          } else {
            console.log(`\n      ✅ Tous les modules du plan sont synchronisés`);
          }
        }
      }
    }
  } else {
    console.log(`\n    ⚠️ Pas d'abonnement associé à l'espace membre`);
    console.log(`    💡 Il faut créer un abonnement pour ce client`);
  }

  // 4. Vérifier le statut super_admin
  if (espace.user_id) {
    console.log(`\n    👑 Vérification statut Super Admin...`);
    
    const { data: utilisateur, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, email, role')
      .eq('id', espace.user_id)
      .maybeSingle();

    if (userError) {
      console.log(`      ⚠️ Erreur lecture utilisateurs: ${userError.message}`);
    } else if (!utilisateur) {
      console.log(`      ⚠️ Utilisateur non trouvé dans utilisateurs`);
    } else {
      console.log(`      ✅ Utilisateur trouvé`);
      console.log(`      📋 Rôle: ${utilisateur.role}`);
      console.log(`      👑 Est client_super_admin: ${utilisateur.role === 'client_super_admin' ? '✅ OUI' : '❌ NON'}`);
    }
  }

  console.log(`\n    ${'='.repeat(68)}`);
}

const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/check-client-modules-db.js <email_client>');
  console.error('Exemple: node scripts/check-client-modules-db.js groupemclem@gmail.com');
  process.exit(1);
}

checkClientModules(clientEmail);

