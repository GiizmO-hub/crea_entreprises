#!/usr/bin/env node

/**
 * SCRIPT DE DIAGNOSTIC : Workflow complet de création d'entreprise
 * 
 * Vérifie que TOUT le workflow fonctionne :
 * 1. create_complete_entreprise_automated crée workflow_data ✅
 * 2. valider_paiement_carte_immediat appelle creer_facture_et_abonnement_apres_paiement
 * 3. creer_facture_et_abonnement_apres_paiement crée facture, abonnement, espace client
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL doit être configuré');
  process.exit(1);
}

const dbClient = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function diagnosticWorkflow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC WORKFLOW COMPLET');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    await dbClient.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Vérifier que creer_facture_et_abonnement_apres_paiement existe
    console.log('🔍 VÉRIFICATION: creer_facture_et_abonnement_apres_paiement');
    console.log('─────────────────────────────────────────────────────────');
    
    const funcCheck = await dbClient.query(`
      SELECT proname, pg_get_function_arguments(p.oid) as arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'creer_facture_et_abonnement_apres_paiement'
      LIMIT 1;
    `);

    if (funcCheck.rows.length === 0) {
      console.log('❌ PROBLÈME: La fonction creer_facture_et_abonnement_apres_paiement n\'existe pas');
    } else {
      console.log('✅ La fonction existe');
      console.log('   Signature:', funcCheck.rows[0].arguments);
    }

    // 2. Vérifier que valider_paiement_carte_immediat appelle creer_facture_et_abonnement_apres_paiement
    console.log('\n🔍 VÉRIFICATION: valider_paiement_carte_immediat');
    console.log('─────────────────────────────────────────────────────────');
    
    const validerCheck = await dbClient.query(`
      SELECT proname, prosrc
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'valider_paiement_carte_immediat'
      LIMIT 1;
    `);

    if (validerCheck.rows.length === 0) {
      console.log('❌ PROBLÈME: La fonction valider_paiement_carte_immediat n\'existe pas');
    } else {
      const sourceCode = validerCheck.rows[0].prosrc;
      if (sourceCode.includes('creer_facture_et_abonnement_apres_paiement')) {
        console.log('✅ La fonction appelle bien creer_facture_et_abonnement_apres_paiement');
      } else {
        console.log('❌ PROBLÈME: La fonction n\'appelle PAS creer_facture_et_abonnement_apres_paiement');
      }
    }

    // 3. Vérifier la structure de la table abonnements
    console.log('\n🔍 VÉRIFICATION: Structure table abonnements');
    console.log('─────────────────────────────────────────────────────────');
    
    const abonnementsCols = await dbClient.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'abonnements'
      ORDER BY ordinal_position;
    `);

    console.log('Colonnes de abonnements:');
    abonnementsCols.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // 4. Vérifier la structure de espaces_membres_clients
    console.log('\n🔍 VÉRIFICATION: Structure table espaces_membres_clients');
    console.log('─────────────────────────────────────────────────────────');
    
    const espaceCols = await dbClient.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'espaces_membres_clients'
      ORDER BY ordinal_position;
    `);

    console.log('Colonnes de espaces_membres_clients:');
    espaceCols.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // 5. Vérifier un paiement récent avec workflow_data
    console.log('\n🔍 VÉRIFICATION: Paiements récents avec workflow_data');
    console.log('─────────────────────────────────────────────────────────');
    
    const paiementsRecents = await dbClient.query(`
      SELECT 
        p.id as paiement_id,
        p.statut,
        p.entreprise_id,
        wd.entreprise_id as wd_entreprise_id,
        wd.client_id,
        wd.auth_user_id,
        wd.plan_id,
        wd.traite
      FROM paiements p
      LEFT JOIN workflow_data wd ON wd.paiement_id = p.id
      WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY p.created_at DESC
      LIMIT 5;
    `);

    if (paiementsRecents.rows.length === 0) {
      console.log('⚠️  Aucun paiement récent trouvé');
    } else {
      console.log(`${paiementsRecents.rows.length} paiement(s) récent(s):`);
      paiementsRecents.rows.forEach((p, i) => {
        console.log(`\n   ${i + 1}. Paiement ${p.paiement_id.substring(0, 8)}...`);
        console.log(`      Statut: ${p.statut}`);
        console.log(`      workflow_data existe: ${p.wd_entreprise_id ? '✅ OUI' : '❌ NON'}`);
        if (p.wd_entreprise_id) {
          console.log(`      Traité: ${p.traite ? '✅ OUI' : '❌ NON'}`);
          console.log(`      Client ID: ${p.client_id ? '✅ ' + p.client_id.substring(0, 8) + '...' : '❌ NULL'}`);
          console.log(`      Auth User ID: ${p.auth_user_id ? '✅ ' + p.auth_user_id.substring(0, 8) + '...' : '❌ NULL'}`);
          console.log(`      Plan ID: ${p.plan_id ? '✅ ' + p.plan_id.substring(0, 8) + '...' : '❌ NULL'}`);
        }
      });
    }

    console.log('\n\n📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Diagnostic terminé. Vérifie les résultats ci-dessus.');
    console.log('\n💡 Si workflow_data existe mais traite = false,');
    console.log('   c\'est que creer_facture_et_abonnement_apres_paiement');
    console.log('   n\'a pas été appelée ou a échoué.');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await dbClient.end();
  }
}

diagnosticWorkflow().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
