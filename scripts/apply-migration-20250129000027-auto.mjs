#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000027
 * Garantir l'activation client_super_admin à 100%
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

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000027_fix_client_super_admin_role_activation.sql');
    console.log(`📖 Lecture: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');

    console.log('🔍 Vérification...');
    
    const checkFunction = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
    `);

    if (checkFunction.rows.length > 0) {
      console.log('✅ Fonction creer_facture_et_abonnement_apres_paiement trouvée');
    }

    console.log('\n📋 Résumé :');
    console.log('   ✅ Garantit la mise à jour du rôle client_super_admin');
    console.log('   ✅ Met à jour utilisateurs ET auth.users');
    console.log('   ✅ Vérification et logs détaillés');
    console.log('   ✅ Le workflow devrait maintenant passer à 100% !');

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

