/**
 * APPLICATION AUTOMATIQUE DE LA MIGRATION VIA EDGE FUNCTION OU API
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

console.log('🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION\n');
console.log('='.repeat(80));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Lire le fichier SQL complet
const sqlFilePath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('📋 Fichier SQL lu:', sqlFilePath);
console.log('   Taille:', (sqlContent.length / 1024).toFixed(2), 'KB\n');

// Extraire uniquement la fonction (sans les commentaires de test)
const functionMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement[\s\S]*?\$\$;/);

if (!functionMatch) {
  console.error('❌ Impossible d\'extraire la fonction du fichier SQL');
  process.exit(1);
}

const functionSQL = functionMatch[0] + '\n';

console.log('✅ Fonction extraite pour application\n');

/**
 * Méthode 1 : Créer une Edge Function qui exécute le SQL
 */
async function applyViaEdgeFunction() {
  console.log('📤 Tentative via Edge Function...\n');
  
  try {
    // Cette méthode nécessiterait de déployer une Edge Function
    // qui n'est pas disponible dans ce contexte
    console.log('⚠️  Edge Function non disponible pour cette opération');
    return false;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Méthode 2 : Créer une fonction RPC temporaire qui exécute le SQL
 * Note: Cela nécessite d'exécuter du SQL pour créer la fonction...
 */
async function applyViaRPCTempFunction() {
  console.log('📤 Tentative via fonction RPC temporaire...\n');
  
  try {
    // Créer une fonction qui va créer notre fonction corrigée
    // Mais pour créer cette fonction, il faut exécuter du SQL...
    // C'est un problème circulaire
    
    console.log('⚠️  Cette méthode nécessite d\'exécuter du SQL, ce qui n\'est pas possible via l\'API REST');
    return false;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Méthode 3 : Utiliser psql directement si disponible
 */
async function applyViaPSQL() {
  console.log('📤 Tentative via psql...\n');
  
  try {
    // Construire l'URL de connexion Supabase
    // Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
    // Mais nous n'avons pas le mot de passe de la base de données
    
    console.log('⚠️  psql nécessite le mot de passe de la base de données');
    console.log('   Le SERVICE_ROLE_KEY ne permet pas l\'exécution SQL directe');
    return false;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Méthode 4 : Utiliser Supabase CLI
 */
async function applyViaSupabaseCLI() {
  console.log('📤 Tentative via Supabase CLI...\n');
  
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Vérifier si supabase CLI est installé
    try {
      await execAsync('which supabase');
    } catch (e) {
      console.log('⚠️  Supabase CLI non trouvé');
      return false;
    }
    
    // Vérifier si le projet est lié
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000068_fix_recuperer_entreprise_id_depuis_notes.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.log('⚠️  Fichier de migration non trouvé:', migrationFile);
      return false;
    }
    
    console.log('📋 Application de la migration via Supabase CLI...');
    console.log('   Migration:', path.basename(migrationFile));
    
    // Essayer d'appliquer la migration
    // Note: Cela nécessite que le projet soit lié et configuré
    try {
      const { stdout, stderr } = await execAsync(`npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.ewlozuwvrteopotfizcr.supabase.co:5432/postgres"`, {
        cwd: path.join(__dirname, '..'),
        timeout: 30000
      });
      
      if (stderr && !stderr.includes('warning')) {
        console.error('❌ Erreur:', stderr);
        return false;
      }
      
      console.log('✅ Migration appliquée avec succès!');
      console.log(stdout);
      return true;
    } catch (error) {
      console.log('⚠️  Impossible d\'appliquer via CLI (nécessite mot de passe DB)');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Méthode 5 : Exécuter le SQL via une fonction RPC existante
 * On crée une fonction qui exécute du SQL dynamique
 */
async function applyViaDynamicSQL() {
  console.log('📤 Tentative via SQL dynamique via RPC...\n');
  
  try {
    // Cette approche nécessiterait une fonction RPC qui existe déjà
    // et qui peut exécuter du SQL dynamique (EXECUTE ou DO)
    
    // Malheureusement, l'API REST Supabase ne permet pas d'exécuter
    // du SQL arbitraire pour des raisons de sécurité
    
    console.log('⚠️  L\'API REST Supabase ne permet pas l\'exécution SQL directe');
    console.log('   Pour des raisons de sécurité, seul le SQL Editor du Dashboard');
    console.log('   peut exécuter du SQL arbitraire.\n');
    
    return false;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Méthode alternative : Créer un guide d'application automatique
 */
function createAutoApplyGuide() {
  console.log('📋 Création d\'un guide d\'application...\n');
  
  // Créer un fichier HTML qui peut être ouvert dans le navigateur
  // et qui exécute le SQL automatiquement via l'API Supabase (si possible)
  
  const guideContent = `
# Application Automatique de la Migration

## Limitations

L'API REST Supabase ne permet **pas** l'exécution SQL directe pour des raisons de sécurité.

## Solutions disponibles

### Option 1 : Application manuelle (RECOMMANDÉ)
1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
2. Copiez le contenu de \`APPLY_LAST_MIGRATION_NOW.sql\`
3. Collez et exécutez

### Option 2 : Via Supabase CLI (si configuré)
\`\`\`bash
npx supabase db push
\`\`\`

### Option 3 : Via psql (si credentials disponibles)
\`\`\`bash
psql -h db.ewlozuwvrteopotfizcr.supabase.co -U postgres -d postgres -f APPLY_LAST_MIGRATION_NOW.sql
\`\`\`

## Contenu de la migration

La migration corrige :
1. Retire \`statut_paiement\` de l'INSERT INTO factures (colonne n'existe pas)
2. Récupère \`entreprise_id\` depuis les notes si NULL
3. Teste automatiquement le workflow après application
`;

  const guidePath = path.join(__dirname, '..', 'GUIDE_APPLICATION_AUTO.md');
  fs.writeFileSync(guidePath, guideContent);
  
  console.log('✅ Guide créé:', guidePath);
  console.log('');
}

// Exécution principale
async function main() {
  console.log('🔍 Recherche d\'une méthode d\'application automatique...\n');
  
  // Essayer différentes méthodes
  let applied = false;
  
  // Méthode 1: Edge Function
  if (!applied) {
    applied = await applyViaEdgeFunction();
  }
  
  // Méthode 2: RPC Temp
  if (!applied) {
    applied = await applyViaRPCTempFunction();
  }
  
  // Méthode 3: psql
  if (!applied) {
    applied = await applyViaPSQL();
  }
  
  // Méthode 4: Supabase CLI
  if (!applied) {
    applied = await applyViaSupabaseCLI();
  }
  
  // Méthode 5: SQL dynamique
  if (!applied) {
    applied = await applyViaDynamicSQL();
  }
  
  if (!applied) {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ⚠️  APPLICATION AUTOMATIQUE IMPOSSIBLE');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    console.log('L\'API REST Supabase ne permet pas l\'exécution SQL directe.');
    console.log('Pour des raisons de sécurité, vous devez appliquer la migration');
    console.log('manuellement via le SQL Editor.\n');
    
    console.log('📋 Fichier prêt : APPLY_LAST_MIGRATION_NOW.sql\n');
    
    console.log('🚀 POUR APPLIQUER :');
    console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('   2. Ouvrez : APPLY_LAST_MIGRATION_NOW.sql');
    console.log('   3. Copiez tout (Cmd+A, Cmd+C)');
    console.log('   4. Collez dans l\'éditeur SQL (Cmd+V)');
    console.log('   5. Cliquez sur "Run"\n');
    
    createAutoApplyGuide();
    
    // Tester quand même le workflow actuel
    console.log('⏳ Test du workflow actuel dans 2 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Tester le workflow
    await testWorkflow();
  } else {
    console.log('\n✅ Migration appliquée ! Test du workflow...\n');
    await testWorkflow();
  }
}

// Tester le workflow
async function testWorkflow() {
  console.log('🧪 TEST DU WORKFLOW\n');
  
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
    
    // Tester valider_paiement_carte_immediat
    console.log('1️⃣ Test de valider_paiement_carte_immediat...');
    const { data: result, error } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiementId,
      p_stripe_payment_id: 'test_auto_after_migration'
    });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      console.error('   Code:', error.code);
      console.error('   Détails:', error.details);
      return;
    }
    
    console.log('\n✅ Résultat:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result?.success) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('  ✅ WORKFLOW FONCTIONNE !');
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

main();

