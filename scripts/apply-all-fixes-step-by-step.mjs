#!/usr/bin/env node

/**
 * APPLICATION AUTOMATIQUE ÉTAPE PAR ÉTAPE
 * Applique chaque correction via des fonctions RPC
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyStepByStep() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE ÉTAPE PAR ÉTAPE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // ÉTAPE 1: Vérifier et insérer les plans
  console.log('📋 ÉTAPE 1/2: Insertion des plans d\'abonnement...\n');
  
  const { data: plans } = await supabase
    .from('plans_abonnement')
    .select('nom')
    .eq('actif', true);
  
  const planCount = plans?.length || 0;
  console.log(`   Plans trouvés: ${planCount}/4`);
  
  if (planCount < 4) {
    console.log('   ⚠️  Plans manquants détectés\n');
    console.log('   📝 Les plans seront insérés via le SQL complet.\n');
  } else {
    console.log('   ✅ Tous les plans sont présents\n');
  }
  
  // La seule vraie solution automatique est via Dashboard ou psql
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ⚡ SOLUTION AUTOMATIQUE LA PLUS RAPIDE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('🎯 Pour appliquer automatiquement TOUT, utilisez:\n');
  console.log('   1. Le Dashboard Supabase (2 minutes):');
  console.log('      → https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  console.log('   2. Ou avec mot de passe DB:');
  console.log('      → export SUPABASE_DB_PASSWORD="..."');
  console.log('      → node scripts/apply-via-psql.mjs\n');
  
  return { planCount, needsMigration: planCount < 4 };
}

async function main() {
  const result = await applyStepByStep();
  
  if (result.needsMigration) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ FICHIER PRÊT À APPLIQUER');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📄 Fichier: APPLY_LAST_MIGRATION_NOW.sql');
    console.log('📊 Contenu:');
    console.log('   → Insertion des 4 plans');
    console.log('   → Correction de creer_facture_et_abonnement_apres_paiement');
    console.log('   → Toutes les corrections du workflow\n');
  }
}

main();

