/**
 * Script de diagnostic pour l'espace client
 * Vérifie :
 * 1. Les modules actifs dans espaces_membres_clients
 * 2. Le statut client_super_admin
 * 3. La synchronisation des modules depuis les plans
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticClientEspace(clientEmail) {
  console.log('\n🔍 DIAGNOSTIC ESPACE CLIENT\n');
  console.log('='.repeat(60));
  console.log(`📧 Email client: ${clientEmail}`);
  console.log('='.repeat(60));

  try {
    // 1. Trouver le client par email
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, entreprise_id')
      .eq('email', clientEmail)
      .maybeSingle();

    if (clientError || !client) {
      console.error('❌ Client non trouvé:', clientError?.message);
      return;
    }

    console.log('\n✅ Client trouvé:');
    console.log('  - ID:', client.id);
    console.log('  - Nom:', client.nom, client.prenom);
    console.log('  - Email:', client.email);
    console.log('  - Entreprise ID:', client.entreprise_id);

    // 2. Trouver l'espace membre
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, user_id, modules_actifs, abonnement_id, actif')
      .eq('client_id', client.id)
      .maybeSingle();

    if (espaceError || !espace) {
      console.error('\n❌ Espace membre non trouvé:', espaceError?.message);
      return;
    }

    console.log('\n✅ Espace membre trouvé:');
    console.log('  - ID:', espace.id);
    console.log('  - User ID:', espace.user_id);
    console.log('  - Actif:', espace.actif);
    console.log('  - Abonnement ID:', espace.abonnement_id);

    // 3. Afficher les modules actifs
    console.log('\n📦 Modules actifs dans la base:');
    if (espace.modules_actifs && typeof espace.modules_actifs === 'object') {
      const modules = espace.modules_actifs;
      const modulesList = Object.keys(modules).filter(key => {
        const value = modules[key];
        return value === true || value === 'true' || value === 1;
      });
      
      if (modulesList.length === 0) {
        console.log('  ⚠️ AUCUN MODULE ACTIF !');
      } else {
        modulesList.forEach(module => {
          console.log(`  ✅ ${module}: ${modules[module]}`);
        });
      }
      
      console.log('\n📋 Tous les modules (actifs et inactifs):');
      Object.keys(modules).forEach(module => {
        const value = modules[module];
        const isActive = value === true || value === 'true' || value === 1;
        console.log(`  ${isActive ? '✅' : '❌'} ${module}: ${value} (type: ${typeof value})`);
      });
    } else {
      console.log('  ⚠️ modules_actifs est vide ou invalide:', espace.modules_actifs);
    }

    // 4. Vérifier le statut super_admin
    if (espace.user_id) {
      console.log('\n👤 Vérification statut Super Admin:');
      
      // Vérifier via RPC
      const { data: isSuperAdmin, error: rpcError } = await supabase.rpc(
        'check_my_super_admin_status'
      );

      if (rpcError) {
        console.log('  ⚠️ Erreur RPC:', rpcError.message);
      } else {
        console.log('  - check_my_super_admin_status():', isSuperAdmin);
      }

      // Vérifier directement dans utilisateurs
      const { data: utilisateur, error: userError } = await supabase
        .from('utilisateurs')
        .select('id, email, role')
        .eq('id', espace.user_id)
        .maybeSingle();

      if (userError) {
        console.log('  ⚠️ Erreur lecture utilisateurs:', userError.message);
      } else if (utilisateur) {
        console.log('  - Rôle dans utilisateurs:', utilisateur.role);
        console.log('  - Est client_super_admin:', utilisateur.role === 'client_super_admin');
      } else {
        console.log('  ⚠️ Utilisateur non trouvé dans utilisateurs');
      }
    } else {
      console.log('\n⚠️ Pas de user_id associé à l\'espace membre');
    }

    // 5. Vérifier l'abonnement et les modules du plan
    if (espace.abonnement_id) {
      console.log('\n💳 Vérification abonnement:');
      
      const { data: abonnement, error: aboError } = await supabase
        .from('abonnements')
        .select('id, plan_id, statut')
        .eq('id', espace.abonnement_id)
        .maybeSingle();

      if (aboError || !abonnement) {
        console.log('  ⚠️ Abonnement non trouvé:', aboError?.message);
      } else {
        console.log('  - Plan ID:', abonnement.plan_id);
        console.log('  - Statut:', abonnement.statut);

        // Récupérer les modules du plan
        if (abonnement.plan_id) {
          const { data: planModules, error: planError } = await supabase
            .from('plans_modules')
            .select('module_code, inclus')
            .eq('plan_id', abonnement.plan_id)
            .eq('inclus', true);

          if (planError) {
            console.log('  ⚠️ Erreur lecture modules du plan:', planError.message);
          } else if (planModules && planModules.length > 0) {
            console.log('\n  📦 Modules inclus dans le plan:');
            planModules.forEach(pm => {
              console.log(`    ✅ ${pm.module_code}`);
            });
          } else {
            console.log('  ⚠️ Aucun module inclus dans le plan');
          }
        }
      }
    } else {
      console.log('\n⚠️ Pas d\'abonnement associé à l\'espace membre');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic terminé\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du diagnostic:', error);
  }
}

// Récupérer l'email depuis les arguments
const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/diagnostic-client-espace.js <email_client>');
  console.error('Exemple: node scripts/diagnostic-client-espace.js client@example.com');
  process.exit(1);
}

diagnosticClientEspace(clientEmail);




