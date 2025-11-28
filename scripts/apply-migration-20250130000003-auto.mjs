#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const DATABASE_URL = 
  process.env.DATABASE_URL || 
  process.env.SUPABASE_DB_URL ||
  (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
    ? `postgresql://postgres.${process.env.SUPABASE_URL.split('//')[1]?.split('.')[0]}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
    : null);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquante');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📋 Application de la migration 20250130000003...');
    
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000003_add_status_to_email_logs.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Fichier de migration non trouvé`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
