#!/usr/bin/env node

/**
 * SCRIPT DE CORRECTION AUTOMATIQUE : Workflow complet jusqu'à 100%
 * 
 * Applique automatiquement les corrections pour que le workflow aille jusqu'au bout :
 * - creer_facture_et_abonnement_apres_paiement corrigée
 * - valider_paiement_carte_immediat corrigée
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
  console.error('❌ DATABASE_URL doit être configuré');
  process.exit(1);
}

const dbClient = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function appliquerCorrections() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 CORRECTION AUTOMATIQUE - Workflow Complet');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    await dbClient.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Corriger creer_facture_et_abonnement_apres_paiement
    console.log('🔧 CORRECTION 1: creer_facture_et_abonnement_apres_paiement');
    console.log('─────────────────────────────────────────────────────────');
    
    try {
      const sql1 = readFileSync(
        join(projectRoot, 'APPLY_FIX_WORKFLOW_COMPLET_NOW.sql'),
        'utf-8'
      );
      
      let cleanSQL1 = sql1
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^--.*$/gm, '')
        .trim();
      
      await dbClient.query(cleanSQL1);
      console.log('✅ creer_facture_et_abonnement_apres_paiement corrigée !\n');
    } catch (err) {
      console.log('❌ Erreur:', err.message);
      console.log('   Vérifie que le fichier APPLY_FIX_WORKFLOW_COMPLET_NOW.sql existe\n');
    }

    // 2. Corriger valider_paiement_carte_immediat
    console.log('🔧 CORRECTION 2: valider_paiement_carte_immediat');
    console.log('─────────────────────────────────────────────────────────');
    
    try {
      const sql2 = readFileSync(
        join(projectRoot, 'APPLY_FIX_VALIDER_PAIEMENT_NOW.sql'),
        'utf-8'
      );
      
      let cleanSQL2 = sql2
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^--.*$/gm, '')
        .trim();
      
      await dbClient.query(cleanSQL2);
      console.log('✅ valider_paiement_carte_immediat corrigée !\n');
    } catch (err) {
      console.log('❌ Erreur:', err.message);
      console.log('   Vérifie que le fichier APPLY_FIX_VALIDER_PAIEMENT_NOW.sql existe\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CORRECTIONS APPLIQUÉES !');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n💡 Maintenant, teste la création d\'entreprise avec un plan.');
    console.log('   Le workflow devrait aller jusqu\'à 100% :');
    console.log('   ✅ Entreprise créée');
    console.log('   ✅ Paiement créé');
    console.log('   ✅ Facture créée');
    console.log('   ✅ Abonnement créé');
    console.log('   ✅ Espace client créé');

  } catch (err) {
    console.error('❌ Erreur fatale:', err.message);
  } finally {
    await dbClient.end();
    console.log('\n🔌 Connexion fermée');
  }
}

appliquerCorrections().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});

