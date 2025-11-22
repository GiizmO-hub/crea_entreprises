#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement les corrections via les fonctions RPC Supabase
 * 
 * Ce script utilise les fonctions RPC créées dans Supabase pour appliquer les migrations
 * de manière sécurisée via l'API.
 * 
 * Usage:
 *   node scripts/apply-fixes-via-rpc.js fix-date-activation
 *   node scripts/apply-fixes-via-rpc.js fix-mode-paiement
 *   node scripts/apply-fixes-via-rpc.js all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes\n');
  console.error('Assurez-vous d\'avoir dans .env:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

// Créer le client Supabase avec Service Role Key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Appliquer la correction date_activation
 */
async function applyFixDateActivation() {
  console.log('🔧 Application de la correction: date_activation...\n');
  
  try {
    const { data, error } = await supabase.rpc('apply_fix_date_activation');
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return false;
    }
    
    if (data?.success) {
      console.log('✅', data.message);
      console.log('\n🎉 Correction appliquée avec succès !\n');
      return true;
    } else {
      console.log('⚠️  Résultat inattendu:', data);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution:', error.message);
    console.log('\n💡 La fonction RPC n\'existe peut-être pas encore.');
    console.log('   Exécutez d\'abord: supabase/migrations/20250122000009_create_migration_executor.sql\n');
    return false;
  }
}

/**
 * Appliquer la correction mode_paiement
 */
async function applyFixModePaiement() {
  console.log('🔧 Application de la correction: mode_paiement...\n');
  
  try {
    const { data, error } = await supabase.rpc('apply_fix_mode_paiement');
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return false;
    }
    
    if (data?.success) {
      console.log('✅', data.message);
      console.log('\n🎉 Correction appliquée avec succès !\n');
      return true;
    } else {
      console.log('⚠️  Résultat inattendu:', data);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution:', error.message);
    console.log('\n💡 La fonction RPC n\'existe peut-être pas encore.');
    console.log('   Exécutez d\'abord: supabase/migrations/20250122000009_create_migration_executor.sql\n');
    return false;
  }
}

/**
 * Appliquer toutes les corrections
 */
async function applyAllFixes() {
  console.log('🚀 Application de toutes les corrections...\n');
  
  const results = {
    date_activation: false,
    mode_paiement: false,
  };
  
  results.mode_paiement = await applyFixModePaiement();
  results.date_activation = await applyFixDateActivation();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`✅ mode_paiement: ${results.mode_paiement ? 'OK' : '❌ ÉCHEC'}`);
  console.log(`✅ date_activation: ${results.date_activation ? 'OK' : '❌ ÉCHEC'}`);
  console.log('='.repeat(60) + '\n');
  
  return results.mode_paiement && results.date_activation;
}

/**
 * Main
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log('🚀 Script d\'application automatique des corrections Supabase\n');
    console.log('Usage:');
    console.log('  node scripts/apply-fixes-via-rpc.js fix-date-activation');
    console.log('  node scripts/apply-fixes-via-rpc.js fix-mode-paiement');
    console.log('  node scripts/apply-fixes-via-rpc.js all\n');
    console.log('⚠️  Prérequis:');
    console.log('   1. Exécutez d\'abord la migration:');
    console.log('      supabase/migrations/20250122000009_create_migration_executor.sql');
    console.log('   2. Cela créera les fonctions RPC nécessaires\n');
    process.exit(0);
  }

  console.log(`🌐 Connexion à: ${supabaseUrl.substring(0, 40)}...\n`);

  let success = false;

  switch (command) {
    case 'fix-date-activation':
      success = await applyFixDateActivation();
      break;
    case 'fix-mode-paiement':
      success = await applyFixModePaiement();
      break;
    case 'all':
      success = await applyAllFixes();
      break;
    default:
      console.error(`❌ Commande inconnue: ${command}`);
      console.log('\nCommandes disponibles:');
      console.log('  - fix-date-activation');
      console.log('  - fix-mode-paiement');
      console.log('  - all');
      process.exit(1);
  }

  if (success) {
    console.log('✨ Toutes les corrections ont été appliquées avec succès !');
    process.exit(0);
  } else {
    console.log('⚠️  Certaines corrections n\'ont pas pu être appliquées.');
    process.exit(1);
  }
}

main().catch(console.error);

