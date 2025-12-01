#!/usr/bin/env node

/**
 * Script pour appliquer la migration notifications automatiquement
 */

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

async function applyMigration() {
  console.log('🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION NOTIFICATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrationFile = join(projectRoot, 'supabase', 'migrations', '20250131000002_create_notifications.sql');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté!\n');

    console.log('📄 Lecture de la migration...');
    const sqlContent = readFileSync(migrationFile, 'utf-8');
    console.log('✅ Migration lue\n');

    let cleanSQL = sqlContent
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    console.log('⚙️  Application de la migration...');
    await client.query(cleanSQL);
    
    console.log('✅ Migration appliquée avec succès!\n');

    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Table notifications créée avec succès!\n');
    } else {
      console.log('⚠️  La table n\'a pas été trouvée après l\'application\n');
    }

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  La table ou certains objets existent déjà');
      console.log('   Cela signifie que la migration a peut-être déjà été appliquée\n');
    } else {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée\n');
    console.log('✅ Terminé !');
  }
}

applyMigration().catch(console.error);

