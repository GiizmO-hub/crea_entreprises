#!/usr/bin/env node

/**
 * Script pour appliquer la migration fix_utilisateurs_role_and_abonnements_actif.sql
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

function getPostgresConnection() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('✅ URL PostgreSQL trouvée dans .env');
    return dbUrl;
  }

  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (dbHost && dbPassword) {
    console.log('✅ Informations PostgreSQL trouvées dans .env');
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectId && dbPassword) {
        console.log('✅ Construction de l\'URL PostgreSQL depuis VITE_SUPABASE_URL');
        return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
      }
    } catch (e) {
      // Ignorer
    }
  }

  console.error('❌ Informations de connexion PostgreSQL manquantes');
  process.exit(1);
}

async function applyMigration() {
  const connectionString = getPostgresConnection();
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connexion à PostgreSQL établie\n');
    
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250123000007_fix_utilisateurs_role_and_abonnements_actif.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔄 Application de la migration: 20250123000007_fix_utilisateurs_role_and_abonnements_actif\n');
    
    try {
      await client.query(sql);
      console.log('✅ Migration appliquée avec succès !\n');
      
    } catch (sqlError) {
      const errorMessage = sqlError.message.toLowerCase();
      
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('duplicate') ||
          errorMessage.includes('constraint already exists')) {
        console.log('ℹ️ Certains objets existent déjà (ignoré)');
      } else {
        throw sqlError;
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:');
    console.error(`   ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

