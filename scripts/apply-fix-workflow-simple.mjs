#!/usr/bin/env node
/**
 * Script simple pour appliquer automatiquement la correction du workflow
 * via Supabase CLI ou via l'API REST si disponible
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyFix() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DE LA CORRECTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
  const sqlContent = readFileSync(sqlFile, 'utf8');

  // Méthode 1: Essayer Supabase CLI
  console.log('🔍 Tentative via Supabase CLI...\n');
  
  try {
    // Vérifier si supabase CLI est disponible
    execSync('which supabase', { stdio: 'ignore' });
    console.log('✅ Supabase CLI trouvé !\n');
    
    // Créer un fichier temporaire
    const tempFile = join(__dirname, '../temp_fix.sql');
    require('fs').writeFileSync(tempFile, sqlContent);
    
    console.log('📝 Application de la correction via CLI...\n');
    
    // Essayer d'exécuter via supabase db execute
    const result = execSync(
      `cd ${join(__dirname, '..')} && npx supabase db execute --file ${tempFile}`,
      { 
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env }
      }
    );
    
    console.log('✅ Correction appliquée avec succès via Supabase CLI !\n');
    console.log(result);
    
    // Nettoyer
    require('fs').unlinkSync(tempFile);
    return true;
    
  } catch (cliError) {
    console.log('⚠️ Supabase CLI non disponible ou erreur\n');
  }

  // Méthode 2: Utiliser l'API REST Supabase pour exécuter via une fonction RPC
  console.log('🔍 Tentative via API REST Supabase...\n');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Variables d\'environnement manquantes pour l\'API\n');
    throw new Error('Variables d\'environnement manquantes');
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extraire juste la définition de la fonction (sans commentaires et vérification finale)
    const functionStart = sqlContent.indexOf('CREATE OR REPLACE FUNCTION');
    const functionEnd = sqlContent.indexOf('-- Vérification');
    
    if (functionStart === -1) {
      throw new Error('Impossible de trouver la définition de la fonction');
    }
    
    const functionSql = functionEnd > functionStart 
      ? sqlContent.substring(functionStart, functionEnd).trim()
      : sqlContent.substring(functionStart).trim();
    
    // Exécuter chaque partie du SQL séparément
    console.log('📝 Exécution de la fonction corrigée via API...\n');
    
    // Utiliser l'API REST pour exécuter le SQL
    // Note: Supabase ne permet pas d'exécuter du SQL brut directement via l'API REST standard
    // Il faut utiliser l'API Management ou créer une fonction temporaire
    
    // Alternative: Utiliser pg directement si les credentials sont disponibles
    console.log('⚠️ L\'exécution de SQL brut nécessite une connexion PostgreSQL directe.\n');
    console.log('📋 UTILISEZ CETTE MÉTHODE:\n');
    console.log('   1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('   2. Copiez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('   3. Collez et exécutez\n');
    
    throw new Error('Application automatique nécessite Supabase CLI ou connexion PostgreSQL directe');
    
  } catch (apiError) {
    if (!apiError.message.includes('Application automatique')) {
      console.error('❌ Erreur API:', apiError.message);
    }
  }

  // Si tout échoue, afficher les instructions
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📋 INSTRUCTIONS D\'APPLICATION MANUELLE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Le fichier SQL est prêt: APPLY_FIX_WORKFLOW_NOW.sql\n');
  console.log('Étapes:');
  console.log('  1. Ouvrez https://supabase.com/dashboard');
  console.log('  2. Sélectionnez votre projet');
  console.log('  3. Allez dans SQL Editor');
  console.log('  4. Copiez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
  console.log('  5. Collez dans l\'éditeur');
  console.log('  6. Cliquez sur "Run" ou Ctrl+Enter\n');
  
  return false;
}

applyFix().then((success) => {
  if (success) {
    console.log('✅ Correction appliquée avec succès !\n');
    console.log('🧪 Testez maintenant la création d\'entreprise via le frontend.\n');
    process.exit(0);
  } else {
    console.log('⚠️ Application automatique non disponible.');
    console.log('   Veuillez suivre les instructions ci-dessus.\n');
    process.exit(0);
  }
}).catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});

