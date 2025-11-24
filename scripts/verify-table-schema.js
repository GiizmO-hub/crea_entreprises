#!/usr/bin/env node

/**
 * Script pour vérifier le schéma de la table espaces_membres_clients
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

let dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (supabaseUrl && dbPassword) {
    try {
      const url = new URL(supabaseUrl);
      const projectId = url.hostname.replace('.supabase.co', '');
      dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
    } catch (e) {
      console.error('❌ Erreur:', e.message);
      process.exit(1);
    }
  }
}

if (!dbUrl) {
  console.error('❌ Impossible de construire l\'URL DB');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function verifySchema() {
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Récupérer toutes les colonnes de espaces_membres_clients
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'espaces_membres_clients'
      ORDER BY ordinal_position;
    `);

    console.log('📋 COLONNES DE espaces_membres_clients:');
    console.log('─'.repeat(80));
    
    const requiredColumns = ['statut_compte', 'configuration_validee', 'email', 'abonnement_id'];
    const foundColumns = rows.map(r => r.column_name);
    
    for (const row of rows) {
      const isRequired = requiredColumns.includes(row.column_name);
      const marker = isRequired ? '✅' : '  ';
      console.log(`${marker} ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
    }

    console.log('\n📊 VÉRIFICATION DES COLONNES REQUISES:');
    for (const col of requiredColumns) {
      if (foundColumns.includes(col)) {
        console.log(`   ✅ ${col} existe`);
      } else {
        console.log(`   ❌ ${col} MANQUANTE`);
      }
    }

    // Vérifier les contraintes
    const { rows: constraints } = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'espaces_membres_clients'
      AND constraint_type = 'CHECK';
    `);

    console.log('\n🔒 CONTRAINTES CHECK:');
    for (const constraint of constraints) {
      console.log(`   - ${constraint.constraint_name}`);
    }

    console.log('\n✅✅✅ VÉRIFICATION TERMINÉE!');
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema();

