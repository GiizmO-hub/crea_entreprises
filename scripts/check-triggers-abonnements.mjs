#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, DB_PASSWORD;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_DB_PASSWORD') {
        DB_PASSWORD = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
DB_PASSWORD = DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function checkTriggers() {
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const triggers = await client.query(`
      SELECT 
        tgname as trigger_name,
        tgrelid::regclass as table_name,
        tgenabled as enabled,
        pg_get_triggerdef(oid) as definition
      FROM pg_trigger
      WHERE tgrelid = 'abonnements'::regclass
        AND tgisinternal = false
    `);

    console.log(`📋 Triggers sur la table abonnements: ${triggers.rows.length}\n`);
    
    if (triggers.rows.length > 0) {
      triggers.rows.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.trigger_name}`);
        console.log(`   Table: ${t.table_name}`);
        console.log(`   Activé: ${t.enabled}`);
        console.log(`   Définition: ${t.definition.substring(0, 200)}...`);
        console.log('');
      });
    } else {
      console.log('   ℹ️  Aucun trigger trouvé\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkTriggers();


