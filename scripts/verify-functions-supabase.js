#!/usr/bin/env node

/**
 * Script pour vérifier que les fonctions RPC existent sur Supabase
 * 
 * Usage:
 *   node scripts/verify-functions-supabase.js
 */

import { config } from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

// Extraire les informations de connexion PostgreSQL
function getPostgresConnection() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    return dbUrl;
  }

  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (dbHost && dbPassword) {
    return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  }

  // Si SUPABASE_DB_PASSWORD est fourni, construire depuis VITE_SUPABASE_URL
  if (supabaseUrl && dbPassword) {
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch) {
      const projectRef = urlMatch[1];
      const host = `db.${projectRef}.supabase.co`;
      return `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${host}:5432/postgres`;
    }
  }

  throw new Error('Informations de connexion PostgreSQL manquantes. Ajoutez SUPABASE_DB_PASSWORD dans .env');
}

async function verifyFunctions() {
  const client = new Client({
    connectionString: getPostgresConnection(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Supabase PostgreSQL\n');

    // Fonctions à vérifier
    const functionsToCheck = [
      'update_collaborateur',
      'suspendre_collaborateur',
      'activer_collaborateur',
      'create_collaborateur',
      'delete_collaborateur_complete',
      'is_super_admin',
    ];

    console.log('🔍 Vérification des fonctions RPC...\n');

    for (const funcName of functionsToCheck) {
      const query = `
        SELECT 
          routine_name,
          routine_type,
          routine_schema,
          data_type as return_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = $1
      `;

      const result = await client.query(query, [funcName]);

      if (result.rows.length > 0) {
        const func = result.rows[0];
        console.log(`✅ ${funcName.padEnd(35)} - Existe (retour: ${func.return_type})`);
      } else {
        console.log(`❌ ${funcName.padEnd(35)} - MANQUANTE`);
      }
    }

    console.log('\n📊 Vérification de la table collaborateurs...');

    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'collaborateurs'
      )
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Table collaborateurs existe');

      const countResult = await client.query('SELECT COUNT(*) as count FROM collaborateurs');
      console.log(`   📈 ${countResult.rows[0].count} collaborateur(s) enregistré(s)`);
    } else {
      console.log('❌ Table collaborateurs MANQUANTE');
    }

    console.log('\n📋 Résumé des migrations...');

    const migrationsCheck = await client.query(`
      SELECT 
        migration_name,
        applied_at
      FROM schema_migrations
      ORDER BY applied_at DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    if (migrationsCheck.rows.length > 0) {
      console.log('\nDernières migrations appliquées:');
      migrationsCheck.rows.forEach((row) => {
        console.log(`   • ${row.migration_name} (${row.applied_at})`);
      });
    } else {
      console.log('⚠️  Table schema_migrations vide ou inexistante');
      console.log('   (C\'est normal si les migrations ont été appliquées manuellement)');
    }

    console.log('\n✅ Vérification terminée!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyFunctions();




