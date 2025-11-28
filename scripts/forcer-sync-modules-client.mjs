#!/usr/bin/env node
/**
 * Script pour forcer la synchronisation des modules d'un client spécifique
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

async function forcerSyncClient(email) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔄 SYNCHRONISATION FORCÉE DES MODULES CLIENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver le client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, email')
      .ilike('email', `%${email}%`)
      .limit(1);
    
    if (!clients || clients.length === 0) {
      throw new Error(`Client non trouvé: ${email}`);
    }
    
    const clientId = clients[0].id;
    console.log(`✅ Client trouvé: ${clientId} (${clients[0].email})\n`);
    
    // 2. Trouver l'espace membre
    const { data: espace } = await supabase
      .from('espaces_membres_clients')
      .select('id, user_id, client_id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!espace) {
      throw new Error('Espace membre non trouvé');
    }
    
    console.log(`✅ Espace membre trouvé: ${espace.id}\n`);
    
    // 3. Trouver l'abonnement actif
    const { data: abonnement } = await supabase
      .from('abonnements')
      .select('plan_id')
      .eq('client_id', espace.user_id)
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!abonnement || !abonnement.plan_id) {
      throw new Error('Abonnement actif non trouvé');
    }
    
    console.log(`✅ Abonnement actif trouvé, Plan ID: ${abonnement.plan_id}\n`);
    
    // 4. Vérifier les modules du plan
    const { data: planModules } = await supabase
      .from('plan_modules')
      .select('module_code, module_nom')
      .eq('plan_id', abonnement.plan_id)
      .eq('activer', true);
    
    console.log(`✅ ${planModules?.length || 0} module(s) dans le plan\n`);
    
    // 5. Forcer la synchronisation avec l'espace_id
    console.log('🔄 Synchronisation en cours...\n');
    
    const { data: syncResult, error: syncError } = await supabase.rpc('sync_client_modules_from_plan', {
      p_espace_id: espace.id
    });
    
    if (syncError) {
      throw new Error(`Erreur synchronisation: ${syncError.message}`);
    }
    
    if (syncResult?.success !== true) {
      throw new Error(`Échec synchronisation: ${syncResult?.error || 'Erreur inconnue'}`);
    }
    
    console.log(`✅ Synchronisation réussie !\n`);
    console.log(`   → Modules synchronisés: ${syncResult.modules_count || 'N/A'}\n`);
    
    // 6. Vérifier le résultat
    const { data: espaceAfter } = await supabase
      .from('espaces_membres_clients')
      .select('modules_actifs')
      .eq('id', espace.id)
      .single();
    
    if (espaceAfter?.modules_actifs) {
      const modulesCount = Object.keys(espaceAfter.modules_actifs).length;
      const modulesActifs = Object.keys(espaceAfter.modules_actifs).filter(
        k => espaceAfter.modules_actifs[k] === true
      );
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  📊 RÉSULTAT FINAL');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`   ✅ Total modules dans modules_actifs: ${modulesCount}`);
      console.log(`   ✅ Modules actifs: ${modulesActifs.length}\n`);
      console.log(`   Modules:`);
      modulesActifs.slice(0, 10).forEach(m => {
        console.log(`      → ${m}`);
      });
      if (modulesActifs.length > 10) {
        console.log(`      ... et ${modulesActifs.length - 10} autre(s)`);
      }
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ SYNCHRONISATION TERMINÉE AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERREUR lors de la synchronisation:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    return false;
  }
}

const email = process.argv[2] || 'groupemclem@gmail.com';

forcerSyncClient(email).then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

