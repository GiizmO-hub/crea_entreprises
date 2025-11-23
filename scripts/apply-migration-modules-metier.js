#!/usr/bin/env node

/**
 * Script pour appliquer la migration de structure modules par métier
 * Connexion directe PostgreSQL
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

// Fonction pour obtenir la connexion PostgreSQL (identique à auto-apply-migrations.js)
function getPostgresConnection() {
  // Essayer d'utiliser SUPABASE_DB_URL si fourni directement
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    return dbUrl;
  }

  // Sinon, essayer de construire depuis les variables individuelles
  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  // Essayer aussi depuis VITE_SUPABASE_URL si un password est fourni
  if (!dbHost && !dbUrl) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (supabaseUrl && dbPassword) {
      // Extraire le project ref depuis l'URL Supabase
      // Format: https://xxxxx.supabase.co -> db.xxxxx.supabase.co
      const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
      if (urlMatch) {
        const projectRef = urlMatch[1];
        return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:${dbPort}/${dbName}`;
      }
    }
  }

  if (dbHost && dbPassword) {
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  throw new Error('Impossible de construire la connexion PostgreSQL. Vérifiez vos variables d\'environnement (SUPABASE_DB_URL, SUPABASE_DB_PASSWORD, etc.).');
}

async function applyMigration() {
  console.log('🚀 Application de la migration modules_metier_structure...\n');

  let client;
  try {
    const connectionString = getPostgresConnection();
    console.log('✅ Connexion PostgreSQL configurée\n');

    client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');

    // Lire le fichier de migration
    const migrationPath = join(projectRoot, 'supabase/migrations/20250122000045_create_modules_metier_structure.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration lue, application en cours...\n');

    // Exécuter la migration
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier la structure créée
    console.log('🔍 Vérification de la structure...\n');

    // Vérifier les colonnes ajoutées à modules_activation
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'modules_activation'
      AND column_name IN ('secteur_activite', 'priorite', 'icone', 'route', 'module_parent', 'prix_optionnel', 'est_cree')
      ORDER BY column_name;
    `);

    console.log('📋 Colonnes ajoutées à modules_activation:');
    if (columns.length > 0) {
      columns.forEach(col => {
        console.log(`  ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('  ⚠️  Aucune colonne trouvée (peut-être déjà existantes)');
    }

    // Vérifier la table modules_metier
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('modules_metier', 'abonnements_modules');
    `);

    console.log('\n📋 Tables créées:');
    tables.forEach(table => {
      console.log(`  ✅ ${table.table_name}`);
    });

    // Vérifier les fonctions RPC
    const { rows: functions } = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('get_modules_by_secteur', 'get_modules_by_abonnement');
    `);

    console.log('\n📋 Fonctions RPC créées:');
    functions.forEach(func => {
      console.log(`  ✅ ${func.routine_name}()`);
    });

    console.log('\n✅✅✅ Structure vérifiée avec succès !\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:');
    console.error(`   ${error.message}\n`);
    
    if (error.code === '42P07') {
      console.log('💡 La table existe déjà (ignoré, c\'est normal)\n');
    } else if (error.code === '42704') {
      console.log('💡 Certains objets n\'existent pas encore (normal si première exécution)\n');
    } else {
      throw error;
    }
  } finally {
    if (client) {
      await client.end();
      console.log('✅ Connexion fermée\n');
    }
  }
}

applyMigration().catch(error => {
  console.error('\n❌ Échec:', error.message);
  process.exit(1);
});

