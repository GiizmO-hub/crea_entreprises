#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL manquante');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier toutes les versions de la fonction
    const query = `
      SELECT 
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'creer_facture_et_abonnement_apres_paiement'
        AND n.nspname = 'public'
      ORDER BY p.oid;
    `;
    
    const result = await client.query(query);
    
    console.log(`📋 Fonctions trouvées: ${result.rows.length}\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Fonction: ${row.function_name}(${row.arguments})`);
      const def = row.definition;
      
      // Vérifier si elle contient v_paiement.facture_id
      if (def.includes('v_paiement.facture_id')) {
        console.log('   ❌ CONTIENT v_paiement.facture_id (ERREUR)');
        console.log('   📍 Ligne:', def.split('v_paiement.facture_id')[0].split('\n').length);
      } else {
        console.log('   ✅ Ne contient PAS v_paiement.facture_id');
      }
      
      // Vérifier si elle utilise workflow_data
      if (def.includes('workflow_data')) {
        console.log('   ✅ Utilise workflow_data');
      } else {
        console.log('   ⚠️  N\'utilise PAS workflow_data');
      }
    });
    
    // Vérifier quelle fonction est appelée par le script
    console.log('\n\n🔍 Test d\'appel de la fonction...\n');
    
    const testQuery = `
      SELECT proname, pg_get_function_arguments(oid) as args
      FROM pg_proc
      WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY oid DESC
      LIMIT 1;
    `;
    
    const testResult = await client.query(testQuery);
    
    if (testResult.rows.length > 0) {
      console.log('📌 Fonction qui sera appelée:');
      console.log(`   Nom: ${testResult.rows[0].proname}`);
      console.log(`   Arguments: ${testResult.rows[0].args}\n`);
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await client.end();
  }
}

main();

