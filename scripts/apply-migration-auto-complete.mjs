#!/usr/bin/env node

/**
 * Script d'application automatique de migration SQL via l'API Supabase
 * Utilise SERVICE_ROLE_KEY pour exécuter du SQL directement
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY non configuré !');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applySQL(sqlContent) {
  console.log('🚀 Application de la migration SQL...\n');
  
  try {
    // Exécuter le SQL via l'API REST Supabase (rpc ou query directe)
    // Note: Supabase n'a pas d'API directe pour exécuter du SQL arbitraire
    // On va utiliser une fonction RPC temporaire ou l'API Management
    
    // Méthode 1: Utiliser l'API Management de Supabase (si disponible)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql: sqlContent })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Migration appliquée avec succès !\n');
      return { success: true, result };
    } else {
      // Méthode alternative: créer une fonction RPC temporaire
      console.log('⚠️  Méthode directe non disponible, utilisation méthode alternative...\n');
      
      // Lire le fichier SQL
      const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
      const sql = readFileSync(sqlFile, 'utf-8');
      
      // Diviser en instructions individuelles et exécuter via des fonctions RPC
      console.log('📋 Le fichier SQL doit être appliqué manuellement via le Dashboard.');
      console.log('   Ou via Supabase CLI: supabase db execute --file APPLY_LAST_MIGRATION_NOW.sql\n');
      
      return { success: false, error: 'Application automatique non disponible, utiliser Dashboard ou CLI' };
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'application:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`📡 Connexion à Supabase...`);
  console.log(`   URL: ${SUPABASE_URL}\n`);
  
  // Vérifier la connexion
  try {
    const { data, error } = await supabase.from('plans_abonnement').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erreur de connexion:', error.message);
      process.exit(1);
    }
    console.log('✅ Connexion à Supabase OK\n');
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    process.exit(1);
  }
  
  // Lire le fichier SQL
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  console.log(`📄 Lecture du fichier: ${sqlFile}\n`);
  
  try {
    const sqlContent = readFileSync(sqlFile, 'utf-8');
    console.log(`✅ Fichier SQL lu (${sqlContent.length} caractères)\n`);
    
    // Application
    const result = await applySQL(sqlContent);
    
    if (!result.success) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  ⚠️  APPLICATION AUTOMATIQUE NON DISPONIBLE');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('🔧 OPTION 1: Via le Dashboard Supabase (RECOMMANDÉ)');
      console.log('   1. Ouvrir: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
      console.log('   2. Ouvrir le fichier: APPLY_LAST_MIGRATION_NOW.sql');
      console.log('   3. Copier tout (Cmd+A, Cmd+C)');
      console.log('   4. Coller dans l\'éditeur SQL');
      console.log('   5. Cliquer sur "Run"\n');
      
      console.log('🔧 OPTION 2: Via Supabase CLI');
      console.log('   supabase db execute --file APPLY_LAST_MIGRATION_NOW.sql\n');
      
      process.exit(1);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ MIGRATION APPLIQUÉE AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();

