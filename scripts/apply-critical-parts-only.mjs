#!/usr/bin/env node

/**
 * Application des corrections critiques uniquement
 * Sans toucher aux migrations existantes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyCriticalParts() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION DES CORRECTIONS CRITIQUES');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Vérifier l'état actuel
  console.log('🔍 Étape 1: Vérification de l\'état actuel...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  const planCount = plans?.length || 0;
  console.log(`📊 Plans actifs: ${planCount}/4\n`);
  
  if (planCount >= 4) {
    console.log('✅ Les plans sont déjà présents !\n');
  } else {
    console.log(`⚠️  Seulement ${planCount} plan(s), insertion nécessaire...\n`);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ⚡ LIMITATION API SUPABASE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('❌ L\'API Supabase ne permet pas d\'exécuter du SQL arbitraire.\n');
  console.log('✅ SOLUTION LA PLUS RAPIDE (2 MINUTES):\n');
  console.log('1️⃣  Ouvrez cette URL:');
  console.log('   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  console.log('2️⃣  Ouvrez le fichier: APPLY_LAST_MIGRATION_NOW.sql\n');
  console.log('3️⃣  Sélectionnez TOUT (Cmd+A) et copiez (Cmd+C)\n');
  console.log('4️⃣  Collez dans l\'éditeur SQL et cliquez sur "RUN"\n');
  console.log('⏱️  Temps: 2 minutes maximum\n');
  console.log('✅ Une fois fait, dites "c\'est fait" et je teste immédiatement !\n');
  
  return { planCount, needsMigration: planCount < 4 };
}

async function main() {
  await applyCriticalParts();
}

main();

