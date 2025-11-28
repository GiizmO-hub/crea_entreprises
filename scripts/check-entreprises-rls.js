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
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (supabaseUrl && dbPassword) {
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectId) {
      return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
    }
  }
  
  console.error('❌ Informations de connexion PostgreSQL manquantes');
  process.exit(1);
}

async function checkRLS() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier les politiques RLS sur entreprises
    const { rows: policies } = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'entreprises'
      ORDER BY policyname;
    `);
    
    console.log('📋 Politiques RLS sur entreprises:');
    policies.forEach(p => {
      console.log(`\n   Nom: ${p.policyname}`);
      console.log(`   Commande: ${p.cmd}`);
      console.log(`   Condition (USING): ${p.qual || 'N/A'}`);
      console.log(`   Condition (WITH CHECK): ${p.with_check || 'N/A'}`);
    });
    
    // Vérifier combien d'entreprises existent
    const { rows: count } = await client.query(`
      SELECT COUNT(*) as total FROM entreprises;
    `);
    
    console.log(`\n📊 Total d'entreprises dans la base: ${count[0].total}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkRLS();
