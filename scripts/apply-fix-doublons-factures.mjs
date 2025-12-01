#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non défini');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté\n');
    
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250131000014_fix_doublons_factures_abonnement.sql');
    console.log(`📄 Lecture: ${migrationPath}\n`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const cleanedSQL = migrationSQL
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n');
    
    console.log('🚀 Application de la migration...\n');
    await client.query(cleanedSQL);
    
    console.log('\n✅ Migration appliquée avec succès !');
    console.log('\n📊 Corrections effectuées :');
    console.log('   ✅ Fonction generate_invoice_for_entreprise corrigée pour éviter les doublons');
    console.log('   ✅ Vérification des factures existantes avant création');
    console.log('   ✅ Mise à jour de facture_id dans abonnements');
    
    await client.end();
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.detail) console.error(`   Détail: ${error.detail}`);
    process.exit(1);
  }
}

applyMigration().catch(console.error);

