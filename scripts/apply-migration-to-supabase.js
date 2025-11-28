#!/usr/bin/env node

/**
 * Script pour appliquer une migration SQL directement dans Supabase
 * 
 * Ce script utilise l'API Supabase REST pour exécuter du SQL
 * Nécessite la Service Role Key pour avoir tous les droits
 * 
 * Usage:
 *   node scripts/apply-migration-to-supabase.js [chemin-du-fichier.sql]
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes\n');
  console.error('Assurez-vous d\'avoir dans votre fichier .env:');
  console.error('  - VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (Service Role Key, pas Anon Key!)\n');
  console.error('📍 Où trouver la Service Role Key:');
  console.error('   Supabase Dashboard > Settings > API > service_role key (secret)\n');
  console.error('⚠️  ATTENTION: Ne partagez JAMAIS la Service Role Key publiquement!');
  process.exit(1);
}

/**
 * Appliquer du SQL dans Supabase via l'API REST
 */
async function applySQL(sql) {
  try {
    // Utiliser l'endpoint REST de Supabase pour exécuter du SQL
    // Note: Supabase n'a pas d'API directe pour exécuter du SQL arbitraire
    // Il faut utiliser le Dashboard SQL Editor ou créer une fonction RPC
    
    console.log('⚠️  Supabase ne permet pas d\'exécuter du SQL arbitraire via l\'API REST.');
    console.log('    Pour des raisons de sécurité, le SQL doit être exécuté via:');
    console.log('    1. Le Dashboard SQL Editor (recommandé)');
    console.log('    2. Une fonction RPC personnalisée\n');
    
    // Alternative: Créer une fonction RPC qui exécute le SQL
    console.log('📋 SQL à exécuter dans Supabase SQL Editor:\n');
    console.log('─'.repeat(70));
    console.log(sql);
    console.log('─'.repeat(70));
    
    return { success: true, message: 'SQL fourni pour exécution manuelle' };
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main
 */
async function main() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Usage: node scripts/apply-migration-to-supabase.js <chemin-fichier.sql>');
    console.error('\nExemple:');
    console.error('  node scripts/apply-migration-to-supabase.js supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql');
    process.exit(1);
  }

  const filePath = migrationFile.startsWith('/')
    ? migrationFile
    : join(projectRoot, migrationFile);

  console.log('🚀 Application de la migration SQL dans Supabase\n');
  console.log(`📄 Fichier: ${filePath}`);
  console.log(`🌐 URL Supabase: ${supabaseUrl.substring(0, 30)}...\n`);

  try {
    const sql = readFileSync(filePath, 'utf-8');
    console.log('✅ Fichier lu avec succès\n');
    
    await applySQL(sql);
    
    console.log('\n✅ Instructions affichées');
    console.log('\n💡 Prochaine étape:');
    console.log('   1. Ouvrez https://supabase.com/dashboard');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Allez dans SQL Editor');
    console.log('   4. Copiez le SQL ci-dessus');
    console.log('   5. Collez et exécutez (Ctrl+Enter ou Cmd+Enter)\n');
    
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du fichier: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);




