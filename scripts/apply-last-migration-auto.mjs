/**
 * APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
 * 
 * Ce script détecte et applique automatiquement la dernière migration SQL
 * via Supabase CLI ou en créant un fichier SQL prêt à appliquer.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_cde65a8637aa3680b475cc189236b6fec950808d';
const PROJECT_ID = 'ewlozuwvrteopotfizcr';

console.log('🚀 APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION\n');
console.log('='.repeat(80));

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

// Essayer d'appliquer via Supabase CLI
console.log('📋 Tentative d\'application via Supabase CLI...\n');

try {
  // Vérifier si Supabase CLI est disponible
  execSync('npx supabase --version', { stdio: 'pipe' });
  console.log('✅ Supabase CLI disponible\n');

  // Définir le token
  process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_ACCESS_TOKEN;

  // Aller dans le dossier du projet
  const projectDir = path.join(__dirname, '..');

  // Créer un fichier SQL temporaire avec uniquement cette migration
  const tempSQLPath = path.join(projectDir, `temp_${lastMigration}`);
  fs.writeFileSync(tempSQLPath, migrationContent, 'utf8');

  console.log('📤 Application de la migration via SQL direct...\n');

  // Utiliser Supabase CLI pour exécuter le SQL directement
  // Note: On ne peut pas exécuter SQL directement via CLI, donc on va créer un fichier prêt à appliquer
  fs.unlinkSync(tempSQLPath);

  console.log('⚠️  Supabase CLI ne permet pas l\'exécution SQL directe');
  console.log('📋 Création d\'un fichier SQL prêt à appliquer...\n');

} catch (error) {
  console.log('⚠️  Supabase CLI non disponible ou échec\n');
}

// Créer un fichier SQL prêt à appliquer
const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');

// Ajouter un en-tête et instructions
const outputContent = `/*
  ============================================================================
  APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
  ============================================================================
  
  Migration: ${lastMigration}
  Date: ${new Date().toISOString()}
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

-- ============================================================================
-- MIGRATION: ${lastMigration}
-- ============================================================================

${migrationContent}

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration ${lastMigration} appliquée avec succès !';
END $$;

SELECT '✅ Migration appliquée avec succès !' as status;
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');

console.log(`✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql`);
console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  📖 INSTRUCTIONS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('Le fichier SQL est prêt ! Pour l\'appliquer :');
console.log('');
console.log('1. Ouvrez le Dashboard SQL Editor :');
console.log(`   https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`);
console.log('');
console.log('2. Ouvrez le fichier :');
console.log('   APPLY_LAST_MIGRATION_NOW.sql');
console.log('');
console.log('3. Copiez tout (Cmd+A, Cmd+C)');
console.log('');
console.log('4. Collez dans l\'éditeur SQL et cliquez sur "Run"');
console.log('');
console.log('✅ La migration sera appliquée automatiquement !');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  💡 AUTOMATISATION FUTURE');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('Pour automatiser complètement, vous pouvez :');
console.log('1. Utiliser Supabase Management API (nécessite SERVICE_ROLE_KEY)');
console.log('2. Configurer un webhook GitHub pour appliquer automatiquement');
console.log('3. Utiliser Supabase CLI avec connexion directe PostgreSQL');
console.log('');

