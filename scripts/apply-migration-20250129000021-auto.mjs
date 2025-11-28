#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000021
 * Diagnostic et correction du workflow bloqué à 60%
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
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000021_fix_workflow_60_percent_diagnostic.sql');
    console.log(`📖 Lecture de la migration: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Fichier lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Exécuter la migration
    await client.query(migrationSQL);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier que les fonctions ont été créées
    console.log('🔍 Vérification des fonctions...');
    
    const checkFunction1 = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
    `);

    const checkFunction2 = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'diagnostic_workflow_60_percent'
    `);

    if (checkFunction1.rows.length > 0) {
      console.log('✅ Fonction creer_facture_et_abonnement_apres_paiement trouvée');
    } else {
      console.log('⚠️ Fonction creer_facture_et_abonnement_apres_paiement NON trouvée');
    }
    
    if (checkFunction2.rows.length > 0) {
      console.log('✅ Fonction diagnostic_workflow_60_percent trouvée');
    } else {
      console.log('⚠️ Fonction diagnostic_workflow_60_percent NON trouvée');
    }

    console.log('\n✅ Migration terminée avec succès !');
    console.log('\n📋 Résumé :');
    console.log('   - Fonction creer_facture_et_abonnement_apres_paiement améliorée');
    console.log('   - Fonction diagnostic_workflow_60_percent créée');
    console.log('   - Logs détaillés ajoutés');
    console.log('   - Meilleure récupération de plan_id et auth_user_id');
    console.log('   - Création espace membre même si abonnement échoue');
    console.log('\n🧪 Vous pouvez maintenant tester la création d\'entreprise !');
    console.log('   Pour diagnostiquer un paiement spécifique, utilisez :');
    console.log('   SELECT diagnostic_workflow_60_percent(\'<paiement_id>\');');

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

