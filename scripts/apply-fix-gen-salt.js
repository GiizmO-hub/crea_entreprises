#!/usr/bin/env node

/**
 * Script pour appliquer IMMÉDIATEMENT le fix gen_salt
 * 
 * Usage:
 *   node scripts/apply-fix-gen-salt.js
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

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

// Essayer plusieurs façons de construire l'URL de connexion
let dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Si pas d'URL directe, essayer de la construire depuis les variables Supabase
if (!dbUrl) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (supabaseUrl && dbPassword) {
    try {
      // URL Supabase: https://xxxxx.supabase.co
      const url = new URL(supabaseUrl);
      const projectId = url.hostname.replace('.supabase.co', '');
      
      if (projectId) {
        console.log('✅ Construction de l\'URL PostgreSQL depuis VITE_SUPABASE_URL');
        dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
      }
    } catch (e) {
      console.error('❌ Erreur parsing URL Supabase:', e.message);
    }
  }
}

if (!dbUrl) {
  console.error('❌ ERREUR: Impossible de construire l\'URL de connexion DB');
  console.error('');
  console.error('   Variables nécessaires dans .env:');
  console.error('   - VITE_SUPABASE_URL (ou SUPABASE_URL)');
  console.error('   - SUPABASE_DB_PASSWORD (ou DB_PASSWORD)');
  console.error('');
  console.error('   OU');
  console.error('');
  console.error('   - SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres');
  console.error('');
  console.error('   Option alternative:');
  console.error('   Appliquer manuellement via Supabase Dashboard > SQL Editor');
  console.error('   Fichier: supabase/migrations/20250122000091_fix_all_gen_salt_functions.sql');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function applyFix() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté');

    // Lire la migration
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250122000091_fix_all_gen_salt_functions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📝 Application de la migration...');
    await client.query(migrationSQL);
    
    console.log('✅ MIGRATION APPLIQUÉE AVEC SUCCÈS!');
    console.log('');
    console.log('🎯 L\'erreur "function gen_salt(unknown) does not exist" est maintenant corrigée!');
    console.log('   Testez maintenant la création d\'espace membre dans l\'application.');
    
  } catch (error) {
    console.error('❌ ERREUR lors de l\'application:', error.message);
    if (error.message.includes('already exists')) {
      console.log('⚠️  L\'extension pgcrypto existe déjà, c\'est normal.');
      console.log('   La fonction devrait quand même être mise à jour.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyFix();

