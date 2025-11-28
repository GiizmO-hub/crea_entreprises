#!/usr/bin/env node
/**
 * Script pour appliquer la migration de correction du workflow
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:NHqgSm75zjlNvpwW@db.ewlozuwvrteopotfizcr.supabase.co:5432/postgres';
const migrationFile = process.argv[2] || join(__dirname, '../supabase/migrations/20250127000002_fix_workflow_paiement_complet_final.sql');

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION DE LA MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Lire le fichier SQL
    console.log(`📄 Lecture du fichier: ${migrationFile}...`);
    const sqlContent = readFileSync(migrationFile, 'utf8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);

    // Se connecter à PostgreSQL
    console.log('📡 Connexion à PostgreSQL...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    console.log('✅ Connecté à la base de données\n');

    // Exécuter le SQL
    console.log('🔧 Application de la migration...\n');
    const result = await pool.query(sqlContent);

    console.log('✅ Migration appliquée avec succès !\n');

    // Afficher les résultats
    if (result.rows && result.rows.length > 0) {
      console.log('📊 Résultats:');
      result.rows.forEach((row, index) => {
        Object.keys(row).forEach(key => {
          console.log(`   ${key}: ${row[key]}`);
        });
        if (index < result.rows.length - 1) console.log('');
      });
      console.log('');
    }

    // Vérifier que les fonctions existent
    console.log('🔍 Vérification des fonctions...');
    const checkFunctions = await pool.query(`
      SELECT proname as function_name
      FROM pg_proc 
      WHERE proname IN ('creer_facture_et_abonnement_apres_paiement', 'valider_paiement_carte_immediat')
      ORDER BY proname;
    `);

    if (checkFunctions.rows.length > 0) {
      console.log('✅ Fonctions trouvées:');
      checkFunctions.rows.forEach(row => {
        console.log(`   → ${row.function_name}`);
      });
      console.log('');
    } else {
      console.log('⚠️  Aucune fonction trouvée\n');
    }

    await pool.end();
    console.log('✅ Connexion fermée\n');

    return true;

  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'application:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('password authentication')) {
      console.log('💡 Erreur d\'authentification. Vérifiez votre DATABASE_URL.\n');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('💡 Erreur de connexion. Vérifiez votre DATABASE_URL et votre connexion internet.\n');
    } else if (error.code === 'MODULE_NOT_FOUND') {
      console.log('💡 Module pg non installé. Installez-le avec: npm install pg\n');
    }
    
    return false;
  }
}

applyMigration().then((success) => {
  if (success) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ MIGRATION APPLIQUÉE AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🧪 Prochaines étapes:');
    console.log('   1. Testez la création d\'entreprise via le frontend');
    console.log('   2. Vérifiez que le workflow va jusqu\'au bout (100%)');
    console.log('   3. Vérifiez que facture, abonnement et espace client sont créés\n');
    process.exit(0);
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ❌ ÉCHEC DE L\'APPLICATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n❌ Erreur fatale:', error.message);
  process.exit(1);
});

