#!/usr/bin/env node

/**
 * Script de test pour vérifier comment le plan_id est stocké dans les notes du paiement
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant');
  process.exit(1);
}

async function testPlanIdRetrieval() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Récupérer les 5 derniers paiements avec plan_id
    const { rows: paiements } = await client.query(`
      SELECT 
        id,
        entreprise_id,
        statut,
        notes,
        pg_typeof(notes) as notes_type,
        created_at
      FROM paiements
      WHERE notes IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`📊 ${paiements.length} paiement(s) trouvé(s)\n`);

    for (const paiement of paiements) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Paiement ID: ${paiement.id}`);
      console.log(`   Entreprise ID: ${paiement.entreprise_id || 'NULL'}`);
      console.log(`   Statut: ${paiement.statut}`);
      console.log(`   Type notes: ${paiement.notes_type}`);
      console.log(`   Créé le: ${paiement.created_at}`);
      
      // Tester différents moyens de récupérer le plan_id
      let plan_id_methods = {};
      
      try {
        const notes_jsonb = typeof paiement.notes === 'string' 
          ? JSON.parse(paiement.notes) 
          : paiement.notes;
        
        // Méthode 1 : notes.plan_id
        if (notes_jsonb?.plan_id) {
          plan_id_methods['notes.plan_id'] = notes_jsonb.plan_id;
        }
        
        // Méthode 2 : notes.plan_info.plan_id
        if (notes_jsonb?.plan_info?.plan_id) {
          plan_id_methods['notes.plan_info.plan_id'] = notes_jsonb.plan_info.plan_id;
        }
        
        // Méthode 3 : notes.plan_info.id
        if (notes_jsonb?.plan_info?.id) {
          plan_id_methods['notes.plan_info.id'] = notes_jsonb.plan_info.id;
        }
        
        console.log(`\n   ✅ Plan ID trouvé via:`);
        for (const [method, value] of Object.entries(plan_id_methods)) {
          console.log(`      - ${method}: ${value}`);
        }
        
        if (Object.keys(plan_id_methods).length === 0) {
          console.log(`   ❌ Aucun plan_id trouvé dans les notes`);
          console.log(`   📋 Structure notes complète:`);
          console.log(JSON.stringify(notes_jsonb, null, 2));
        }
        
      } catch (error) {
        console.log(`   ❌ Erreur parsing notes: ${error.message}`);
        console.log(`   📋 Notes brutes: ${typeof paiement.notes === 'string' ? paiement.notes : JSON.stringify(paiement.notes)}`);
      }
      
      console.log('');
    }

    // Tester la fonction de diagnostic
    if (paiements.length > 0) {
      const lastPaiement = paiements[0];
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔍 Test fonction diagnostic_workflow_60_percent pour paiement ${lastPaiement.id}...\n`);
      
      const { rows: diagnostic } = await client.query(`
        SELECT diagnostic_workflow_60_percent($1) as result
      `, [lastPaiement.id]);
      
      if (diagnostic.length > 0) {
        console.log('📊 Résultat diagnostic:');
        console.log(JSON.stringify(diagnostic[0].result, null, 2));
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test terminé');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testPlanIdRetrieval();

