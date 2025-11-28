#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration
 * 20250130000002_create_email_logs_table.sql
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
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Essayer plusieurs sources pour la connexion DB
const DATABASE_URL = 
  process.env.DATABASE_URL || 
  process.env.SUPABASE_DB_URL ||
  (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
    ? `postgresql://postgres.${process.env.SUPABASE_URL.split('//')[1]?.split('.')[0]}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
    : null);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL, SUPABASE_DB_URL, ou configuration Supabase manquante');
  console.error('💡 Veuillez configurer dans .env.local ou .env :');
  console.error('   - DATABASE_URL (connexion directe PostgreSQL)');
  console.error('   - OU SUPABASE_DB_URL');
  console.error('   - OU SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📋 Application de la migration 20250130000002...');
    console.log('📧 Création de la table email_logs...\n');
    
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000002_create_email_logs_table.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Fichier de migration non trouvé : ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Appliquer la migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');
    console.log('📋 Table email_logs créée avec :');
    console.log('   - Colonnes : id, client_id, email_type, recipient, subject');
    console.log('   - Colonnes : provider, provider_id, sent_at, error_message');
    console.log('   - Index pour recherches optimisées');
    console.log('   - RLS configuré pour sécurité\n');
    
    // Vérifier que la table existe
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'email_logs';
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Table email_logs vérifiée dans la base de données');
    } else {
      console.warn('⚠️  Table email_logs non trouvée après application');
    }
    
    // Vérifier les index
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'email_logs';
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log(`✅ ${indexCheck.rows.length} index créés sur email_logs`);
      indexCheck.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    }
    
    // Vérifier les politiques RLS
    const policyCheck = await client.query(`
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'email_logs';
    `);
    
    if (policyCheck.rows.length > 0) {
      console.log(`✅ ${policyCheck.rows.length} politiques RLS créées`);
      policyCheck.rows.forEach(row => {
        console.log(`   - ${row.policyname}`);
      });
    }
    
    console.log('\n🎉 Migration complète ! La table email_logs est prête à recevoir les logs d\'emails.');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:');
    console.error('   Message:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    if (error.detail) {
      console.error('   Détail:', error.detail);
    }
    console.error('\n📄 SQL qui a causé l\'erreur :');
    console.error(error.query?.substring(0, 200) || 'Non disponible');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();

