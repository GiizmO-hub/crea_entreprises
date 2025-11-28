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
    
    // Trouver un paiement payé
    const { rows: paiements } = await client.query(`
      SELECT p.id, p.entreprise_id, p.statut
      FROM paiements p
      WHERE p.statut = 'paye'
        AND p.entreprise_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1;
    `);
    
    if (paiements.length === 0) {
      console.log('❌ Aucun paiement payé trouvé');
      return;
    }
    
    const paiement = paiements[0];
    console.log('📋 Test avec paiement:', paiement.id);
    console.log(`   Entreprise: ${paiement.entreprise_id}\n`);
    
    // Appeler la fonction
    console.log('🔄 Appel de creer_facture_et_abonnement_apres_paiement...\n');
    const { rows: result } = await client.query(`
      SELECT creer_facture_et_abonnement_apres_paiement($1::uuid) as result;
    `, [paiement.id]);
    
    console.log('📊 Résultat:');
    console.log(JSON.stringify(result[0].result, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testFunction();
