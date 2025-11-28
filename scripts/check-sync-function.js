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

async function checkFunction() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier si la fonction existe
    const { rows: funcs } = await client.query(`
      SELECT 
        proname,
        pronargs,
        pg_get_function_arguments(oid) as arguments,
        prorettype::regtype as return_type
      FROM pg_proc
      WHERE proname = 'sync_plan_modules_to_client_spaces';
    `);
    
    if (funcs.length > 0) {
      console.log('✅ Fonction trouvée:');
      funcs.forEach(f => {
        console.log(`   Nom: ${f.proname}`);
        console.log(`   Arguments: ${f.arguments}`);
        console.log(`   Type de retour: ${f.return_type}`);
      });
    } else {
      console.log('❌ Fonction sync_plan_modules_to_client_spaces n\'existe pas !');
    }
    
    // Vérifier aussi sync_client_modules_from_plan
    const { rows: funcs2 } = await client.query(`
      SELECT proname, pg_get_function_arguments(oid) as arguments
      FROM pg_proc
      WHERE proname LIKE '%sync%modules%';
    `);
    
    console.log('\n📋 Toutes les fonctions de sync modules:');
    funcs2.forEach(f => {
      console.log(`   - ${f.proname}(${f.arguments})`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkFunction();
