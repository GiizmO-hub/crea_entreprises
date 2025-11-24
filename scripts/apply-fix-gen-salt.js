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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ERREUR: SUPABASE_DB_URL ou DATABASE_URL non trouvé dans .env');
  console.error('   Ajoutez SUPABASE_DB_URL=postgresql://... dans votre .env');
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

