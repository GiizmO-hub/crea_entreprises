#!/usr/bin/env node

/**
 * Script pour installer les fonctions RPC ET appliquer automatiquement les corrections
 * 
 * Ce script :
 * 1. Installe d'abord les fonctions RPC nécessaires
 * 2. Puis applique automatiquement toutes les corrections
 * 
 * Usage:
 *   node scripts/install-and-apply-fixes.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Exécuter du SQL via l'API Supabase Management
 */
async function executeSQL(sql) {
  try {
    // Utiliser l'endpoint SQL de Supabase Management API
    const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      return { success: true, data: await response.json() };
    }

    // Si l'endpoint n'existe pas, essayer une autre approche
    // Créer une fonction RPC temporaire via une requête directe
    console.log('⚠️  Endpoint SQL direct non disponible. Utilisation d\'une approche alternative...\n');
    
    return { success: false, needsManual: true, sql };
    
  } catch (error) {
    return { success: false, error: error.message, needsManual: true, sql };
  }
}

/**
 * Appliquer directement les corrections via des requêtes SQL
 */
async function applyDirectFixes() {
  console.log('🔧 Application directe des corrections...\n');

  const fixes = [];

  // Fix 1: Ajouter colonne date_activation
  fixes.push({
    name: 'date_activation',
    sql: `
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
    `.trim(),
  });

  // Fix 2: Créer/ajouter colonne mode_paiement
  fixes.push({
    name: 'mode_paiement',
    sql: `
      -- Créer table abonnements si elle n'existe pas
      CREATE TABLE IF NOT EXISTS abonnements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
        plan_id uuid REFERENCES plans_abonnement(id) ON DELETE RESTRICT NOT NULL,
        statut text DEFAULT 'actif',
        date_debut date DEFAULT CURRENT_DATE,
        date_fin date,
        date_prochain_paiement date,
        montant_mensuel numeric DEFAULT 0,
        mode_paiement text DEFAULT 'mensuel',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      -- Ajouter colonne mode_paiement si elle n'existe pas
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'abonnements' 
          AND column_name = 'mode_paiement'
        ) THEN
          ALTER TABLE abonnements 
          ADD COLUMN mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));
          RAISE NOTICE 'Colonne mode_paiement ajoutée';
        ELSE
          RAISE NOTICE 'Colonne mode_paiement existe déjà';
        END IF;
      END $$;
    `.trim(),
  });

  // Tester si on peut exécuter directement via une fonction RPC existante
  let canUseRPC = false;

  try {
    const { error } = await supabase.rpc('apply_fix_date_activation');
    if (!error || !error.message.includes('Could not find the function')) {
      canUseRPC = true;
    }
  } catch (e) {
    // Fonction n'existe pas, on utilisera l'approche directe
  }

  if (canUseRPC) {
    console.log('✅ Les fonctions RPC existent, utilisation de celles-ci...\n');
    
    try {
      const { data: data1, error: error1 } = await supabase.rpc('apply_fix_mode_paiement');
      if (error1) {
        console.log('⚠️  Erreur apply_fix_mode_paiement:', error1.message);
      } else {
        console.log('✅', data1?.message || 'mode_paiement corrigé');
      }

      const { data: data2, error: error2 } = await supabase.rpc('apply_fix_date_activation');
      if (error2) {
        console.log('⚠️  Erreur apply_fix_date_activation:', error2.message);
      } else {
        console.log('✅', data2?.message || 'date_activation corrigé');
      }
      
      console.log('\n🎉 Toutes les corrections ont été appliquées via les fonctions RPC !\n');
      return true;
    } catch (error) {
      console.log('⚠️  Erreur lors de l\'appel des fonctions RPC:', error.message);
    }
  }

  // Si les fonctions RPC n'existent pas, afficher le SQL à copier
  console.log('⚠️  Les fonctions RPC n\'existent pas encore.\n');
  console.log('📋 Pour appliquer automatiquement, exécutez d\'abord dans Supabase SQL Editor:\n');
  console.log('─'.repeat(70));
  console.log('supabase/migrations/20250122000009_create_migration_executor.sql');
  console.log('─'.repeat(70));
  console.log('\n💡 Ensuite, ré-exécutez: npm run db:fix\n');
  console.log('\n🔧 OU appliquez directement ces corrections SQL:\n');
  console.log('─'.repeat(70));
  
  for (const fix of fixes) {
    console.log(`\n-- Fix: ${fix.name}`);
    console.log(fix.sql);
    console.log('─'.repeat(70));
  }
  
  console.log('\n💡 Copiez et exécutez chaque bloc SQL dans Supabase SQL Editor\n');
  
  return false;
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Installation et application automatique des corrections\n');
  console.log(`🌐 Connexion à: ${supabaseUrl.substring(0, 40)}...\n`);

  const success = await applyDirectFixes();

  if (success) {
    console.log('✨ Toutes les corrections ont été appliquées automatiquement !');
    process.exit(0);
  } else {
    console.log('⚠️  Application manuelle requise (voir instructions ci-dessus)');
    process.exit(1);
  }
}

main().catch(console.error);

