#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement une migration SQL dans Supabase
 * Utilise la Service Role Key pour exécuter du SQL via l'API
 * 
 * Usage:
 *   node scripts/auto-apply-migration.js [chemin-fichier.sql]
 *   node scripts/auto-apply-migration.js fix-date-activation
 */

import { createClient } from '@supabase/supabase-js';
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
 * Corriger la colonne date_activation rapidement
 */
async function fixDateActivation() {
  console.log('🔧 Correction de la colonne date_activation...\n');
  
  const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'abonnement_options' 
        AND column_name = 'date_activation'
      ) THEN
        ALTER TABLE abonnement_options 
        ADD COLUMN date_activation date DEFAULT CURRENT_DATE;
        RAISE NOTICE 'Colonne date_activation ajoutée';
      ELSE
        RAISE NOTICE 'Colonne date_activation existe déjà';
      END IF;
    END $$;
  `;

  try {
    // Utiliser fetch pour exécuter via l'API Supabase Management
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql })
    });

    // Alternative: Utiliser directement le client pour créer une fonction temporaire
    console.log('⚠️  Supabase ne permet pas d\'exécuter du SQL arbitraire via l\'API standard.');
    console.log('    Il faut utiliser le SQL Editor du Dashboard.\n');
    
    console.log('📋 SQL à exécuter dans Supabase SQL Editor:\n');
    console.log('─'.repeat(70));
    console.log(sql.trim());
    console.log('─'.repeat(70));
    console.log('\n💡 Copiez ce SQL et exécutez-le dans Supabase SQL Editor\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

/**
 * Appliquer une migration SQL complète
 */
async function applyMigration(filePath) {
  console.log(`📄 Application de: ${filePath.split('/').pop()}\n`);
  
  try {
    const sql = readFileSync(filePath, 'utf-8');
    
    console.log('✅ Fichier lu avec succès');
    console.log(`📊 Taille: ${(sql.length / 1024).toFixed(2)} KB\n`);
    
    console.log('⚠️  Pour des raisons de sécurité, Supabase ne permet pas d\'exécuter');
    console.log('    du SQL arbitraire via l\'API REST standard.\n');
    console.log('📋 Veuillez copier le contenu du fichier dans Supabase SQL Editor:\n');
    console.log(`   1. Ouvrez: ${supabaseUrl.replace('/rest/v1', '')}/project/_/sql`);
    console.log(`   2. Cliquez sur "New Query"`);
    console.log(`   3. Copiez le contenu de: ${filePath}`);
    console.log(`   4. Collez et exécutez (Ctrl+Enter / Cmd+Enter)\n`);
    
    // Afficher les premières lignes pour vérification
    const preview = sql.split('\n').slice(0, 10).join('\n');
    console.log('📄 Aperçu du fichier:\n');
    console.log(preview);
    console.log('...\n');
    
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Vérifier la connexion et la structure
 */
async function checkConnection() {
  console.log('🔍 Vérification de la connexion à Supabase...\n');
  console.log(`🌐 URL: ${supabaseUrl.substring(0, 40)}...\n`);
  
  try {
    // Tester la connexion en listant les tables
    const { data, error } = await supabase
      .from('plans_abonnement')
      .select('count')
      .limit(0);
    
    if (error && error.code === 'PGRST116') {
      console.log('⚠️  Table plans_abonnement non trouvée');
      console.log('    La base de données n\'a peut-être pas été initialisée.\n');
    } else if (error) {
      console.log(`⚠️  Erreur de connexion: ${error.message}\n`);
    } else {
      console.log('✅ Connexion réussie !\n');
    }
    
    // Vérifier la table abonnement_options
    const { error: optionsError } = await supabase
      .from('abonnement_options')
      .select('date_activation')
      .limit(0);
    
    if (optionsError && optionsError.message.includes('date_activation')) {
      console.log('❌ Colonne date_activation manquante dans abonnement_options');
      console.log('    Exécutez: node scripts/auto-apply-migration.js fix-date-activation\n');
      return false;
    } else if (!optionsError) {
      console.log('✅ Colonne date_activation existe\n');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Main
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log('🚀 Script d\'application automatique de migrations Supabase\n');
    console.log('Usage:');
    console.log('  node scripts/auto-apply-migration.js check              # Vérifier la connexion');
    console.log('  node scripts/auto-apply-migration.js fix-date-activation # Corriger date_activation');
    console.log('  node scripts/auto-apply-migration.js [fichier.sql]      # Afficher le SQL à copier\n');
    process.exit(0);
  }

  if (command === 'check') {
    await checkConnection();
  } else if (command === 'fix-date-activation') {
    await fixDateActivation();
  } else {
    // Appliquer une migration
    const filePath = command.startsWith('/')
      ? command
      : join(projectRoot, command);
    await applyMigration(filePath);
  }
}

main().catch(console.error);

