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

async function testFunction() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Trouver l'utilisateur admin
    const { rows: adminUser } = await client.query(`
      SELECT 
        id, 
        email, 
        raw_user_meta_data->>'role' as role,
        raw_app_meta_data->>'role' as app_role,
        EXISTS(
          SELECT 1 FROM espaces_membres_clients WHERE user_id = auth.users.id
        ) as has_espace_client
      FROM auth.users
      WHERE email = 'meddecyril@icloud.com'
      LIMIT 1;
    `);
    
    if (adminUser.length === 0) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }
    
    const user = adminUser[0];
    console.log('👤 Utilisateur:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role (raw_user_meta_data): ${user.role || 'NULL'}`);
    console.log(`   Role (raw_app_meta_data): ${user.app_role || 'NULL'}`);
    console.log(`   A un espace client: ${user.has_espace_client}\n`);
    
    // Vérifier directement dans la base
    const { rows: directCheck } = await client.query(`
      SELECT 
        (raw_user_meta_data->>'role')::text = 'super_admin' as is_super_admin,
        EXISTS(
          SELECT 1 FROM espaces_membres_clients WHERE user_id = $1
        ) as has_espace_client,
        (raw_user_meta_data->>'role')::text as role
      FROM auth.users
      WHERE id = $1;
    `, [user.id]);
    
    console.log('🔍 Vérification directe:');
    console.log(`   Role: ${directCheck[0].role}`);
    console.log(`   Is super_admin: ${directCheck[0].is_super_admin}`);
    console.log(`   Has espace client: ${directCheck[0].has_espace_client}\n`);
    
    // Vérifier la fonction is_platform_super_admin
    console.log('🔍 Test de la fonction is_platform_super_admin (sans auth.uid()):');
    const { rows: funcResult } = await client.query(`
      SELECT 
        is_platform_super_admin() as result;
    `);
    console.log(`   Résultat: ${funcResult[0].result}\n`);
    
    // Vérifier si la fonction existe et sa définition
    const { rows: funcDef } = await client.query(`
      SELECT prosrc
      FROM pg_proc
      WHERE proname = 'is_platform_super_admin'
      AND pronargs = 0
      LIMIT 1;
    `);
    
    if (funcDef.length > 0) {
      console.log('📋 Code de la fonction:');
      console.log(funcDef[0].prosrc.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testFunction();
