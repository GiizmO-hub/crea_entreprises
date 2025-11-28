#!/usr/bin/env node

/**
 * Application automatique via psql (connexion PostgreSQL directe)
 * Nécessite le mot de passe de la base de données
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const PROJECT_REF = 'ewlozuwvrteopotfizcr';

if (!DB_PASSWORD) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔐 MOT DE PASSE POSTGRESQL REQUIS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Pour appliquer automatiquement, j\'ai besoin du mot de passe DB.\n');
  console.log('📋 Comment le récupérer:');
  console.log('   1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/database');
  console.log('   2. Section "Connection string"');
  console.log('   3. Copiez le mot de passe (ou réinitialisez-le)\n');
  console.log('🔧 Ensuite, exécutez:');
  console.log('   export SUPABASE_DB_PASSWORD="votre_mot_de_passe"');
  console.log('   node scripts/apply-via-psql.mjs\n');
  process.exit(1);
}

async function applyViaPsql() {
  console.log('🚀 Application automatique via psql...\n');
  
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  const sqlContent = readFileSync(sqlFile, 'utf-8');
  
  // Connection string
  const connectionString = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
  
  try {
    console.log('📡 Connexion à la base de données...');
    
    // Écrire le SQL dans un fichier temporaire
    const tempFile = join(__dirname, '../temp_migration.sql');
    require('fs').writeFileSync(tempFile, sqlContent);
    
    // Exécuter via psql
    const { stdout, stderr } = await execAsync(`psql "${connectionString}" -f "${tempFile}"`);
    
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('NOTICE')) console.error(stderr);
    
    // Nettoyer
    require('fs').unlinkSync(tempFile);
    
    console.log('\n✅ Migration appliquée avec succès !\n');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.message.includes('command not found')) {
      console.log('\n⚠️  psql non trouvé. Installation:');
      console.log('   macOS: brew install postgresql');
      console.log('   Ou utilisez le Dashboard Supabase\n');
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  await applyViaPsql();
}

main();

