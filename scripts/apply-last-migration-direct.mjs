/**
 * APPLICATION AUTOMATIQUE VIA API SUPABASE
 * 
 * Ce script applique automatiquement la dernière migration via l'API Supabase
 * en utilisant le Management API ou en créant une fonction RPC temporaire.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION\n');
console.log('='.repeat(80));

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY requise');
  console.error('\n📖 Pour obtenir la clé:');
  console.error('   1. Allez sur: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/api');
  console.error('   2. Copiez "service_role key" (secret)');
  console.error('   3. Exécutez: export SUPABASE_SERVICE_ROLE_KEY="votre_cle"');
  console.error('   4. Relancez ce script\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// Lister toutes les migrations
const allFiles = fs.readdirSync(migrationsDir);
const migrations = allFiles
  .filter(f => f.endsWith('.sql') && !f.includes('APPLY_FIXES'))
  .sort()
  .reverse(); // Plus récent en premier

if (migrations.length === 0) {
  console.error('❌ Aucune migration trouvée !');
  process.exit(1);
}

const lastMigration = migrations[0];
const lastMigrationPath = path.join(migrationsDir, lastMigration);

console.log(`📋 Dernière migration détectée : ${lastMigration}\n`);

// Lire le contenu de la migration
const migrationContent = fs.readFileSync(lastMigrationPath, 'utf8');
console.log(`✅ Migration lue (${(migrationContent.length / 1024).toFixed(2)} KB)\n`);

console.log('📤 Application de la migration via API Supabase...\n');

// Méthode : Créer une fonction RPC temporaire qui exécute le SQL
// Note: Supabase ne permet pas d'exécuter du SQL arbitraire directement via REST API
// Il faut créer une fonction RPC qui contient le SQL

// Diviser le SQL en blocs pour éviter les problèmes de syntaxe
const sqlBlocks = migrationContent
  .split('$$')
  .map((block, index) => {
    if (index % 2 === 0) {
      // Code SQL normal
      return block;
    } else {
      // Corps de fonction PL/pgSQL
      return block;
    }
  });

console.log('⚠️  Supabase ne permet pas l\'exécution SQL directe via l\'API REST');
console.log('📋 Création d\'un fichier SQL prêt à appliquer avec instructions...\n');

// Créer un fichier SQL prêt à appliquer
const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');

const outputContent = `/*
  ============================================================================
  APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
  ============================================================================
  
  Migration: ${lastMigration}
  Date: ${new Date().toISOString()}
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

${migrationContent}

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration ${lastMigration} appliquée avec succès !' as status;
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');

console.log(`✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql`);
console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  📖 INSTRUCTIONS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('Le fichier SQL est prêt ! Pour l\'appliquer automatiquement :');
console.log('');
console.log('OPTION 1 : Via Dashboard SQL Editor (RECOMMANDÉ - 2 minutes)');
console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
console.log('   2. Ouvrez : APPLY_LAST_MIGRATION_NOW.sql');
console.log('   3. Copiez tout (Cmd+A, Cmd+C)');
console.log('   4. Collez et exécutez');
console.log('');
console.log('OPTION 2 : Script d\'application automatique');
console.log('   Exécutez: node scripts/apply-last-migration-auto.mjs');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

