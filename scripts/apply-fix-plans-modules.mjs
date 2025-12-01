#!/usr/bin/env node

/**
 * Script pour appliquer la migration de correction des modules manquants
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Charger les variables d'environnement
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Récupérer DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL non défini dans .env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');

    // Lire le fichier de migration
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250131000011_fix_plans_modules_missing.sql');
    console.log(`📄 Lecture de la migration: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Nettoyer le SQL (supprimer les commentaires multi-lignes /* */)
    let cleanedSQL = migrationSQL;
    cleanedSQL = cleanedSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    cleanedSQL = cleanedSQL.replace(/\n\s*\n\s*\n/g, '\n\n');

    console.log('🚀 Application de la migration...');
    console.log('');
    
    // Exécuter la migration
    await client.query(cleanedSQL);
    
    console.log('');
    console.log('✅ Migration appliquée avec succès !');
    console.log('');
    console.log('📊 Corrections effectuées :');
    console.log('   ✅ Table plan_modules vérifiée/créée');
    console.log('   ✅ Modules associés au plan Starter');
    console.log('   ✅ Modules associés au plan Business');
    console.log('   ✅ Vérification finale effectuée');
    console.log('');
    console.log('💡 Les plans Starter et Business ont maintenant leurs modules associés');
    
  } catch (error) {
    console.error('');
    console.error('❌ Erreur lors de l\'application de la migration:');
    console.error(error.message);
    console.error('');
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Détail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Indication: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter
applyMigration().catch(console.error);

