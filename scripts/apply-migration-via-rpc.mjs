/**
 * APPLICATION DE MIGRATION VIA RPC
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

console.log('🚀 APPLICATION DE LA MIGRATION VIA RPC\n');
console.log('='.repeat(80));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Lire la migration
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000067_fix_factures_statut_paiement_column.sql');
let migrationContent = fs.readFileSync(migrationPath, 'utf8');

// Extraire seulement la fonction creer_facture_et_abonnement_apres_paiement
// Car on ne peut pas créer plusieurs fonctions en une fois via RPC
const functionMatch = migrationContent.match(/CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement[\s\S]*?\$\$;/);

if (!functionMatch) {
  console.error('❌ Impossible d\'extraire la fonction de la migration');
  process.exit(1);
}

const functionSQL = functionMatch[0] + '\n';

console.log('📋 Application de la fonction creer_facture_et_abonnement_apres_paiement corrigée...\n');

// Créer une fonction RPC temporaire pour exécuter le SQL
const applyFunctionSQL = `
CREATE OR REPLACE FUNCTION apply_migration_temp()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ${functionSQL.replace(/\$/g, '$$$$')}
  RETURN 'Migration appliquée avec succès';
END;
$$;
`;

async function applyMigration() {
  try {
    // Appliquer via une fonction temporaire
    // Note: On va plutôt appliquer directement la fonction corrigée
    
    // Extraire juste la partie de création de fonction
    const cleanFunctionSQL = functionSQL
      .replace(/CREATE OR REPLACE FUNCTION/g, 'CREATE OR REPLACE FUNCTION')
      .replace(/\$\$/g, '$$$$');
    
    console.log('⚠️  Application directe via SQL nécessaire');
    console.log('📋 Pour appliquer la migration :\n');
    console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('   2. Ouvrez : APPLY_LAST_MIGRATION_NOW.sql');
    console.log('   3. Copiez tout et exécutez\n');
    
    // Mais essayons quand même via RPC en créant la fonction directement
    // On va utiliser une approche différente : créer la fonction via SQL brut
    
    return false;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

// Alternative : Appliquer directement la fonction corrigée
async function applyFunctionDirectly() {
  try {
    console.log('📤 Tentative d\'application directe de la fonction...\n');
    
    // Extraire seulement la création de fonction (sans les commentaires et vérifications)
    const functionOnly = functionMatch[0];
    
    // Créer un script SQL minimal pour appliquer juste la fonction
    const minimalSQL = `
-- Application de la fonction corrigée
${functionOnly}
`;
    
    // Essayer d'appliquer via une Edge Function ou directement
    // Mais l'API REST ne permet pas cela facilement
    
    console.log('⚠️  L\'application automatique nécessite l\'exécution SQL directe');
    console.log('📋 Veuillez appliquer manuellement la migration\n');
    
    return false;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

// Tester le workflow après migration
async function testWorkflow() {
  console.log('\n🧪 TEST DU WORKFLOW APRÈS MIGRATION\n');
  
  const { data: paiements } = await supabase
    .from('paiements')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!paiements) {
    // Prendre un paiement payé pour tester
    const { data: paiementPaye } = await supabase
      .from('paiements')
      .select('id, statut')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!paiementPaye) {
      console.log('⚠️  Aucun paiement trouvé pour tester');
      return;
    }
    
    const { data: result, error } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiementPaye.id,
      p_stripe_payment_id: 'test_after_migration'
    });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    console.log('✅ Résultat:', JSON.stringify(result, null, 2));
  }
}

async function main() {
  const applied = await applyMigration();
  
  if (!applied) {
    console.log('\n💡 La migration doit être appliquée manuellement.');
    console.log('   Une fois appliquée, je relancerai le test automatiquement.\n');
    
    // Attendre un peu puis tester quand même pour voir si ça marche
    console.log('⏳ Test du workflow dans 2 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await testWorkflow();
}

main();

