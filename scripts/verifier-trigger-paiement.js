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

async function verifierTrigger() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier le trigger
    const { rows: triggers } = await client.query(`
      SELECT 
        tgname as trigger_name,
        tgtype,
        tgenabled,
        pg_get_triggerdef(oid) as definition
      FROM pg_trigger
      WHERE tgrelid = 'paiements'::regclass
      AND tgname LIKE '%facture%abonnement%';
    `);
    
    console.log('📋 Triggers sur la table paiements:');
    triggers.forEach(t => {
      console.log(`\n   Nom: ${t.trigger_name}`);
      console.log(`   Activé: ${t.tgenabled === 'O' ? 'OUI' : 'NON'}`);
      console.log(`   Définition:`);
      console.log(`   ${t.definition}`);
    });
    
    if (triggers.length === 0) {
      console.log('   ❌ Aucun trigger trouvé !');
    }
    
    // Vérifier la fonction
    console.log('\n📋 Fonction creer_facture_et_abonnement_apres_paiement:');
    const { rows: funcs } = await client.query(`
      SELECT proname, proargtypes, prosrc
      FROM pg_proc
      WHERE proname = 'creer_facture_et_abonnement_apres_paiement';
    `);
    
    if (funcs.length > 0) {
      console.log('   ✅ Fonction existe');
    } else {
      console.log('   ❌ Fonction n\'existe pas');
    }
    
    // Vérifier finaliser_creation_apres_paiement
    console.log('\n📋 Fonction finaliser_creation_apres_paiement:');
    const { rows: funcs2 } = await client.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'finaliser_creation_apres_paiement';
    `);
    
    if (funcs2.length > 0) {
      console.log('   ✅ Fonction existe');
    } else {
      console.log('   ❌ Fonction n\'existe pas');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

verifierTrigger();
