#!/usr/bin/env node

/**
 * SCRIPT : Forcer l'exécution complète du workflow pour un paiement
 * 
 * Utilisation:
 * node scripts/forcer-workflow-complet.mjs [paiement_id]
 * 
 * Si pas de paiement_id, utilise le dernier paiement en attente
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurés');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const dbClient = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function forcerWorkflow(paiementIdArg) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 FORCER WORKFLOW COMPLET');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    await dbClient.connect();
    console.log('✅ Connecté à la base de données\n');

    let paiementId = paiementIdArg;

    // Si pas de paiement_id fourni, prendre le dernier en attente
    if (!paiementId) {
      console.log('🔍 Recherche du dernier paiement en attente...\n');
      
      const result = await dbClient.query(`
        SELECT id, entreprise_id, montant_ttc, created_at
        FROM paiements
        WHERE statut = 'en_attente'
        ORDER BY created_at DESC
        LIMIT 1;
      `);

      if (result.rows.length === 0) {
        console.log('❌ Aucun paiement en attente trouvé');
        return;
      }

      paiementId = result.rows[0].id;
      console.log(`✅ Paiement trouvé: ${paiementId.substring(0, 8)}...`);
      console.log(`   Entreprise: ${result.rows[0].entreprise_id.substring(0, 8)}...`);
      console.log(`   Montant: ${result.rows[0].montant_ttc}€\n`);
    }

    // 1. Vérifier workflow_data
    console.log('📋 ÉTAPE 1: Vérification workflow_data');
    console.log('─────────────────────────────────────────────────────────');
    
    const wd = await dbClient.query(`
      SELECT * FROM workflow_data WHERE paiement_id = $1;
    `, [paiementId]);

    if (wd.rows.length === 0) {
      console.log('❌ workflow_data n\'existe pas pour ce paiement !');
      console.log('   Le workflow ne peut pas continuer sans workflow_data.');
      return;
    }

    const workflowData = wd.rows[0];
    console.log('✅ workflow_data trouvé');
    console.log(`   Entreprise: ${workflowData.entreprise_id ? workflowData.entreprise_id.substring(0, 8) + '...' : '❌ NULL'}`);
    console.log(`   Client: ${workflowData.client_id ? workflowData.client_id.substring(0, 8) + '...' : '❌ NULL'}`);
    console.log(`   Auth User: ${workflowData.auth_user_id ? workflowData.auth_user_id.substring(0, 8) + '...' : '❌ NULL'}`);
    console.log(`   Plan: ${workflowData.plan_id ? workflowData.plan_id.substring(0, 8) + '...' : '❌ NULL'}`);
    console.log(`   Traité: ${workflowData.traite ? '✅ OUI' : '❌ NON'}\n`);

    if (!workflowData.entreprise_id || !workflowData.client_id || !workflowData.auth_user_id || !workflowData.plan_id) {
      console.log('❌ PROBLÈME: workflow_data est incomplet !');
      console.log('   Toutes les données doivent être présentes pour continuer.');
      return;
    }

    // 2. Appeler creer_facture_et_abonnement_apres_paiement via Supabase RPC
    console.log('📋 ÉTAPE 2: Appel de creer_facture_et_abonnement_apres_paiement');
    console.log('─────────────────────────────────────────────────────────');
    
    const { data: result, error } = await supabase.rpc('creer_facture_et_abonnement_apres_paiement', {
      p_paiement_id: paiementId
    });

    if (error) {
      console.log('❌ ERREUR lors de l\'appel:', error.message);
      console.log('   Code:', error.code);
      console.log('   Détails:', error.details);
      return;
    }

    if (!result || !result.success) {
      console.log('❌ La fonction a retourné une erreur:');
      console.log('   ', result?.error || 'Erreur inconnue');
      return;
    }

    console.log('✅ Workflow exécuté avec succès !');
    console.log(`   Facture ID: ${result.facture_id || 'N/A'}`);
    console.log(`   Abonnement ID: ${result.abonnement_id || 'N/A'}`);
    console.log(`   Espace membre ID: ${result.espace_membre_id || 'N/A'}\n`);

    // 3. Vérification finale
    console.log('📋 ÉTAPE 3: Vérification finale');
    console.log('─────────────────────────────────────────────────────────');
    
    const facture = await dbClient.query(`
      SELECT id, numero, statut FROM factures WHERE paiement_id = $1 LIMIT 1;
    `, [paiementId]);

    const abonnement = await dbClient.query(`
      SELECT id, statut FROM abonnements 
      WHERE entreprise_id = $1 AND plan_id = $2 
      LIMIT 1;
    `, [workflowData.entreprise_id, workflowData.plan_id]);

    const espaceMembre = await dbClient.query(`
      SELECT id, actif FROM espaces_membres_clients
      WHERE entreprise_id = $1 AND client_id = $2
      LIMIT 1;
    `, [workflowData.entreprise_id, workflowData.client_id]);

    console.log(`Facture: ${facture.rows.length > 0 ? '✅ ' + facture.rows[0].numero : '❌ N\'existe pas'}`);
    console.log(`Abonnement: ${abonnement.rows.length > 0 ? '✅ ' + abonnement.rows[0].statut : '❌ N\'existe pas'}`);
    console.log(`Espace membre: ${espaceMembre.rows.length > 0 ? '✅ actif: ' + espaceMembre.rows[0].actif : '❌ N\'existe pas'}`);

    const workflowProgress = [
      true, // Entreprise
      true, // Client
      espaceMembre.rows.length > 0, // Espace client
      abonnement.rows.length > 0, // Abonnement
      true // Super Admin (créé avec le client)
    ].filter(Boolean).length * 20;

    console.log(`\n📊 Progression workflow: ${workflowProgress}%`);

    if (workflowProgress === 100) {
      console.log('\n🎉 WORKFLOW COMPLET À 100% !');
    } else {
      console.log(`\n⚠️  Workflow à ${workflowProgress}% - Il manque encore des éléments.`);
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await dbClient.end();
    console.log('\n🔌 Connexion fermée');
  }
}

// Récupérer le paiement_id depuis les arguments
const paiementIdArg = process.argv[2];

forcerWorkflow(paiementIdArg).catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});

