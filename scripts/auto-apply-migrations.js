#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement toutes les migrations SQL dans Supabase
 * 
 * Ce script :
 * 1. Se connecte directement à PostgreSQL de Supabase
 * 2. Lit tous les fichiers de migration dans supabase/migrations/
 * 3. Vérifie quelles migrations ont déjà été appliquées
 * 4. Applique les nouvelles migrations dans l'ordre
 * 
 * Usage:
 *   npm run db:apply-migrations
 *   ou
 *   node scripts/auto-apply-migrations.js
 */

import { readFileSync, readdirSync } from 'fs';
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
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL ou SUPABASE_URL manquant dans .env');
  }

  // L'URL Supabase est de la forme: https://xxxxx.supabase.co
  // On a besoin de l'URL PostgreSQL: postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
  
  // Essayer d'utiliser SUPABASE_DB_URL si fourni directement
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    return dbUrl;
  }

  // Sinon, demander les credentials
  const dbHost = process.env.SUPABASE_DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbHost || !dbPassword) {
    console.error('❌ Informations de connexion PostgreSQL manquantes\n');
    console.error('Ajoutez dans votre fichier .env l\'une des options suivantes:\n');
    console.error('Option 1 (recommandé):');
    console.error('  SUPABASE_DB_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres\n');
    console.error('Option 2:');
    console.error('  SUPABASE_DB_HOST=db.xxxxx.supabase.co');
    console.error('  SUPABASE_DB_PORT=5432');
    console.error('  SUPABASE_DB_NAME=postgres');
    console.error('  SUPABASE_DB_USER=postgres');
    console.error('  SUPABASE_DB_PASSWORD=[password]\n');
    console.error('📍 Où trouver ces informations:');
    console.error('   Supabase Dashboard > Settings > Database > Connection string');
    console.error('   (Utilisez "Connection string" ou "Session mode")\n');
    process.exit(1);
  }

  return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
}

// Créer la table de suivi des migrations si elle n'existe pas
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// Obtenir la liste des migrations déjà appliquées
async function getAppliedMigrations(client) {
  await ensureMigrationsTable(client);
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(row => row.version));
}

// Appliquer une migration
async function applyMigration(client, version, sql) {
  try {
    console.log(`\n🔄 Application de la migration: ${version}`);
    
    // Démarrer une transaction
    await client.query('BEGIN');
    
    try {
      // Exécuter le SQL de la migration
      await client.query(sql);
      
      // Enregistrer la migration comme appliquée
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [version]
      );
      
      // Commiter la transaction
      await client.query('COMMIT');
      
      console.log(`✅ Migration ${version} appliquée avec succès`);
      return true;
    } catch (error) {
      // Rollback en cas d'erreur
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error(`❌ Erreur lors de l'application de la migration ${version}:`);
    console.error(`   ${error.message}`);
    throw error;
  }
}

// Lire tous les fichiers de migration
function getMigrationFiles() {
  const migrationsDir = join(projectRoot, 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Trier par nom pour garantir l'ordre
  
  return files.map(file => ({
    version: file.replace('.sql', ''),
    file: file,
    path: join(migrationsDir, file)
  }));
}

// Fonction principale
async function main() {
  console.log('🚀 Application automatique des migrations SQL\n');

  try {
    // Se connecter à PostgreSQL
    const connectionString = getPostgresConnection();
    console.log('📡 Connexion à Supabase PostgreSQL...');
    
    const client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false // Supabase nécessite SSL
      }
    });

    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Obtenir les migrations déjà appliquées
    const appliedMigrations = await getAppliedMigrations(client);
    console.log(`📊 Migrations déjà appliquées: ${appliedMigrations.size}`);

    // Lire tous les fichiers de migration
    const migrationFiles = getMigrationFiles();
    console.log(`📁 Fichiers de migration trouvés: ${migrationFiles.length}\n`);

    // Filtrer les migrations non appliquées
    const pendingMigrations = migrationFiles.filter(
      m => !appliedMigrations.has(m.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Toutes les migrations sont déjà appliquées!');
      await client.end();
      return;
    }

    console.log(`🔄 ${pendingMigrations.length} migration(s) à appliquer:\n`);
    pendingMigrations.forEach(m => {
      console.log(`   - ${m.version}`);
    });

    // Appliquer chaque migration
    let appliedCount = 0;
    for (const migration of pendingMigrations) {
      try {
        const sql = readFileSync(migration.path, 'utf-8');
        await applyMigration(client, migration.version, sql);
        appliedCount++;
      } catch (error) {
        console.error(`\n❌ Échec de l'application de la migration ${migration.version}`);
        console.error('   Les migrations suivantes ne seront pas appliquées.');
        throw error;
      }
    }

    console.log(`\n✅ ${appliedCount} migration(s) appliquée(s) avec succès!`);
    
    await client.end();
    console.log('\n🎉 Toutes les migrations ont été appliquées!');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

