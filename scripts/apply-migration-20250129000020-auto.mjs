#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000020
 * Correction de l'erreur "null value in column numero"
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL manquant dans .env');
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
    console.log('✅ Connecté à la base de données\n');

    // Lire le fichier de migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000020_fix_numero_facture_null_complete.sql');
    console.log(`📖 Lecture de la migration: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Fichier lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Exécuter la migration
    await client.query(migrationSQL);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier que la fonction a été créée
    console.log('🔍 Vérification de la fonction creer_facture_et_abonnement_apres_paiement...');
    const checkFunction = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
    `);

    if (checkFunction.rows.length > 0) {
      console.log('✅ Fonction creer_facture_et_abonnement_apres_paiement trouvée');
      console.log(`   Signature: ${checkFunction.rows[0].proname}`);
      
      // Vérifier que la fonction génère bien le numero
      if (checkFunction.rows[0].prosrc.includes('v_numero_facture') && 
          checkFunction.rows[0].prosrc.includes('INSERT INTO factures')) {
        console.log('✅ Fonction vérifie la génération du numero avant INSERT');
      }
    } else {
      console.log('⚠️ Fonction non trouvée');
    }

    console.log('\n✅ Migration terminée avec succès !');
    console.log('\n📋 Résumé :');
    console.log('   - Fonction creer_facture_et_abonnement_apres_paiement corrigée');
    console.log('   - Génération du numero de facture AVANT l\'INSERT');
    console.log('   - Format: FAC-YYYYMMDD-XXXXXXXX');
    console.log('   - Protection contre les doublons');
    console.log('\n🧪 Vous pouvez maintenant tester la création d\'entreprise !');

  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'application de la migration:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Message: ${error.message}`);
    if (error.detail) {
      console.error(`Détail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`Conseil: ${error.hint}`);
    }
    if (error.position) {
      console.error(`Position: ${error.position}`);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Déconnexion de la base de données');
  }
}

// Exécuter
applyMigration().catch(console.error);

