#!/usr/bin/env node

/**
 * Script pour appliquer la migration de synchronisation des modules
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL non défini dans .env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie');
    
    const migrationFile = join(__dirname, '..', 'supabase', 'migrations', '20250131000017_fix_modules_sync_all_espaces.sql');
    const sql = readFileSync(migrationFile, 'utf-8');
    
    // Nettoyer le SQL (supprimer les commentaires multi-lignes et les commentaires simples)
    const cleanedSQL = sql
      .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer les commentaires /* ... */
      .replace(/--.*$/gm, '') // Supprimer les commentaires -- ...
      .trim();
    
    console.log('📝 Application de la migration...');
    await client.query(cleanedSQL);
    
    console.log('✅ Migration appliquée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

