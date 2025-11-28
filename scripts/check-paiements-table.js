#!/usr/bin/env node
import { config } from 'dotenv';
import pg from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

function getPostgresConnection() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) return dbUrl;
  
  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (dbHost && dbPassword) {
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (supabaseUrl && dbPassword) {
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectId) {
      return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
    }
  }
  
  console.error('❌ Informations de connexion PostgreSQL manquantes');
  process.exit(1);
}

async function checkTable() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier si la table paiements existe
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'paiements'
      );
    `);
    
    if (rows[0].exists) {
      console.log('✅ La table "paiements" existe');
      
      // Afficher la structure
      const { rows: columns } = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'paiements'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 Colonnes de la table "paiements":');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ La table "paiements" n\'existe pas');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkTable();
