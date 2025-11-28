/**
 * APPLICATION AUTOMATIQUE DES DERNIÈRES MIGRATIONS
 * 
 * Ce script applique automatiquement les dernières migrations nécessaires
 * pour que le workflow de paiement fonctionne à 100%.
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

console.log('🚀 APPLICATION AUTOMATIQUE DES DERNIÈRES MIGRATIONS\n');
console.log('='.repeat(80));
console.log(`📋 Project ID: ${PROJECT_ID}\n`);

// Migrations à appliquer (par ordre)
const migrations = [
  '20250123000062_fix_valider_paiement_carte_automatisation_complete.sql',
  '20250123000063_fix_webhook_logs_and_validation.sql'
];

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

console.log('📦 Vérification des migrations...\n');

// Vérifier que les migrations existent
const missingMigrations = [];
for (const migration of migrations) {
  const migrationPath = path.join(migrationsDir, migration);
  if (!fs.existsSync(migrationPath)) {
    missingMigrations.push(migration);
    console.error(`❌ Migration manquante: ${migration}`);
  } else {
    console.log(`✅ Migration trouvée: ${migration}`);
  }
}

if (missingMigrations.length > 0) {
  console.error('\n❌ Certaines migrations sont manquantes !');
  process.exit(1);
}

console.log(`\n✅ Toutes les migrations sont présentes (${migrations.length})\n`);

// Méthode 1 : Essayer avec Supabase CLI
console.log('📋 Tentative d\'application via Supabase CLI...\n');

try {
  // Vérifier si Supabase CLI est disponible
  execSync('npx supabase --version', { stdio: 'pipe' });
  console.log('✅ Supabase CLI disponible\n');

  // Définir le token d'accès
  process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_ACCESS_TOKEN;

  // Aller dans le dossier du projet
  const projectDir = path.join(__dirname, '..');

  // Essayer d'appliquer les migrations via db push
  console.log('📤 Application des migrations via db push...\n');
  
  try {
    const output = execSync(
      `cd "${projectDir}" && npx supabase db push --db-url "postgresql://postgres.${PROJECT_ID}:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"`,
      { 
        stdio: 'inherit',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN }
      }
    );
    console.log('\n✅ Migrations appliquées avec succès via CLI !\n');
  } catch (error) {
    console.log('\n⚠️  Échec via CLI (normal si pas de connexion directe)\n');
    throw error; // Passer à la méthode alternative
  }

} catch (error) {
  console.log('⚠️  Supabase CLI non disponible ou échec\n');
  console.log('📋 Passage à la méthode alternative : Création d\'un fichier SQL combiné\n');

  // Méthode 2 : Créer un fichier SQL combiné
  const combinedSQL = [];

  // En-tête
  combinedSQL.push('/*');
  combinedSQL.push('  ============================================================================');
  combinedSQL.push('  APPLICATION AUTOMATIQUE DES DERNIÈRES MIGRATIONS');
  combinedSQL.push('  ============================================================================');
  combinedSQL.push('');
  combinedSQL.push('  Ce fichier combine les migrations suivantes :');
  migrations.forEach(m => combinedSQL.push(`  - ${m}`));
  combinedSQL.push('');
  combinedSQL.push('  Instructions:');
  combinedSQL.push('    1. Copiez TOUT ce fichier');
  combinedSQL.push('    2. Ouvrez Supabase Dashboard > SQL Editor');
  combinedSQL.push('    3. Collez et exécutez');
  combinedSQL.push('  ============================================================================');
  combinedSQL.push('*/');
  combinedSQL.push('');

  // Lire et combiner les migrations
  for (const migration of migrations) {
    const migrationPath = path.join(migrationsDir, migration);
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    combinedSQL.push('');
    combinedSQL.push('-- ============================================================================');
    combinedSQL.push(`-- MIGRATION: ${migration}`);
    combinedSQL.push('-- ============================================================================');
    combinedSQL.push('');
    combinedSQL.push(migrationContent);
    combinedSQL.push('');
    combinedSQL.push('-- ============================================================================');
    combinedSQL.push(`-- FIN MIGRATION: ${migration}`);
    combinedSQL.push('-- ============================================================================');
    combinedSQL.push('');
  }

  // Footer
  combinedSQL.push('-- ============================================================================');
  combinedSQL.push('-- FIN DE L\'APPLICATION DES MIGRATIONS');
  combinedSQL.push('-- ============================================================================');
  combinedSQL.push('');
  combinedSQL.push('SELECT');
  combinedSQL.push('  \'✅ Migrations appliquées avec succès !\' as status,');
  combinedSQL.push(`  ${migrations.length} as migrations_appliquees;`);

  // Créer le fichier combiné
  const outputPath = path.join(__dirname, '..', 'APPLY_ALL_MIGRATIONS_NOW.sql');
  fs.writeFileSync(outputPath, combinedSQL.join('\n'), 'utf8');

  console.log(`✅ Fichier SQL combiné créé : APPLY_ALL_MIGRATIONS_NOW.sql`);
  console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  📖 PROCHAINES ÉTAPES');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Ouvrez le Dashboard SQL Editor :');
  console.log(`   https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`);
  console.log('');
  console.log('2. Ouvrez le fichier :');
  console.log('   APPLY_ALL_MIGRATIONS_NOW.sql');
  console.log('');
  console.log('3. Copiez tout (Cmd+A, Cmd+C)');
  console.log('');
  console.log('4. Collez dans l\'éditeur SQL et cliquez sur "Run"');
  console.log('');
  console.log('✅ Les migrations seront appliquées automatiquement !');
  console.log('');
}

