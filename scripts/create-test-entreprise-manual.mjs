#!/usr/bin/env node

/**
 * Script pour créer manuellement l'entreprise de test "SAS TEST"
 * 
 * Ce script peut être exécuté manuellement quand on veut créer l'entreprise de test.
 * Il ne sera PAS exécuté automatiquement lors des migrations.
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
config({ path: join(projectRoot, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL doit être configuré');
  process.exit(1);
}

async function createTestEntreprise() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier si l'entreprise existe déjà
    const checkResult = await client.query(
      `SELECT id, nom FROM entreprises WHERE nom = 'SAS TEST' LIMIT 1`
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`ℹ️  L'entreprise "SAS TEST" existe déjà (ID: ${checkResult.rows[0].id})`);
      console.log('   Pour la recréer, supprimez-la d\'abord depuis l\'application.\n');
      return;
    }
    
    // Lire et exécuter la migration
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250201000004_create_test_entreprise_complete.sql');
    const sqlContent = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔄 Création de l\'entreprise de test "SAS TEST"...\n');
    
    await client.query(sqlContent);
    
    console.log('\n✅ Entreprise de test créée avec succès !');
    console.log('   Tu peux maintenant l\'utiliser pour tester l\'application.\n');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.detail) {
      console.error('   Détail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

createTestEntreprise();

