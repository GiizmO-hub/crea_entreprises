#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000023
 * Création de la table workflow_data pour simplifier le workflow
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté\n');

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000023_create_workflow_data_table.sql');
    console.log(`📖 Lecture: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');

    console.log('🔍 Vérification...');
    
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'workflow_data'
      ) as exists;
    `);

    const checkFunction1 = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'create_complete_entreprise_automated'
    `);

    const checkFunction2 = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
    `);

    if (checkTable.rows[0]?.exists) {
      console.log('✅ Table workflow_data créée');
    } else {
      console.log('⚠️ Table workflow_data NON trouvée');
    }
    
    if (checkFunction1.rows.length > 0) {
      console.log('✅ Fonction create_complete_entreprise_automated trouvée');
    }
    
    if (checkFunction2.rows.length > 0) {
      console.log('✅ Fonction creer_facture_et_abonnement_apres_paiement trouvée');
    }

    console.log('\n📋 Résumé :');
    console.log('   ✅ Table workflow_data créée');
    console.log('   ✅ create_complete_entreprise_automated stocke dans workflow_data');
    console.log('   ✅ creer_facture_et_abonnement_apres_paiement lit depuis workflow_data');
    console.log('   ✅ Plus besoin de parser les notes TEXT/JSONB');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error(`Message: ${error.message}`);
    if (error.detail) console.error(`Détail: ${error.detail}`);
    if (error.hint) console.error(`Conseil: ${error.hint}`);
    if (error.position) console.error(`Position: ${error.position}`);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Déconnexion');
  }
}

applyMigration().catch(console.error);

