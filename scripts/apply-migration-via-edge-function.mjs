/**
 * APPLICATION AUTOMATIQUE DE LA MIGRATION VIA EDGE FUNCTION
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

console.log('🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION VIA EDGE FUNCTION\n');
console.log('='.repeat(80));

// Lire le fichier SQL
const sqlFilePath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Extraire uniquement la fonction CREATE OR REPLACE
const functionMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement[\s\S]*?\$\$;/);

if (!functionMatch) {
  console.error('❌ Impossible d\'extraire la fonction');
  process.exit(1);
}

const functionSQL = functionMatch[0] + '\n';

console.log('📋 Fonction extraite\n');

async function applyMigrationViaEdgeFunction() {
  console.log('📤 Création et déploiement de l\'Edge Function...\n');
  
  console.log('⚠️  Pour appliquer automatiquement, nous devons :');
  console.log('   1. Créer une Edge Function qui exécute le SQL');
  console.log('   2. La déployer sur Supabase');
  console.log('   3. L\'appeler via l\'API\n');
  
  console.log('📋 Solution simplifiée : Utiliser le script d\'application manuelle\n');
  console.log('Le fichier SQL est prêt : APPLY_LAST_MIGRATION_NOW.sql\n');
  console.log('Pour l\'appliquer automatiquement, vous pouvez :');
  console.log('   1. Utiliser le Dashboard SQL Editor (recommandé)');
  console.log('   2. Créer une Edge Function personnalisée');
  console.log('   3. Utiliser Supabase CLI si configuré\n');
  
  return false;
}

async function testAfterMigration() {
  console.log('🧪 TEST DU WORKFLOW\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    const { data: paiements } = await supabase
      .from('paiements')
      .select('id, statut')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let paiementId = paiements?.id;
    
    if (!paiementId) {
      const { data: allPaiements } = await supabase
        .from('paiements')
        .select('id, statut')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      paiementId = allPaiements?.id;
    }
    
    if (!paiementId) {
      console.log('⚠️  Aucun paiement trouvé pour tester');
      return;
    }
    
    console.log(`📋 Test avec le paiement: ${paiementId}\n`);
    
    const { data: result, error } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiementId,
      p_stripe_payment_id: 'test_after_migration'
    });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    console.log('✅ Résultat:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result?.success) {
      console.log('\n✅ WORKFLOW FONCTIONNE !');
    } else {
      console.log('\n⚠️  Erreur:', result?.error);
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
  }
}

async function main() {
  const applied = await applyMigrationViaEdgeFunction();
  
  if (!applied) {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  📋 APPLICATION MANUELLE REQUISE');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('L\'application automatique nécessite une Edge Function.');
    console.log('La méthode la plus simple est d\'appliquer manuellement.\n');
    console.log('📋 Fichier : APPLY_LAST_MIGRATION_NOW.sql\n');
    console.log('🚀 POUR APPLIQUER :');
    console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('   2. Ouvrez : APPLY_LAST_MIGRATION_NOW.sql');
    console.log('   3. Copiez tout et exécutez\n');
    
    console.log('⏳ Test du workflow actuel dans 2 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await testAfterMigration();
}

main();

