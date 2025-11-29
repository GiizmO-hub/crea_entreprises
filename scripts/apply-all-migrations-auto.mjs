#!/usr/bin/env node

/**
 * Script pour appliquer toutes les migrations automatiquement
 * 
 * Ce script applique les migrations SQL via une connexion PostgreSQL directe
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement depuis .env
config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

// Configuration depuis les variables d'environnement
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL doit être configuré');
  console.error('');
  console.error('📋 Pour obtenir la connection string:');
  console.error('   1. Ouvrez Supabase Dashboard → Settings → Database');
  console.error('   2. Scroll jusqu\'à "Connection string"');
  console.error('   3. Sélectionnez "URI" (pas "Connection pooling")');
  console.error('   4. Copiez la connection string');
  console.error('   5. Ajoutez-la dans .env.local:');
  console.error('      DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres');
  console.error('');
  process.exit(1);
}

/**
 * Applique un fichier SQL
 */
async function applySQLFile(client, filePath, name) {
  try {
    console.log(`\n📄 Application: ${name}`);
    console.log(`   Fichier: ${filePath}`);
    
    const sqlContent = readFileSync(filePath, 'utf-8');
    
    // Nettoyer le SQL (enlever les commentaires de bloc)
    let cleanSQL = sqlContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Enlever les commentaires /* */
      .trim();

    // Exécuter le SQL
    await client.query(cleanSQL);
    
    console.log(`   ✅ Migration appliquée avec succès!`);
    return { success: true };
  } catch (error) {
    console.error(`   ❌ Erreur:`, error.message);
    // Continuer même en cas d'erreur (peut être une migration déjà appliquée)
    return { success: false, error: error.message };
  }
}

/**
 * Fonction principale
 */
async function applyAllMigrations() {
  console.log('🚀 APPLICATION AUTOMATIQUE DES MIGRATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Créer le client PostgreSQL
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Nécessaire pour Supabase
    },
  });

  try {
    // Se connecter
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté!\n');

    // Détecter automatiquement toutes les migrations dans supabase/migrations/
    const migrationsDir = join(projectRoot, 'supabase', 'migrations');
    
    console.log('🔍 Détection automatique des migrations...\n');
    
    let migrationFiles = [];
    try {
      const files = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Trier par nom (les timestamps garantissent l'ordre)
      
      migrationFiles = files.map(file => ({
        name: file.replace('.sql', '').replace(/_/g, ' '),
        file: join(migrationsDir, file),
      }));
      
      console.log(`✅ ${migrationFiles.length} migration(s) trouvée(s) dans supabase/migrations/\n`);
    } catch (error) {
      console.error('⚠️  Erreur lecture dossier migrations:', error.message);
      console.log('   Utilisation de la liste manuelle...\n');
      
      // Fallback sur la liste manuelle si le dossier n'existe pas
      migrationFiles = [
        {
          name: 'Fix RLS Clients - Permettre création depuis espace client',
          file: join(projectRoot, 'APPLY_FIX_CLIENTS_RLS_NOW.sql'),
        },
        {
          name: 'Créer table client_contacts pour les contacts des clients',
          file: join(projectRoot, 'APPLY_CLIENT_CONTACTS_MIGRATION_NOW.sql'),
        },
        {
          name: 'Fix RLS Factures - Permettre création depuis espace client',
          file: join(projectRoot, 'APPLY_FIX_FACTURES_RLS_NOW.sql'),
        },
        {
          name: 'Fix RLS facture_lignes - Permettre création depuis espace client',
          file: join(projectRoot, 'APPLY_FIX_FACTURE_LIGNES_RLS_NOW.sql'),
        },
        {
          name: 'Ajouter colonne source dans factures',
          file: join(projectRoot, 'APPLY_ADD_SOURCE_TO_FACTURES_NOW.sql'),
        },
        {
          name: 'Créer table facture_articles',
          file: join(projectRoot, 'APPLY_FACTURE_ARTICLES_MIGRATION_NOW.sql'),
        },
      ].filter(m => {
        try {
          return statSync(m.file).isFile();
        } catch {
          return false;
        }
      });
    }
    
    const migrations = migrationFiles;

    const results = [];

    // Appliquer chaque migration
    for (const migration of migrations) {
      const result = await applySQLFile(client, migration.file, migration.name);
      results.push({
        name: migration.name,
        ...result,
      });
    }

    // Résumé
    console.log('\n\n📊 RÉSUMÉ:');
    console.log('═══════════════════════════════════════');
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`✅ ${index + 1}. ${result.name}`);
      } else {
        console.log(`❌ ${index + 1}. ${result.name}`);
        console.log(`   Erreur: ${result.error}`);
      }
    });
    console.log('═══════════════════════════════════════\n');

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    if (successCount === totalCount) {
      console.log(`✅ Toutes les migrations ont été appliquées avec succès! (${successCount}/${totalCount})`);
    } else {
      console.log(`⚠️  ${successCount}/${totalCount} migrations appliquées avec succès`);
      console.log('   Certaines migrations peuvent nécessiter une application manuelle');
    }

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    // Fermer la connexion
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

// Exécuter
applyAllMigrations().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

