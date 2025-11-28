#!/usr/bin/env node

/**
 * Script pour appliquer la migration de correction RLS
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, DB_PASSWORD;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_DB_PASSWORD') {
        DB_PASSWORD = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
DB_PASSWORD = DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000040_fix_entreprises_rls_policies.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function applyMigration() {
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Application de la correction RLS pour entreprises...\n');
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    console.log('⏳ Application de la migration...\n');
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');
    
    // Vérifier que les politiques sont bien créées
    const policies = await client.query(`
      SELECT policyname, cmd 
      FROM pg_policies 
      WHERE tablename = 'entreprises'
      ORDER BY cmd, policyname
    `);

    console.log(`📊 Politiques RLS créées: ${policies.rows.length}\n`);
    policies.rows.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.policyname} (${p.cmd})`);
    });

    console.log('\n✅ Les entreprises devraient maintenant s\'afficher dans l\'application !');
    console.log('💡 Rafraîchissez la page dans votre navigateur.\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();


