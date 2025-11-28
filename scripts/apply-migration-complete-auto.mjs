#!/usr/bin/env node

/**
 * APPLICATION AUTOMATIQUE COMPLÈTE VIA POSTGRESQL DIRECT
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'oigfYelQfUZHHTnU';
const PROJECT_REF = 'ewlozuwvrteopotfizcr';

async function applyViaPsqlDirect() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🚀 APPLICATION AUTOMATIQUE VIA POSTGRESQL');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Vérifier si psql est disponible via Homebrew ou autre
  let psqlCommand = 'psql';
  
  try {
    await execAsync('which psql');
  } catch {
    // Essayer d'installer via Homebrew
    console.log('📦 Installation de PostgreSQL (psql)...\n');
    try {
      await execAsync('brew install postgresql@15');
      psqlCommand = '/opt/homebrew/opt/postgresql@15/bin/psql';
      console.log('✅ PostgreSQL installé\n');
    } catch {
      console.log('⚠️  Installation automatique échouée\n');
      console.log('💡 Installez manuellement: brew install postgresql\n');
      return false;
    }
  }
  
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  console.log(`📄 Fichier SQL: ${sqlFile}\n`);
  
  // Connection string encodée
  const passwordEncoded = encodeURIComponent(DB_PASSWORD);
  const connectionString = `postgresql://postgres.${PROJECT_REF}:${passwordEncoded}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;
  
  console.log('🔌 Connexion à PostgreSQL...\n');
  
  try {
    // Exécuter via psql
    const command = `PGPASSWORD="${DB_PASSWORD}" ${psqlCommand} -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.${PROJECT_REF} -d postgres -f "${sqlFile}" 2>&1`;
    
    console.log('📤 Exécution de la migration...\n');
    
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: DB_PASSWORD
      },
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    if (stdout) {
      // Filtrer les NOTICE qui sont normaux
      const lines = stdout.split('\n').filter(l => 
        !l.includes('NOTICE') || l.includes('✅') || l.includes('❌') || l.includes('📋')
      );
      if (lines.length > 0) {
        console.log(lines.join('\n'));
      }
    }
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.log(stderr);
    }
    
    console.log('\n✅ Migration appliquée !\n');
    
    // Vérification
    const checkCommand = `PGPASSWORD="${DB_PASSWORD}" ${psqlCommand} -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.${PROJECT_REF} -d postgres -c "SELECT COUNT(*) as count FROM plans_abonnement WHERE actif = true;" 2>&1`;
    const { stdout: checkOutput } = await execAsync(checkCommand, {
      env: { ...process.env, PGPASSWORD: DB_PASSWORD }
    });
    
    console.log('🔍 Vérification des plans...');
    console.log(checkOutput);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.message.includes('command not found') || error.message.includes('psql')) {
      console.log('\n💡 Utilisez le Dashboard Supabase:');
      console.log('   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
    }
    
    return false;
  }
}

async function main() {
  const success = await applyViaPsqlDirect();
  
  if (!success) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📋 SOLUTION ALTERNATIVE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Utilisez le Dashboard Supabase (2 minutes):');
    console.log('→ https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  }
}

main();
