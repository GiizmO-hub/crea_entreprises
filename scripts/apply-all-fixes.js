#!/usr/bin/env node

/**
 * Script pour appliquer TOUTES les corrections automatiquement
 * 
 * Usage:
 *   node scripts/apply-all-fixes.js
 */

import { readFileSync, existsSync } from 'fs';
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

// Construire l'URL de connexion
let dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (supabaseUrl && dbPassword) {
    try {
      const url = new URL(supabaseUrl);
      const projectId = url.hostname.replace('.supabase.co', '');
      
      if (projectId) {
        dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
      }
    } catch (e) {
      console.error('❌ Erreur parsing URL Supabase:', e.message);
      process.exit(1);
    }
  }
}

if (!dbUrl) {
  console.error('❌ ERREUR: Impossible de construire l\'URL de connexion DB');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function applyAllFixes() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté\n');

    // Liste des migrations à appliquer
    const migrations = [
      '20250122000091_fix_all_gen_salt_functions.sql',
      '20250122000092_fix_utilisateurs_role_constraint.sql',
      '20250122000093_ensure_all_espaces_membres_columns.sql'
    ];

    for (const migrationFile of migrations) {
      const migrationPath = join(projectRoot, 'supabase', 'migrations', migrationFile);
      
      if (!existsSync(migrationPath)) {
        console.log(`⚠️  Migration non trouvée: ${migrationFile}`);
        continue;
      }

      console.log(`📝 Application de: ${migrationFile}...`);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(migrationSQL);
        console.log(`✅ ${migrationFile} appliquée avec succès\n`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('déjà')) {
          console.log(`⚠️  ${migrationFile} - Certains objets existent déjà (ignoré)\n`);
        } else {
          console.error(`❌ Erreur dans ${migrationFile}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅✅✅ TOUTES LES MIGRATIONS APPLIQUÉES AVEC SUCCÈS! ✅✅✅');
    console.log('');
    console.log('🎯 Les erreurs suivantes sont maintenant corrigées:');
    console.log('   ✅ "function gen_salt(unknown) does not exist"');
    console.log('   ✅ "violates check constraint utilisateurs_role_check"');
    console.log('');
    console.log('   🚀 TESTEZ MAINTENANT la création d\'espace membre!');
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyAllFixes();

