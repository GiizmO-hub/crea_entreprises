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

async function testAdminView() {
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
      SELECT id, email, raw_user_meta_data->>'role' as role
      FROM auth.users
      WHERE email = 'meddecyril@icloud.com'
      LIMIT 1;
    `);
    
    if (adminUser.length === 0) {
      console.log('❌ Utilisateur meddecyril@icloud.com non trouvé');
      return;
    }
    
    console.log('👤 Utilisateur admin trouvé:');
    console.log(`   ID: ${adminUser[0].id}`);
    console.log(`   Email: ${adminUser[0].email}`);
    console.log(`   Rôle: ${adminUser[0].role || 'NON DÉFINI'}\n`);
    
    // Tester la fonction is_platform_super_admin pour cet utilisateur
    const { rows: isAdminResult } = await client.query(`
      SELECT is_platform_super_admin() as is_admin;
    `);
    
    console.log('🔍 Test avec auth.uid() actuel (sans SET):');
    console.log(`   is_platform_super_admin(): ${isAdminResult[0].is_admin}\n`);
    
    // Tester en simulant l'utilisateur admin
    await client.query(`SET LOCAL role TO authenticated; SET LOCAL request.jwt.claim.sub TO '${adminUser[0].id}';`);
    
    const { rows: isAdminResult2 } = await client.query(`
      SELECT is_platform_super_admin() as is_admin;
    `);
    
    console.log('🔍 Test avec utilisateur admin simulé:');
    console.log(`   is_platform_super_admin(): ${isAdminResult2[0].is_admin}\n`);
    
    // Lister toutes les entreprises
    const { rows: entreprises } = await client.query(`
      SELECT id, nom, user_id, created_at
      FROM entreprises
      ORDER BY created_at DESC;
    `);
    
    console.log(`📊 Total d'entreprises dans la base: ${entreprises.length}`);
    if (entreprises.length > 0) {
      console.log('\n📋 Entreprises:');
      entreprises.forEach(e => {
        console.log(`   - ${e.nom} (ID: ${e.id}, User: ${e.user_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testAdminView();
