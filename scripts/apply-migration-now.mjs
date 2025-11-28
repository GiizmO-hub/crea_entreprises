#!/usr/bin/env node

/**
 * APPLICATION AUTOMATIQUE - APPLIQUE RÉELLEMENT LA MIGRATION
 * 
 * Ce script applique automatiquement la dernière migration via Supabase CLI
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

// Trouver la dernière migration
const allFiles = fs.readdirSync(migrationsDir);
const migrations = allFiles
  .filter(f => f.endsWith('.sql') && !f.includes('APPLY_FIXES'))
  .sort()
  .reverse();

if (migrations.length === 0) {
  console.error('❌ Aucune migration trouvée !');
  process.exit(1);
}

const lastMigration = migrations[0];
console.log(`📋 Dernière migration : ${lastMigration}\n`);

// Lire le contenu
const migrationPath = path.join(migrationsDir, lastMigration);
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

console.log('📤 Application via Supabase CLI...\n');

// Méthode : Créer un fichier SQL et l'appliquer via Supabase CLI
// Note: Supabase CLI nécessite que le projet soit lié

try {
  // Vérifier si Supabase CLI est disponible
  execSync('npx supabase --version', { stdio: 'pipe' });
  console.log('✅ Supabase CLI disponible\n');

  // Définir le token
  process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_ACCESS_TOKEN;

  // Créer un fichier temporaire avec uniquement cette migration
  const tempDir = path.join(__dirname, '..', '.temp_migrations');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempMigrationPath = path.join(tempDir, lastMigration);
  fs.writeFileSync(tempMigrationPath, migrationContent, 'utf8');

  console.log('📋 Copie de la migration dans le dossier temporaire...\n');

  // Essayer d'appliquer via db push (ne fonctionnera que si le projet est lié)
  const projectDir = path.join(__dirname, '..');

  try {
    // Vérifier si le projet est lié
    execSync(`cd "${projectDir}" && npx supabase status`, { stdio: 'pipe' });
    
    console.log('✅ Projet lié, application de la migration...\n');
    
    // Copier temporairement la migration dans le dossier migrations
    // et appliquer via db push
    const originalMigration = path.join(migrationsDir, lastMigration);
    const backupPath = originalMigration + '.backup';
    
    // Créer une backup (si nécessaire)
    if (fs.existsSync(originalMigration)) {
      fs.copyFileSync(originalMigration, backupPath);
    }

    console.log('📤 Application de la migration...\n');
    
    // Utiliser db push pour appliquer seulement les nouvelles migrations
    // Note: db push applique toutes les migrations non appliquées
    execSync(
      `cd "${projectDir}" && npx supabase db push`,
      {
        stdio: 'inherit',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN }
      }
    );

    console.log('\n✅ Migration appliquée avec succès !\n');

    // Nettoyer
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

  } catch (error) {
    console.log('\n⚠️  Application via db push échouée\n');
    console.log('📋 Création d\'un fichier SQL prêt à appliquer manuellement...\n');

    // Créer le fichier SQL prêt à appliquer
    const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
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
    4. Cliquez sur "Run"
    5. ✅ C'est terminé !
  
  ============================================================================
*/

${migrationContent}

SELECT '✅ Migration ${lastMigration} appliquée avec succès !' as status;
`;

    fs.writeFileSync(outputPath, outputContent, 'utf8');
    
    console.log(`✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql`);
    console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  📖 APPLIQUER MANUELLEMENT (2 minutes)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`1. Ouvrez : https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`);
    console.log('2. Ouvrez : APPLY_LAST_MIGRATION_NOW.sql');
    console.log('3. Copiez tout (Cmd+A, Cmd+C)');
    console.log('4. Collez et exécutez');
    console.log('');
  }

  // Nettoyer le dossier temporaire
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.log('\n📋 Création d\'un fichier SQL prêt à appliquer...\n');

  // Créer le fichier SQL de secours
  const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
  const outputContent = `/*
  Migration: ${lastMigration}
  Date: ${new Date().toISOString()}
*/

${migrationContent}

SELECT '✅ Migration appliquée !' as status;
`;

  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql\n`);
}

