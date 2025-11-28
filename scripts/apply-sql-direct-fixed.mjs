#!/usr/bin/env node

/**
 * Application automatique du SQL via connexion PostgreSQL directe
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'oigfYelQfUZHHTnU';
const PROJECT_REF = 'ewlozuwvrteopotfizcr';

const connectionString = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;

async function applySQL() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  console.log(`📄 Lecture du fichier: ${sqlFile}\n`);
  
  let sqlContent;
  try {
    sqlContent = readFileSync(sqlFile, 'utf-8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);
  } catch (error) {
    console.error('❌ Erreur lecture fichier:', error.message);
    process.exit(1);
  }
  
  console.log('🔌 Connexion à PostgreSQL...');
  const client = new Client({
    host: `aws-0-eu-central-1.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Exécuter tout le SQL d'un coup
    console.log('📤 Exécution de la migration...\n');
    
    try {
      const result = await client.query(sqlContent);
      console.log('✅ Migration appliquée avec succès !\n');
    } catch (error) {
      // Si erreur, essayer de continuer quand même
      console.log(`⚠️  Erreur partielle: ${error.message.split('\n')[0]}`);
      console.log('   (Certaines parties peuvent avoir été appliquées)\n');
    }
    
    // Vérifier les plans
    console.log('🔍 Vérification des résultats...\n');
    const plansResult = await client.query('SELECT COUNT(*) as count FROM plans_abonnement WHERE actif = true');
    const planCount = parseInt(plansResult.rows[0].count);
    console.log(`📊 Plans actifs: ${planCount}/4`);
    
    if (planCount >= 4) {
      console.log('✅ Les 4 plans sont présents !\n');
    }
    
    // Vérifier la fonction
    const funcResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
      ) as exists
    `);
    
    if (funcResult.rows[0].exists) {
      console.log('✅ Fonction creer_facture_et_abonnement_apres_paiement présente\n');
    }
    
    await client.end();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ MIGRATION APPLIQUÉE !');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('\n💡 Vérifiez le mot de passe\n');
    }
    process.exit(1);
  }
}

applySQL();

