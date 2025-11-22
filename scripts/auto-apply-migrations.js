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
  console.error('📍 Où trouver ces informations:');
  console.error('   Supabase Dashboard > Settings > Database > Connection string');
  console.error('   (Utilisez "Connection string" en mode "Session" ou "Transaction")\n');
  console.error('\n📋 Variables actuellement présentes dans .env:');
  const relevantVars = ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_DB_HOST', 
                        'SUPABASE_DB_PASSWORD', 'DB_PASSWORD', 'POSTGRES_PASSWORD'];
  relevantVars.forEach(varName => {
    if (process.env[varName]) {
      const value = process.env[varName];
      const masked = varName.includes('PASSWORD') ? '***' : value;
      console.error(`   ${varName}=${masked}`);
    }
  });
  console.error('');
  process.exit(1);
}

// Obtenir les colonnes de schema_migrations pour s'adapter à la structure existante
async function getSchemaMigrationsColumns(client) {
  try {
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `);
    return result.rows.map(r => r.column_name);
  } catch (error) {
    return [];
  }
}

// Créer la table de suivi des migrations si elle n'existe pas
async function ensureMigrationsTable(client) {
  try {
    // Vérifier si la table existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Créer la table si elle n'existe pas
      await client.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ Table schema_migrations créée');
    } else {
      // Vérifier que les colonnes existent et les ajouter si nécessaire
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      `);
      
      const columnNames = columns.rows.map(r => r.column_name);
      
      // Ajouter la colonne version si elle n'existe pas
      if (!columnNames.includes('version')) {
        // Vérifier s'il y a déjà une clé primaire
        const hasPrimaryKey = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
          AND table_name = 'schema_migrations'
          AND constraint_type = 'PRIMARY KEY'
        `);
        
        if (hasPrimaryKey.rows[0].count === '0') {
          await client.query(`ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(255) PRIMARY KEY;`);
        } else {
          await client.query(`ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(255);`);
        }
      }
      
      // Ajouter la colonne applied_at si elle n'existe pas
      if (!columnNames.includes('applied_at')) {
        await client.query(`ALTER TABLE schema_migrations ADD COLUMN applied_at TIMESTAMPTZ DEFAULT NOW();`);
      }
    }
  } catch (error) {
    // Si la table a une structure différente, la supprimer et la recréer
    if (error.message.includes('multiple primary keys') || error.message.includes('does not exist')) {
      console.log('⚠️  Structure de schema_migrations incorrecte, recréation...');
      await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE;');
      await client.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ Table schema_migrations recréée');
    } else {
      throw error;
    }
  }
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
    
    try {
      // Exécuter le SQL de la migration (sans transaction pour gérer les erreurs "already exists")
      try {
        await client.query(sql);
        console.log(`✅ SQL exécuté avec succès`);
      } catch (sqlError) {
        // Vérifier si c'est une erreur "already exists" qui peut être ignorée
        const errorMessage = sqlError.message.toLowerCase();
        const ignorableErrors = [
          'already exists',
          'duplicate',
          'relation already exists',
          'constraint already exists',
          'index already exists',
          'column already exists'
        ];
        
        const isIgnorable = ignorableErrors.some(err => errorMessage.includes(err));
        
        if (isIgnorable) {
          console.log(`⚠️  Certains objets existent déjà (ignoré, migration probablement déjà partiellement appliquée)`);
        } else {
          throw sqlError;
        }
      }
      
      // Enregistrer la migration comme appliquée
      try {
        // Détecter la structure de la table
        const columns = await getSchemaMigrationsColumns(client);
        const hasVersion = columns.includes('version');
        const hasMigrationName = columns.includes('migration_name');
        
        // Vérifier si la migration existe déjà
        let exists = false;
        if (hasVersion) {
          const result = await client.query(
            'SELECT 1 FROM schema_migrations WHERE version = $1',
            [version]
          );
          exists = result.rows.length > 0;
        } else if (hasMigrationName) {
          const result = await client.query(
            'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
            [version]
          );
          exists = result.rows.length > 0;
        }
        
        if (!exists) {
          // Insérer la migration selon la structure de la table
          if (hasMigrationName && !hasVersion) {
            // Table avec migration_name au lieu de version
            await client.query(
              'INSERT INTO schema_migrations (migration_name, applied_at) VALUES ($1, NOW())',
              [version]
            );
          } else if (hasVersion) {
            // Table avec version
            await client.query(
              'INSERT INTO schema_migrations (version) VALUES ($1)',
              [version]
            );
          } else {
            // Table avec autre structure, essayer d'insérer avec version
            await client.query(
              'INSERT INTO schema_migrations (version) VALUES ($1)',
              [version]
            );
          }
          console.log(`✅ Migration ${version} marquée comme appliquée`);
        } else {
          console.log(`ℹ️  Migration ${version} déjà marquée comme appliquée`);
        }
      } catch (markError) {
        // Si c'est une erreur "duplicate key" ou "unique constraint", c'est OK
        if (!markError.message.includes('duplicate key') && 
            !markError.message.includes('unique constraint') &&
            !markError.message.includes('violates unique constraint')) {
          // Pour les autres erreurs, continuer quand même (migration SQL appliquée)
          console.log(`ℹ️  Migration SQL appliquée (enregistrement dans schema_migrations ignoré)`);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de l'application de la migration ${version}:`);
      console.error(`   ${error.message}`);
      throw error;
    }
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
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

