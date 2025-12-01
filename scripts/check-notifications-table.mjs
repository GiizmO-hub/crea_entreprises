#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

async function checkTable() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté\n');

    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ La table notifications n\'existe pas\n');
      return;
    }

    console.log('✅ La table notifications existe\n');

    const columns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'notifications'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colonnes:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Vérifier si "read" existe
    const hasRead = columns.rows.some(r => r.column_name === 'read');
    console.log(hasRead ? '✅ Colonne "read" existe' : '❌ Colonne "read" n\'existe pas');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkTable().catch(console.error);

