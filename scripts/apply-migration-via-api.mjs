#!/usr/bin/env node

/**
 * Application automatique de migration SQL via l'API Supabase
 * Utilise l'API Management pour exécuter du SQL
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY requis !');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigrationViaRPC() {
  console.log('🚀 Application de la migration via API...\n');
  
  // Lire le fichier SQL
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  const sqlContent = readFileSync(sqlFile, 'utf-8');
  
  // Diviser le SQL en blocs exécutables
  // Pour l'instant, on va créer une fonction temporaire qui exécute le SQL
  
  // Méthode: Créer une fonction RPC qui exécute le SQL
  const createExecFunction = `
    CREATE OR REPLACE FUNCTION exec_migration_sql()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      ${sqlContent.replace(/`/g, "\\`").replace(/\$/g, "\\$")}
      RETURN 'Migration appliquée avec succès';
    END;
    $$;
    
    SELECT exec_migration_sql();
    DROP FUNCTION exec_migration_sql();
  `;
  
  console.log('⚠️  Supabase API ne permet pas d\'exécuter du SQL arbitraire directement.');
  console.log('📋 Application manuelle requise via Dashboard ou CLI.\n');
  
  // Vérifier l'état actuel
  console.log('🔍 Vérification de l\'état actuel...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (plansError) {
    console.error('❌ Erreur vérification plans:', plansError.message);
  } else {
    console.log(`📊 Plans trouvés: ${plans?.length || 0}`);
    if (plans && plans.length > 0) {
      plans.forEach(plan => {
        console.log(`   - ${plan.nom}: ${plan.prix_mensuel}€/mois`);
      });
    } else {
      console.log('   ⚠️  Aucun plan actif trouvé - Migration nécessaire !\n');
    }
  }
  
  return { needsMigration: !plans || plans.length === 0 };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 DIAGNOSTIC ET APPLICATION DE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const result = await applyMigrationViaRPC();
  
  if (result.needsMigration) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ⚠️  MIGRATION NÉCESSAIRE - ACTION REQUISE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔧 Pour appliquer la migration automatiquement:');
    console.log('\n   1. Via Dashboard Supabase (RECOMMANDÉ):');
    console.log('      → https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('      → Ouvrir: APPLY_LAST_MIGRATION_NOW.sql');
    console.log('      → Copier/Coller et exécuter\n');
    
    console.log('   2. Via Supabase CLI (si installé):');
    console.log('      → supabase db push');
    console.log('      → Ou: supabase db execute --file APPLY_LAST_MIGRATION_NOW.sql\n');
  } else {
    console.log('\n✅ Les plans sont déjà présents !');
  }
}

main();

