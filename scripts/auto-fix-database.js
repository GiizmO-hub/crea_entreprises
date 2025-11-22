#!/usr/bin/env node

/**
 * Script pour détecter et corriger automatiquement les problèmes de base de données
 * 
 * Ce script vérifie la structure de la base de données et applique les corrections nécessaires
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
import { config } from 'dotenv';
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erreur: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env');
  process.exit(1);
}

// Utiliser Service Role Key si disponible, sinon Anon Key
const supabase = createClient(
  supabaseUrl, 
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Vérifier si une table existe
 */
async function tableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    return !error || error.code !== '42P01'; // 42P01 = relation does not exist
  } catch (error) {
    return false;
  }
}

/**
 * Vérifier si une colonne existe dans une table
 */
async function columnExists(tableName, columnName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);
    
    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * Générer et exécuter le SQL de correction
 */
async function fixMissingColumn(tableName, columnName, columnDefinition) {
  const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}' 
        AND column_name = '${columnName}'
      ) THEN
        ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};
        RAISE NOTICE 'Colonne ${columnName} ajoutée à la table ${tableName}';
      ELSE
        RAISE NOTICE 'Colonne ${columnName} existe déjà';
      END IF;
    END $$;
  `;

  console.log(`  🔧 Génération du SQL pour ajouter ${columnName}...`);
  console.log(`\n📋 SQL à exécuter dans Supabase SQL Editor:\n`);
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  console.log('\n💡 Copiez ce SQL et exécutez-le dans Supabase SQL Editor\n');
}

/**
 * Vérifier et corriger la structure de la base de données
 */
async function checkAndFixDatabase() {
  console.log('🔍 Vérification de la structure de la base de données...\n');

  const checks = [];

  // Vérifier la table abonnements
  console.log('1️⃣  Vérification de la table abonnements...');
  const abonnementsExists = await tableExists('abonnements');
  
  if (!abonnementsExists) {
    console.log('  ❌ Table abonnements n\'existe pas');
    checks.push({
      type: 'missing_table',
      table: 'abonnements',
      fix: 'run_migration_20250122000008'
    });
  } else {
    console.log('  ✅ Table abonnements existe');
    
    // Vérifier la colonne mode_paiement
    const modePaiementExists = await columnExists('abonnements', 'mode_paiement');
    if (!modePaiementExists) {
      console.log('  ❌ Colonne mode_paiement manquante');
      await fixMissingColumn('abonnements', 'mode_paiement', "text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'))");
      checks.push({
        type: 'missing_column',
        table: 'abonnements',
        column: 'mode_paiement',
        fix: 'add_column_mode_paiement'
      });
    } else {
      console.log('  ✅ Colonne mode_paiement existe');
    }
  }

  // Vérifier la table abonnement_options
  console.log('\n2️⃣  Vérification de la table abonnement_options...');
  const abonnementOptionsExists = await tableExists('abonnement_options');
  
  if (!abonnementOptionsExists) {
    console.log('  ❌ Table abonnement_options n\'existe pas');
    checks.push({
      type: 'missing_table',
      table: 'abonnement_options',
      fix: 'run_migration_20250122000008'
    });
  } else {
    console.log('  ✅ Table abonnement_options existe');
  }

  // Vérifier la table utilisateurs
  console.log('\n3️⃣  Vérification de la table utilisateurs...');
  const utilisateursExists = await tableExists('utilisateurs');
  
  if (!utilisateursExists) {
    console.log('  ❌ Table utilisateurs n\'existe pas');
    checks.push({
      type: 'missing_table',
      table: 'utilisateurs',
      fix: 'run_migration_20250122000003'
    });
  } else {
    console.log('  ✅ Table utilisateurs existe');
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));

  if (checks.length === 0) {
    console.log('\n✅ Toutes les vérifications sont OK !');
    console.log('   Votre base de données est à jour.\n');
  } else {
    console.log(`\n⚠️  ${checks.length} problème(s) détecté(s):\n`);
    
    checks.forEach((check, index) => {
      console.log(`  ${index + 1}. ${check.type}`);
      console.log(`     Table: ${check.table}`);
      if (check.column) {
        console.log(`     Colonne manquante: ${check.column}`);
      }
      console.log(`     Solution: ${check.fix}\n`);
    });

    console.log('💡 SOLUTION:');
    console.log('   1. Ouvrez Supabase SQL Editor');
    console.log('   2. Exécutez la migration: supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql');
    console.log('   3. Relancez ce script pour vérifier\n');
  }
}

// Exécuter
checkAndFixDatabase().catch(console.error);

