/**
 * Script pour vérifier le mapping des modules d'un client
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
  console.log('\n🔍 VÉRIFICATION DU MAPPING DES MODULES\n');
  console.log('='.repeat(80));
  console.log(`📧 Email client: ${clientEmail}`);
  console.log('='.repeat(80));

  try {
    // Trouver le client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, nom, prenom, entreprise_id')
      .ilike('email', `%${clientEmail}%`)
      .maybeSingle();

    if (clientError || !client) {
      console.error('❌ Client non trouvé:', clientError?.message);
      return;
    }

    console.log(`✅ Client trouvé: ${client.nom} ${client.prenom} (${client.id})`);

    // Trouver l'espace membre
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, abonnement_id, modules_actifs')
      .eq('client_id', client.id)
      .maybeSingle();

    if (espaceError || !espace) {
      console.error('❌ Espace membre non trouvé:', espaceError?.message);
      return;
    }

    console.log(`✅ Espace membre trouvé: ${espace.id}`);
    console.log(`📋 Abonnement ID: ${espace.abonnement_id || 'NON DÉFINI'}`);

    // Récupérer les modules dans modules_actifs
    const modulesActifs = espace.modules_actifs || {};
    console.log(`\n📦 Modules actifs dans l'espace (${Object.keys(modulesActifs).length}):`);
    Object.keys(modulesActifs).forEach(code => {
      const val = modulesActifs[code];
      const isActive = val === true || val === 'true' || val === 1;
      console.log(`   ${isActive ? '✅' : '❌'} ${code}: ${val}`);
    });

    // Si abonnement existe, comparer avec les modules du plan
    if (espace.abonnement_id) {
      const { data: abonnement } = await supabase
        .from('abonnements')
        .select('plan_id, statut')
        .eq('id', espace.abonnement_id)
        .maybeSingle();

      if (abonnement && abonnement.plan_id) {
        console.log(`\n💳 Plan ID: ${abonnement.plan_id}`);

        // Récupérer les modules du plan
        const { data: planModules } = await supabase
          .from('plans_modules')
          .select('module_code, inclus')
          .eq('plan_id', abonnement.plan_id)
          .eq('inclus', true);

        if (planModules && planModules.length > 0) {
          console.log(`\n📦 Modules inclus dans le plan (${planModules.length}):`);
          planModules.forEach(pm => {
            const code = pm.module_code;
            const dansModulesActifs = modulesActifs[code] === true || modulesActifs[code] === 'true' || modulesActifs[code] === 1;
            console.log(`   ${dansModulesActifs ? '✅' : '❌'} ${code}`);
            if (!dansModulesActifs) {
              console.log(`      ⚠️  Présent dans le plan mais PAS dans modules_actifs`);
            }
          });
        }

        // Récupérer les modules dans modules_activation
        const moduleCodes = planModules?.map(pm => pm.module_code) || [];
        if (moduleCodes.length > 0) {
          const { data: modulesActivation } = await supabase
            .from('modules_activation')
            .select('module_code, module_nom, actif, est_cree')
            .in('module_code', moduleCodes);

          if (modulesActivation && modulesActivation.length > 0) {
            console.log(`\n📋 Modules dans modules_activation:`);
            modulesActivation.forEach(ma => {
              console.log(`   ${ma.actif && ma.est_cree ? '✅' : '❌'} ${ma.module_code} (${ma.module_nom || 'N/A'}) - actif: ${ma.actif}, créé: ${ma.est_cree}`);
            });
          }
        }
      }
    }

    // Mapping attendu
    console.log(`\n📝 Mapping attendu dans Layout.tsx:`);
    const expectedMappings = {
      'gestion-equipe': 'gestion-equipe',
      'gestion_equipe': 'gestion-equipe',
      'gestion-collaborateurs': 'collaborateurs',
      'gestion_des_collaborateurs': 'collaborateurs',
      'gestion-projets': 'gestion-projets',
      'gestion_projets': 'gestion-projets',
    };

    Object.entries(expectedMappings).forEach(([code, menuId]) => {
      const dansModulesActifs = modulesActifs[code] === true || modulesActifs[code] === 'true' || modulesActifs[code] === 1;
      console.log(`   ${dansModulesActifs ? '✅' : '❌'} ${code} → ${menuId}`);
    });

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

const clientEmail = process.argv[2] || 'groupemclem@gmail.com';
checkClientModules(clientEmail);




