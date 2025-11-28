#!/usr/bin/env node
/**
 * Script pour appliquer la correction automatiquement via DATABASE_URL
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

async function applyFix() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DE LA CORRECTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Lire le fichier SQL
    const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('📄 Lecture du fichier SQL...');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);

    // Se connecter à PostgreSQL
    console.log('📡 Connexion à PostgreSQL...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    console.log('✅ Connecté à la base de données\n');

    // Exécuter le SQL
    console.log('🔧 Application de la correction...\n');
    const result = await pool.query(sqlContent);

    console.log('✅ Correction appliquée avec succès !\n');

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

    // Vérifier que la fonction existe
    console.log('🔍 Vérification de la fonction...');
    const checkResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'create_complete_entreprise_automated'
      LIMIT 1;
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Fonction create_complete_entreprise_automated existe !');
      
      // Vérifier qu'elle utilise BEGIN/EXCEPTION et non ON CONFLICT
      const definition = checkResult.rows[0].definition;
      if (definition.includes('EXCEPTION WHEN unique_violation')) {
        console.log('✅ Correction appliquée : utilise BEGIN/EXCEPTION au lieu de ON CONFLICT\n');
      } else if (definition.includes('ON CONFLICT (email)')) {
        console.log('⚠️  ATTENTION : La fonction utilise encore ON CONFLICT (email)\n');
      }
    } else {
      console.log('⚠️  Fonction non trouvée\n');
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

applyFix().then((success) => {
  if (success) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ CORRECTION APPLIQUÉE AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🧪 Prochaines étapes:');
    console.log('   1. Testez la création d\'entreprise via le frontend');
    console.log('   2. L\'erreur ON CONFLICT devrait être résolue\n');
    process.exit(0);
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ❌ ÉCHEC DE L\'APPLICATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('💡 Vous pouvez toujours appliquer manuellement via:');
    console.log('   Supabase Dashboard → SQL Editor → APPLY_FIX_WORKFLOW_NOW.sql\n');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n❌ Erreur fatale:', error.message);
  process.exit(1);
});

