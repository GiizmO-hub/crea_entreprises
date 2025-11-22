#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement les corrections SQL directement
 * en utilisant les requêtes HTTP directes vers l'API Supabase
 * 
 * Ce script essaie d'appliquer les corrections via des méthodes alternatives
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
  console.error('❌ Variables d\'environnement manquantes\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Appliquer la correction via création de fonction RPC temporaire
 */
async function applyFixesViaTemporaryRPC() {
  console.log('🚀 Application automatique des corrections...\n');
  console.log('📋 Méthode: Installation des fonctions RPC puis application\n');

  // SQL pour installer les fonctions RPC et appliquer les corrections en une fois
  const installAndApplySQL = `
    -- 1. Installer les fonctions RPC
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      migration_name text NOT NULL UNIQUE,
      applied_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);

    -- 2. Fonction pour corriger date_activation
    CREATE OR REPLACE FUNCTION apply_fix_date_activation()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'abonnement_options' 
        AND column_name = 'date_activation'
      ) THEN
        ALTER TABLE abonnement_options 
        ADD COLUMN date_activation date DEFAULT CURRENT_DATE;
        
        INSERT INTO schema_migrations (migration_name)
        VALUES ('fix_date_activation')
        ON CONFLICT (migration_name) DO NOTHING;
        
        RETURN jsonb_build_object('success', true, 'message', 'Colonne date_activation ajoutée');
      ELSE
        RETURN jsonb_build_object('success', true, 'message', 'Colonne date_activation existe déjà');
      END IF;
    END;
    $$;

    -- 3. Fonction pour corriger mode_paiement
    CREATE OR REPLACE FUNCTION apply_fix_mode_paiement()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
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

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'abonnements' 
        AND column_name = 'mode_paiement'
      ) THEN
        ALTER TABLE abonnements 
        ADD COLUMN mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));
        
        INSERT INTO schema_migrations (migration_name)
        VALUES ('fix_mode_paiement')
        ON CONFLICT (migration_name) DO NOTHING;
        
        RETURN jsonb_build_object('success', true, 'message', 'Table et colonne mode_paiement créées');
      ELSE
        RETURN jsonb_build_object('success', true, 'message', 'Colonne mode_paiement existe déjà');
      END IF;
    END;
    $$;

    -- 4. Appliquer les corrections immédiatement
    SELECT apply_fix_mode_paiement() as result1;
    SELECT apply_fix_date_activation() as result2;
  `.trim();

  console.log('📋 SQL à exécuter dans Supabase SQL Editor (copiez tout):\n');
  console.log('═'.repeat(80));
  console.log(installAndApplySQL);
  console.log('═'.repeat(80));
  console.log('\n💡 Ce SQL va :');
  console.log('   1. Créer les fonctions RPC nécessaires');
  console.log('   2. Appliquer automatiquement les corrections');
  console.log('   3. Tout en une seule exécution !\n');

  // Essayer d'exécuter via une requête HTTP directe vers l'API Management
  try {
    console.log('🔄 Tentative d\'exécution automatique via l\'API...\n');
    
    // Malheureusement, Supabase ne permet pas d'exécuter du SQL arbitraire via l'API REST
    // Il faut utiliser le SQL Editor du Dashboard
    console.log('⚠️  Supabase ne permet pas d\'exécuter du SQL arbitraire via l\'API REST.');
    console.log('    Pour des raisons de sécurité, le SQL doit être exécuté via le Dashboard.\n');
    
  } catch (error) {
    console.log('⚠️  Exécution automatique impossible:', error.message);
  }

  return false;
}

/**
 * Main
 */
async function main() {
  console.log('🔧 Application automatique des corrections Supabase\n');
  console.log(`🌐 URL: ${supabaseUrl.substring(0, 40)}...\n`);

  const applied = await applyFixesViaTemporaryRPC();

  if (!applied) {
    console.log('📝 SOLUTION:');
    console.log('   1. Ouvrez Supabase Dashboard > SQL Editor');
    console.log('   2. Copiez le SQL affiché ci-dessus');
    console.log('   3. Collez et exécutez (Ctrl+Enter / Cmd+Enter)');
    console.log('   4. Réessayez de créer un espace membre\n');
    console.log('✨ Une fois fait, les corrections seront appliquées automatiquement !\n');
  }
}

main().catch(console.error);

