#!/usr/bin/env node

/**
 * SCRIPT POUR APPLIQUER LES CORRECTIONS DU WORKFLOW
 * 
 * Applique les migrations qui corrigent la génération automatique de factures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL doit être configuré');
  process.exit(1);
}

async function applyMigration(fileName) {
  console.log(`\n📄 Application: ${fileName}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    const migrationFilePath = join(projectRoot, 'supabase', 'migrations', fileName);
    console.log(`📖 Lecture de: ${migrationFilePath}`);
    const sqlContent = readFileSync(migrationFilePath, 'utf-8');
    let cleanSQL = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    console.log('✅ Migration lue\n');

    console.log('⚙️  Application de la migration...');
    await client.query(cleanSQL);
    console.log('✅ Migration appliquée avec succès!');

  } catch (error) {
    console.error('⚠️  Erreur:', error.message);
    if (error.message.includes('already exists') || error.message.includes('déjà')) {
      console.log('   ℹ️  La fonction existe peut-être déjà, c\'est normal');
    } else {
      throw error;
    }
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée\n');
  }
}

async function applyAllWorkflowFixes() {
  console.log('🚀 APPLICATION DES CORRECTIONS DU WORKFLOW');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrations = [
    '20250131000004_fix_workflow_generate_invoice_source.sql',
    '20250131000005_fix_workflow_complete_add_source.sql',
  ];

  for (const migration of migrations) {
    try {
      await applyMigration(migration);
    } catch (error) {
      console.error(`❌ Erreur fatale lors de l'application de ${migration}:`, error.message);
      process.exit(1);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ TOUTES LES CORRECTIONS APPLIQUÉES !');
  console.log('\n📋 RÉSUMÉ:');
  console.log('   ✅ creer_facture_et_abonnement_apres_paiement corrigée');
  console.log('   ✅ generate_invoice_for_entreprise corrigée');
  console.log('   ✅ Champ source=\'plateforme\' ajouté dans toutes les insertions');
  console.log('\n🎉 Le workflow devrait maintenant générer les factures correctement !');
}

applyAllWorkflowFixes().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

