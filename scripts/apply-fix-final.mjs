#!/usr/bin/env node
/**
 * Script final pour appliquer la correction
 * Essaie plusieurs méthodes automatiquement
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
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
  let sqlContent = readFileSync(sqlFile, 'utf8');

  // Méthode 1: Supabase CLI (la plus simple)
  console.log('🔍 Méthode 1: Supabase CLI...\n');
  
  try {
    execSync('which supabase', { stdio: 'ignore' });
    console.log('✅ Supabase CLI trouvé !\n');
    
    // Créer un fichier temporaire dans supabase/migrations
    const tempMigration = join(__dirname, '../supabase/migrations/temp_fix_on_conflict.sql');
    writeFileSync(tempMigration, sqlContent);
    
    console.log('📝 Application via migration temporaire...\n');
    
    execSync(
      `cd ${join(__dirname, '..')} && npx supabase db push`,
      { stdio: 'inherit', cwd: join(__dirname, '..') }
    );
    
    // Nettoyer
    unlinkSync(tempMigration);
    
    console.log('\n✅ Correction appliquée avec succès !\n');
    return true;
    
  } catch (cliError) {
    console.log('⚠️ Supabase CLI non disponible ou erreur\n');
  }

  // Méthode 2: Via API REST en créant une Edge Function temporaire
  if (supabaseUrl && supabaseServiceKey) {
    console.log('🔍 Méthode 2: API REST Supabase...\n');
    
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Diviser le SQL en parties exécutables (par $$)
      // La fonction est entre CREATE OR REPLACE FUNCTION et $$;
      const parts = sqlContent.split('$$');
      
      if (parts.length >= 3) {
        const functionDef = parts[0] + '$$' + parts[1] + '$$;';
        
        // Créer une Edge Function qui exécute ce SQL
        // Mais c'est complexe, on passe à la méthode manuelle
        
        console.log('⚠️ Exécution SQL via API REST non disponible directement\n');
      }
    } catch (apiError) {
      console.log('⚠️ Erreur API:', apiError.message, '\n');
    }
  }

  // Si tout échoue, afficher les instructions
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📋 APPLICATION MANUELLE NÉCESSAIRE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Le fichier SQL est prêt:\n');
  console.log('   📄 APPLY_FIX_WORKFLOW_NOW.sql\n');
  console.log('Pour l\'appliquer:\n');
  console.log('   1. Ouvrez https://supabase.com/dashboard');
  console.log('   2. Sélectionnez votre projet');
  console.log('   3. SQL Editor (dans le menu de gauche)');
  console.log('   4. Nouvelle requête');
  console.log('   5. Copiez-collez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
  console.log('   6. Cliquez sur "Run" (ou Ctrl+Enter)\n');
  
  return false;
}

applyFix().then((success) => {
  if (success) {
    console.log('🧪 Testez maintenant la création d\'entreprise via le frontend !\n');
  }
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});

