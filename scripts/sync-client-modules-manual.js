/**
 * Script pour synchroniser manuellement les modules d'un espace client
 * depuis son plan d'abonnement
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

async function syncClientModules(clientEmail) {
  console.log('\n🔄 Synchronisation des modules pour:', clientEmail);
  console.log('='.repeat(60));

  try {
    // 1. Trouver le client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, entreprise_id')
      .eq('email', clientEmail)
      .maybeSingle();

    if (clientError || !client) {
      console.error('❌ Client non trouvé:', clientError?.message);
      return;
    }

    console.log('✅ Client trouvé:', client.id);

    // 2. Trouver l'espace membre
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, abonnement_id')
      .eq('client_id', client.id)
      .maybeSingle();

    if (espaceError || !espace) {
      console.error('❌ Espace membre non trouvé:', espaceError?.message);
      return;
    }

    console.log('✅ Espace membre trouvé:', espace.id);
    console.log('📋 Abonnement ID:', espace.abonnement_id);

    if (!espace.abonnement_id) {
      console.log('⚠️ Pas d\'abonnement associé à l\'espace membre');
      console.log('💡 Vous devez créer un abonnement pour ce client');
      return;
    }

    // 3. Récupérer le plan de l'abonnement
    const { data: abonnement, error: aboError } = await supabase
      .from('abonnements')
      .select('plan_id')
      .eq('id', espace.abonnement_id)
      .maybeSingle();

    if (aboError || !abonnement || !abonnement.plan_id) {
      console.error('❌ Abonnement ou plan non trouvé:', aboError?.message);
      return;
    }

    console.log('✅ Plan ID:', abonnement.plan_id);

    // 4. Récupérer les modules du plan
    const { data: planModules, error: planError } = await supabase
      .from('plans_modules')
      .select('module_code, inclus')
      .eq('plan_id', abonnement.plan_id)
      .eq('inclus', true);

    if (planError) {
      console.error('❌ Erreur lecture modules du plan:', planError.message);
      return;
    }

    if (!planModules || planModules.length === 0) {
      console.log('⚠️ Aucun module inclus dans le plan');
      return;
    }

    console.log('\n📦 Modules inclus dans le plan:');
    planModules.forEach(pm => {
      console.log(`  ✅ ${pm.module_code}`);
    });

    // 5. Construire le JSON des modules actifs
    const modulesActifs = {};
    planModules.forEach(pm => {
      modulesActifs[pm.module_code] = true;
    });

    console.log('\n📋 Modules actifs à synchroniser:');
    console.log(JSON.stringify(modulesActifs, null, 2));

    // 6. Mettre à jour l'espace membre
    const { error: updateError } = await supabase
      .from('espaces_membres_clients')
      .update({
        modules_actifs: modulesActifs,
        updated_at: new Date().toISOString()
      })
      .eq('id', espace.id);

    if (updateError) {
      console.error('❌ Erreur mise à jour modules:', updateError.message);
      return;
    }

    console.log('\n✅ Modules synchronisés avec succès !');
    console.log('💡 Le client doit se déconnecter et se reconnecter pour voir les changements.');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/sync-client-modules-manual.js <email_client>');
  process.exit(1);
}

syncClientModules(clientEmail);




