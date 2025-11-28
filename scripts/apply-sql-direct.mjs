#!/usr/bin/env node
/**
 * Script pour exécuter du SQL directement via Supabase
 * Utilise l'API REST avec SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

async function applySQL() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION DE LA CORRECTION SQL');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Lire le fichier SQL
    const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    
    // Extraire la définition de la fonction
    const functionStart = sqlContent.indexOf('CREATE OR REPLACE FUNCTION');
    const functionEnd = sqlContent.indexOf('-- Vérification');
    
    if (functionStart === -1) {
      throw new Error('Impossible de trouver la définition de la fonction');
    }
    
    const functionSql = functionEnd > functionStart 
      ? sqlContent.substring(functionStart, functionEnd).trim()
      : sqlContent.substring(functionStart).trim();
    
    console.log('📝 Exécution de la fonction via Supabase...\n');
    
    // Utiliser l'API REST Supabase
    // Note: Supabase REST API ne permet pas d'exécuter du SQL brut directement
    // Il faut utiliser l'endpoint SQL via fetch avec l'API Management
    
    // Essayer d'utiliser l'endpoint SQL de Supabase
    const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: functionSql })
    }).catch(() => null);
    
    if (response && response.ok) {
      const result = await response.json();
      console.log('✅ Correction appliquée avec succès !\n');
      console.log(result);
      return true;
    }
    
    // Alternative: Utiliser une fonction RPC temporaire
    console.log('⚠️ Endpoint direct non disponible, création d\'une fonction temporaire...\n');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Créer une fonction qui exécute notre SQL
    // Mais on ne peut pas créer de fonction qui exécute du SQL dynamique facilement
    
    // La meilleure approche est d'utiliser Supabase CLI
    console.log('📋 UTILISATION DE SUPABASE CLI:\n');
    console.log('   npx supabase db push\n');
    console.log('   OU copiez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('   dans Supabase Dashboard → SQL Editor\n');
    
    return false;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

applySQL().then((success) => {
  if (!success) {
    console.log('\n📋 Pour appliquer manuellement:');
    console.log('   1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('   2. Copiez APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('   3. Exécutez\n');
  }
  process.exit(success ? 0 : 0);
});
