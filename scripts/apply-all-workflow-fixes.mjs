#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL doit être configuré');
  process.exit(1);
}

async function applyMigration(fileName) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const migrationFilePath = join(projectRoot, 'supabase', 'migrations', fileName);
    const sqlContent = readFileSync(migrationFilePath, 'utf-8');
    let cleanSQL = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    await client.query(cleanSQL);
    console.log(`   ✅ ${fileName}`);
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('déjà')) {
      console.log(`   ⚠️  ${fileName} - Déjà appliquée (normal)`);
    } else {
      console.error(`   ❌ ${fileName} - Erreur:`, error.message);
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function applyAllFixes() {
  console.log('🚀 APPLICATION DE TOUTES LES CORRECTIONS DU WORKFLOW\n');

  const migrations = [
    '20250131000008_fix_final_workflow_complete.sql',
    '20250131000009_fix_meddecyril_admin_status.sql',
  ];

  for (const migration of migrations) {
    await applyMigration(migration);
  }

  console.log('\n✅ TOUTES LES CORRECTIONS APPLIQUÉES !');
}

applyAllFixes().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

