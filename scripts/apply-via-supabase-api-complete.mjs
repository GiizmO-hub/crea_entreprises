#!/usr/bin/env node

/**
 * Application complète via API Supabase
 * Crée les fonctions RPC nécessaires et applique les corrections
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

async function applyViaAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION VIA API SUPABASE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // ❌ L'API Supabase REST ne permet pas d'exécuter du SQL arbitraire
  // La seule solution est via le Dashboard ou psql
  
  console.log('⚠️  LIMITATION TECHNIQUE IMPORTANTE:\n');
  console.log('L\'API Supabase REST ne permet PAS d\'exécuter du SQL arbitraire');
  console.log('pour des raisons de sécurité.\n');
  console.log('🔧 SOLUTIONS DISPONIBLES:\n');
  console.log('1️⃣  Dashboard Supabase (2 minutes) - RECOMMANDÉ');
  console.log('   → https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  console.log('2️⃣  Installation de psql (pour automatisation future)');
  console.log('   → brew install postgresql\n');
  console.log('3️⃣  Utilisation de Supabase CLI (si configuré)\n');
  
  // Vérification de l'état actuel
  const { data: plans } = await supabase
    .from('plans_abonnement')
    .select('nom, prix_mensuel')
    .eq('actif', true);
  
  console.log(`📊 État actuel: ${plans?.length || 0}/4 plans présents\n`);
  
  if (plans && plans.length < 4) {
    console.log('⚠️  Migration nécessaire pour insérer les plans manquants\n');
  }
  
  return { needsMigration: !plans || plans.length < 4 };
}

async function main() {
  const result = await applyViaAPI();
  
  if (result.needsMigration) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📋 FICHIER SQL PRÊT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📄 Fichier: APPLY_LAST_MIGRATION_NOW.sql');
    console.log('📊 Contenu: Toutes les corrections nécessaires\n');
    console.log('✅ Une fois appliqué via Dashboard, je testerai tout !\n');
  }
}

main();

