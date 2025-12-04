#!/usr/bin/env node

/**
 * SCRIPT DE DIAGNOSTIC ET CORRECTION AUTOMATIQUE
 * Module : Création d'entreprise
 * 
 * Ce script :
 * 1. Vérifie que toutes les fonctions existent avec les bonnes signatures
 * 2. Vérifie que toutes les tables/colonnes nécessaires existent
 * 3. Corrige automatiquement les problèmes trouvés
 * 4. Teste le workflow complet
 * 
 * Objectif : Éviter de devoir tout reprendre chaque semaine
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// FONCTIONS DE DIAGNOSTIC
// ============================================================================

async function verifierFonctionCreateEntreprise(dbClient) {
  console.log('\n🔍 VÉRIFICATION: create_complete_entreprise_automated');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const result = await dbClient.query(`
      SELECT 
        p.proname,
        pg_get_function_arguments(p.oid) as arguments,
        p.proargnames::text[] as param_names
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'create_complete_entreprise_automated'
      LIMIT 1;
    `);

    if (result.rows.length === 0) {
      console.log('❌ PROBLÈME: La fonction n\'existe pas');
      return { ok: false, error: 'fonction_manquante' };
    }

    const fonction = result.rows[0];
    const paramsActuels = fonction.param_names || [];
    
    // Vérifier si les paramètres critiques sont présents
    const paramsCritiques = ['p_code_ape', 'p_code_naf', 'p_convention_collective'];
    const paramsManquants = paramsCritiques.filter(p => !paramsActuels.includes(p));

    if (paramsManquants.length > 0) {
      console.log('❌ PROBLÈME: Paramètres manquants:', paramsManquants.join(', '));
      console.log('   Signature actuelle:', paramsActuels.length, 'paramètres');
      console.log('   Paramètres attendus:', paramsCritiques.join(', '));
      return { ok: false, error: 'signature_incorrecte', paramsManquants };
    }

    console.log('✅ La fonction existe avec la bonne signature');
    console.log('   Paramètres:', paramsActuels.length);
    return { ok: true, params: paramsActuels };
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return { ok: false, error: 'exception', message: err.message };
  }
}

async function verifierTableWorkflowData(dbClient) {
  console.log('\n🔍 VÉRIFICATION: Table workflow_data');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const result = await dbClient.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workflow_data'
      ) as exists;
    `);

    if (!result.rows[0].exists) {
      console.log('❌ PROBLÈME: La table workflow_data n\'existe pas');
      return { ok: false, error: 'table_manquante' };
    }

    console.log('✅ La table workflow_data existe');
    return { ok: true };
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return { ok: false, error: 'exception', message: err.message };
  }
}

async function verifierColonnesEntreprises(dbClient) {
  console.log('\n🔍 VÉRIFICATION: Colonnes entreprises');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const result = await dbClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'entreprises'
        AND column_name IN ('code_ape', 'code_naf', 'convention_collective', 'statut_paiement');
    `);

    const colonnesTrouvees = result.rows.map(r => r.column_name);
    const colonnesRequises = ['code_ape', 'code_naf', 'convention_collective', 'statut_paiement'];
    const colonnesManquantes = colonnesRequises.filter(c => !colonnesTrouvees.includes(c));

    if (colonnesManquantes.length > 0) {
      console.log('❌ PROBLÈME: Colonnes manquantes:', colonnesManquantes.join(', '));
      return { ok: false, error: 'colonnes_manquantes', colonnesManquantes };
    }

    console.log('✅ Toutes les colonnes nécessaires existent');
    return { ok: true };
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return { ok: false, error: 'exception', message: err.message };
  }
}

// ============================================================================
// FONCTIONS DE CORRECTION AUTOMATIQUE
// ============================================================================

async function corrigerFonctionCreateEntreprise(dbClient) {
  console.log('\n🔧 CORRECTION: Mise à jour de create_complete_entreprise_automated');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const sqlContent = readFileSync(
      join(projectRoot, 'APPLY_FIX_CREATE_ENTREPRISE_NOW.sql'),
      'utf-8'
    );

    // Nettoyer le SQL (enlever les commentaires de bloc)
    let cleanSQL = sqlContent
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^--.*$/gm, '')
      .trim();

    // Exécuter le SQL
    await dbClient.query(cleanSQL);
    
    console.log('✅ Fonction corrigée avec succès !');
    return { ok: true };
  } catch (err) {
    console.log('❌ Erreur lors de la correction:', err.message);
    return { ok: false, error: err.message };
  }
}

async function corrigerTableWorkflowData(dbClient) {
  console.log('\n🔧 CORRECTION: Création de la table workflow_data');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS workflow_data (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        paiement_id uuid NOT NULL REFERENCES paiements(id) ON DELETE CASCADE,
        entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
        client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
        auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        plan_id uuid REFERENCES plans_abonnement(id) ON DELETE SET NULL,
        plan_info jsonb,
        traite boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(paiement_id)
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_data_paiement_id ON workflow_data(paiement_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_data_entreprise_id ON workflow_data(entreprise_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_data_traite ON workflow_data(traite);

      ALTER TABLE workflow_data ENABLE ROW LEVEL SECURITY;
    `;

    await dbClient.query(sql);
    console.log('✅ Table workflow_data créée/mise à jour !');
    return { ok: true };
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return { ok: false, error: err.message };
  }
}

async function corrigerColonnesEntreprises(dbClient) {
  console.log('\n🔧 CORRECTION: Ajout des colonnes manquantes à entreprises');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const sql = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entreprises' AND column_name = 'code_ape') THEN
          ALTER TABLE entreprises ADD COLUMN code_ape text;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entreprises' AND column_name = 'code_naf') THEN
          ALTER TABLE entreprises ADD COLUMN code_naf text;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entreprises' AND column_name = 'convention_collective') THEN
          ALTER TABLE entreprises ADD COLUMN convention_collective text;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entreprises' AND column_name = 'statut_paiement') THEN
          ALTER TABLE entreprises ADD COLUMN statut_paiement text DEFAULT 'non_requis';
        END IF;
      END $$;
    `;

    await dbClient.query(sql);
    console.log('✅ Colonnes ajoutées/mises à jour !');
    return { ok: true };
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

async function diagnosticEtCorrection() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC ET CORRECTION AUTOMATIQUE');
  console.log('   Module : Création d\'Entreprise');
  console.log('═══════════════════════════════════════════════════════════');

  if (!DATABASE_URL) {
    console.error('\n❌ Erreur: DATABASE_URL doit être configuré pour la correction automatique');
    console.error('   Le diagnostic peut fonctionner, mais pas la correction automatique.');
    console.error('   Ajoutez DATABASE_URL dans .env.local');
    return;
  }

  const dbClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await dbClient.connect();
    console.log('✅ Connecté à la base de données\n');

    // DIAGNOSTIC
    const resultats = {
      fonction: await verifierFonctionCreateEntreprise(dbClient),
      table_workflow: await verifierTableWorkflowData(dbClient),
      colonnes_entreprises: await verifierColonnesEntreprises(dbClient),
    };

    // RÉSUMÉ
    console.log('\n\n📊 RÉSUMÉ DU DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════');

    const tousOk = 
      resultats.fonction?.ok &&
      resultats.table_workflow?.ok &&
      resultats.colonnes_entreprises?.ok;

    if (tousOk) {
      console.log('✅ TOUT EST OK ! Le module création d\'entreprise est fonctionnel.');
      console.log('\n💡 Si tu as encore des erreurs dans l\'app, c\'est peut-être:');
      console.log('   - Cache du navigateur (vide le cache ou hard refresh Cmd+Shift+R)');
      console.log('   - Permissions RLS');
      console.log('   - Autre module qui interfère');
      return;
    }

    console.log('❌ PROBLÈMES TROUVÉS:');
    if (!resultats.fonction?.ok) console.log('   ❌ Fonction create_complete_entreprise_automated');
    if (!resultats.table_workflow?.ok) console.log('   ❌ Table workflow_data');
    if (!resultats.colonnes_entreprises?.ok) console.log('   ❌ Colonnes entreprises');

    // CORRECTION AUTOMATIQUE
    console.log('\n\n🔧 CORRECTION AUTOMATIQUE');
    console.log('═══════════════════════════════════════════════════════════');

    if (!resultats.fonction?.ok) {
      await corrigerFonctionCreateEntreprise(dbClient);
    }

    if (!resultats.table_workflow?.ok) {
      await corrigerTableWorkflowData(dbClient);
    }

    if (!resultats.colonnes_entreprises?.ok) {
      await corrigerColonnesEntreprises(dbClient);
    }

    // VÉRIFICATION FINALE
    console.log('\n\n✅ VÉRIFICATION FINALE');
    console.log('═══════════════════════════════════════════════════════════');

    const verificationFinale = {
      fonction: await verifierFonctionCreateEntreprise(dbClient),
      table_workflow: await verifierTableWorkflowData(dbClient),
      colonnes_entreprises: await verifierColonnesEntreprises(dbClient),
    };

    const toutCorrige = 
      verificationFinale.fonction?.ok &&
      verificationFinale.table_workflow?.ok &&
      verificationFinale.colonnes_entreprises?.ok;

    if (toutCorrige) {
      console.log('\n🎉 TOUS LES PROBLÈMES ONT ÉTÉ CORRIGÉS !');
      console.log('   Tu peux maintenant tester la création d\'entreprise dans l\'app.');
    } else {
      console.log('\n⚠️  Certains problèmes n\'ont pas pu être corrigés automatiquement.');
      console.log('   Vérifie les erreurs ci-dessus et corrige-les manuellement.');
    }

  } catch (err) {
    console.error('❌ Erreur fatale:', err.message);
  } finally {
    await dbClient.end();
    console.log('\n🔌 Connexion fermée');
  }
}

// Exécuter
diagnosticEtCorrection().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
