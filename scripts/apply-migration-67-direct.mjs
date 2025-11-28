/**
 * APPLICATION DIRECTE DE LA MIGRATION 67 VIA API
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

console.log('🚀 APPLICATION DIRECTE DE LA MIGRATION 67\n');
console.log('='.repeat(80));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Lire la migration
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000067_fix_factures_statut_paiement_column.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

// Extraire la fonction corrigée
const functionMatch = migrationContent.match(/CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement[\s\S]*?\$\$;/);

if (!functionMatch) {
  console.error('❌ Impossible d\'extraire la fonction de la migration');
  process.exit(1);
}

const functionSQL = functionMatch[0] + '\n';

console.log('📋 Fonction extraite de la migration\n');

async function applyMigration() {
  try {
    // Utiliser la fonction rpc pour créer une fonction temporaire qui exécute le SQL
    // Mais d'abord, créer la fonction directement via un appel SQL
    
    // Note: L'API REST Supabase ne permet pas d'exécuter du SQL arbitraire
    // On va créer une fonction RPC qui va créer notre fonction corrigée
    
    console.log('⚠️  Application automatique via API impossible');
    console.log('📋 Veuillez appliquer la migration manuellement :\n');
    console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('   2. Ouvrez : APPLY_MIGRATION_67_AND_TEST.sql');
    console.log('   3. Copiez tout et exécutez\n');
    
    return false;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

async function testAfterMigration() {
  console.log('\n🧪 TEST DU WORKFLOW APRÈS MIGRATION\n');
  
  try {
    // Trouver un paiement en attente
    const { data: paiements, error: err } = await supabase
      .from('paiements')
      .select('id, statut')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
      .limit(1);
    
    let paiementId;
    
    if (err || !paiements || paiements.length === 0) {
      // Prendre n'importe quel paiement récent
      const { data: allPaiements } = await supabase
        .from('paiements')
        .select('id, statut')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!allPaiements) {
        console.log('⚠️  Aucun paiement trouvé pour tester');
        return;
      }
      
      paiementId = allPaiements.id;
      console.log(`📋 Test avec le paiement: ${paiementId} (statut: ${allPaiements.statut})\n`);
    } else {
      paiementId = paiements[0].id;
      console.log(`📋 Test avec le paiement: ${paiementId} (statut: en_attente)\n`);
    }
    
    // Tester get_paiement_info_for_stripe
    console.log('1️⃣ Test get_paiement_info_for_stripe...');
    const { data: info, error: infoError } = await supabase.rpc('get_paiement_info_for_stripe', {
      p_paiement_id: paiementId
    });
    
    if (infoError || !info?.success) {
      console.error('❌ Erreur get_paiement_info_for_stripe:', infoError?.message || info?.error);
      return;
    }
    
    console.log('✅ Plan ID:', info.plan_id || 'NON TROUVÉ');
    console.log('');
    
    // Tester valider_paiement_carte_immediat
    console.log('2️⃣ Test valider_paiement_carte_immediat...');
    const { data: result, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiementId,
      p_stripe_payment_id: 'test_after_migration_67'
    });
    
    if (validationError) {
      console.error('❌ Erreur validation:', validationError.message);
      console.error('   Code:', validationError.code);
      console.error('   Details:', validationError.details);
      return;
    }
    
    console.log('\n✅ Résultat:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result?.success) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('  ✅ WORKFLOW FONCTIONNE CORRECTEMENT !');
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log(`   → Facture ID: ${result.facture_id || 'N/A'}`);
      console.log(`   → Abonnement ID: ${result.abonnement_id || 'N/A'}`);
      console.log(`   → Espace membre ID: ${result.espace_membre_id || 'N/A'}`);
    } else {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('  ⚠️  ERREUR DÉTECTÉE');
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('Erreur:', result?.error || 'Erreur inconnue');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
  }
}

async function main() {
  await applyMigration();
  
  console.log('\n⏳ Lancement du test dans 3 secondes...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testAfterMigration();
}

main();

