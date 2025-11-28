#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration
 * 20250130000001_extend_update_client_complete_with_all_data.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL non définie dans .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📋 Application de la migration 20250130000001...');
    
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000001_extend_update_client_complete_with_all_data.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Fichier de migration non trouvé : ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Appliquer la migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !');
    console.log('📋 Fonction update_client_complete étendue pour gérer :');
    console.log('   - Abonnements (plan, statut, dates, montant, mode paiement)');
    console.log('   - Modules actifs (activation/désactivation)');
    console.log('   - Options d\'abonnement');
    console.log('   - Préférences (theme, langue, notifications)');
    
    // Vérifier que la fonction existe
    const { rows } = await client.query(`
      SELECT routine_name, routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'update_client_complete'
      LIMIT 1;
    `);
    
    if (rows.length > 0) {
      console.log('✅ Fonction update_client_complete vérifiée dans la base de données');
    } else {
      console.warn('⚠️  Fonction update_client_complete non trouvée après application');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();

