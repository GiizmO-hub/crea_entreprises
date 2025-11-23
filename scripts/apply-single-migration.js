#!/usr/bin/env node

/**
 * Script pour appliquer une migration SQL spécifique à Supabase
 * 
 * Usage:
 *   node scripts/apply-single-migration.js <nom-du-fichier-migration>
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extraire les informations de connexion PostgreSQL depuis l'URL Supabase
function getPostgresConnection() {
  // Essayer d'utiliser SUPABASE_DB_URL si fourni directement
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('✅ URL PostgreSQL trouvée dans .env');
    return dbUrl;
  }

  // Sinon, essayer de construire depuis les variables individuelles
  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (dbHost && dbPassword) {
    console.log('✅ Informations PostgreSQL trouvées dans .env');
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  // Si on a VITE_SUPABASE_URL, essayer d'extraire le projet ID
  if (supabaseUrl) {
    try {
      // URL Supabase: https://xxxxx.supabase.co
      const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      if (projectId && dbPassword) {
        console.log('✅ Construction de l\'URL PostgreSQL depuis VITE_SUPABASE_URL');
        return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
      }
    } catch (e) {
      // Ignorer les erreurs
    }
  }

  console.error('❌ Informations de connexion PostgreSQL manquantes\n');
  console.error('Ajoutez dans votre fichier .env l\'une des options suivantes:\n');
  console.error('Option 1 (recommandé - URL complète):');
  console.error('  SUPABASE_DB_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres\n');
  console.error('Option 2 (variables individuelles):');
  console.error('  SUPABASE_DB_HOST=db.xxxxx.supabase.co');
  console.error('  SUPABASE_DB_PORT=5432');
  console.error('  SUPABASE_DB_NAME=postgres');
  console.error('  SUPABASE_DB_USER=postgres');
  console.error('  SUPABASE_DB_PASSWORD=[password]\n');
  console.error('Option 3 (si vous avez VITE_SUPABASE_URL):');
  console.error('  SUPABASE_DB_PASSWORD=[password]');
  console.error('  (Le script construira automatiquement l\'URL)\n');
  process.exit(1);
}

async function applyMigration(migrationFile) {
  const dbUrl = getPostgresConnection();
  if (!dbUrl) return;

  const migrationPath = join(projectRoot, 'supabase', 'migrations', migrationFile);
  
  console.log(`\n📄 Lecture de la migration: ${migrationFile}`);
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du fichier: ${migrationPath}`);
    console.error(error.message);
    process.exit(1);
  }

  if (!sql || sql.trim().length === 0) {
    console.error('❌ Le fichier de migration est vide');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');

    console.log(`\n🔄 Application de la migration: ${migrationFile}`);
    await client.query(sql);
    console.log('✅ Migration appliquée avec succès!');

  } catch (error) {
    console.error(`\n❌ Erreur lors de l'application de la migration:`);
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Détail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Indice: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

// Récupérer le nom du fichier de migration depuis les arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node scripts/apply-single-migration.js <nom-du-fichier-migration>');
  console.error('   Exemple: node scripts/apply-single-migration.js 20250122000064_link_abonnement_to_existing_client_spaces.sql');
  process.exit(1);
}

applyMigration(migrationFile);

