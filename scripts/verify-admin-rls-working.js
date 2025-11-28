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

async function verify() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier combien de versions de la fonction existent
    const { rows: funcs } = await client.query(`
      SELECT 
        proname,
        pronargs,
        pg_get_function_arguments(oid) as arguments
      FROM pg_proc
      WHERE proname = 'is_platform_super_admin';
    `);
    
    console.log(`📋 Versions de is_platform_super_admin(): ${funcs.length}`);
    funcs.forEach(f => {
      console.log(`   - ${f.proname}(${f.arguments || 'aucun argument'})`);
    });
    
    if (funcs.length > 1) {
      console.log('\n⚠️  Plusieurs versions existent !');
    } else if (funcs.length === 0) {
      console.log('\n❌ Aucune fonction trouvée !');
    } else {
      console.log('\n✅ Une seule version existe');
    }
    
    // Lister toutes les entreprises (devrait fonctionner pour un admin)
    const { rows: entreprises } = await client.query(`
      SELECT id, nom, user_id, statut
      FROM entreprises
      ORDER BY created_at DESC;
    `);
    
    console.log(`\n📊 Entreprises dans la base: ${entreprises.length}`);
    if (entreprises.length > 0) {
      entreprises.forEach(e => {
        console.log(`   - ${e.nom} (ID: ${e.id}, User: ${e.user_id}, Statut: ${e.statut})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

verify();
