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

async function checkTrigger() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier si le trigger existe
    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'paiements'
      AND trigger_name LIKE '%facture%abonnement%';
    `);
    
    if (triggers.length > 0) {
      console.log('✅ Trigger trouvé:');
      triggers.forEach(t => {
        console.log(`   - ${t.trigger_name}`);
        console.log(`     Event: ${t.event_manipulation}`);
        console.log(`     Table: ${t.event_object_table}`);
      });
    } else {
      console.log('❌ Aucun trigger trouvé sur la table paiements');
    }
    
    // Vérifier les paiements en attente
    const { rows: paiements } = await client.query(`
      SELECT id, entreprise_id, statut, methode_paiement, montant_ttc
      FROM paiements
      WHERE entreprise_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    console.log('\n📋 Derniers paiements:');
    paiements.forEach(p => {
      console.log(`   - ID: ${p.id}`);
      console.log(`     Statut: ${p.statut}`);
      console.log(`     Méthode: ${p.methode_paiement}`);
      console.log(`     Montant: ${p.montant_ttc}€`);
      console.log(`     Entreprise: ${p.entreprise_id}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkTrigger();
