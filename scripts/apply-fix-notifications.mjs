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
  console.error('❌ DATABASE_URL non configuré');
  process.exit(1);
}

async function applyMigration() {
  console.log('🚀 APPLICATION DE LA CORRECTION NOTIFICATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrationFile = join(projectRoot, 'supabase', 'migrations', '20250131000003_fix_notifications_structure.sql');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connexion...');
    await client.connect();
    console.log('✅ Connecté!\n');

    console.log('📄 Lecture de la migration...');
    const sqlContent = readFileSync(migrationFile, 'utf-8');
    console.log('✅ Migration lue\n');

    console.log('⚙️  Application...');
    await client.query(sqlContent);
    
    console.log('✅ Correction appliquée!\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Terminé !');
  }
}

applyMigration().catch(console.error);

