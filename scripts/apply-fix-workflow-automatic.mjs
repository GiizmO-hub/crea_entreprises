#!/usr/bin/env node
/**
 * Script pour appliquer automatiquement la correction du workflow
 * 
 * Applique la fonction create_complete_entreprise_automated corrigée
 * qui remplace ON CONFLICT par BEGIN/EXCEPTION
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   → VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   → SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFix() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DE LA CORRECTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Lire le fichier SQL
    const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('📄 Lecture du fichier SQL...');
    
    const sqlContent = readFileSync(sqlFile, 'utf8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);

    // Diviser le SQL en requêtes séparées (par point-virgule suivi de nouvelle ligne ou fin)
    // On va exécuter la fonction complète en une seule requête
    console.log('🔧 Application de la correction...');
    
    // Utiliser rpc pour exécuter du SQL personnalisé via une fonction temporaire
    // Ou utiliser directement supabase.rpc avec le SQL
    // Mais en fait, on doit utiliser l'API REST pour exécuter du SQL brut
    
    // Méthode: Utiliser fetch pour appeler l'API Supabase REST directement
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql: sqlContent })
    }).catch(async () => {
      // Si l'endpoint n'existe pas, on utilise une méthode alternative
      // On peut créer une fonction temporaire qui exécute le SQL
      console.log('⚠️ Méthode directe non disponible, utilisation alternative...');
      
      // Diviser le SQL en parties exécutables
      const functionDefinition = sqlContent.split('-- Vérification')[0]; // Tout sauf la vérification finale
      
      // Créer une fonction qui exécute notre SQL
      const execSql = `
        DO $$ 
        BEGIN
          ${functionDefinition}
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Erreur: %', SQLERRM;
          RAISE;
        END $$;
      `;
      
      // Utiliser l'API REST Supabase pour exécuter du SQL
      return fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: execSql })
      });
    });

    // Alternative: Utiliser directement l'API Management de Supabase si disponible
    // Sinon, on utilise une approche différente
    
    console.log('🔧 Tentative d\'application via API Supabase...\n');
    
    // On va exécuter la fonction CREATE OR REPLACE directement via une connexion SQL
    // Mais comme on n'a pas de connexion SQL directe, on va utiliser une méthode différente
    
    // MÉTHODE ALTERNATIVE : Exécuter via une fonction RPC temporaire
    // On crée une fonction qui exécute notre SQL
    
    console.log('✅ Préparation de l\'exécution SQL...');
    
    // Extraire juste la partie CREATE OR REPLACE FUNCTION
    const functionStart = sqlContent.indexOf('CREATE OR REPLACE FUNCTION');
    const functionEnd = sqlContent.lastIndexOf('$$;');
    
    if (functionStart === -1 || functionEnd === -1) {
      throw new Error('Impossible de trouver la définition de la fonction dans le SQL');
    }
    
    const functionSql = sqlContent.substring(functionStart, functionEnd + 3);
    
    console.log('📝 Exécution de la fonction corrigée...\n');
    
    // Utiliser supabase.rpc avec une fonction système PostgreSQL
    // Ou mieux: utiliser une requête directe via l'API REST
    
    // Pour Supabase, on peut utiliser le endpoint SQL directement via fetch
    // Mais cela nécessite l'API Management
    
    // ALTERNATIVE SIMPLE: Utiliser la méthode PostgREST pour exécuter via une fonction SQL
    // Créons une fonction temporaire qui exécute notre SQL
    
    const wrapperSql = `
      DO $$
      DECLARE
        v_sql text;
      BEGIN
        v_sql := $sql$
${functionSql.replace(/'/g, "''")}
        $sql$;
        EXECUTE v_sql;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de l''exécution: %', SQLERRM;
        RAISE;
      END $$;
    `;

    // On va plutôt utiliser une approche plus simple: exécuter directement la fonction
    // en la découpant en parties plus petites
    
    console.log('⚠️ L\'application automatique via API nécessite l\'API Management de Supabase.');
    console.log('   Ce qui n''est pas disponible via le client JavaScript standard.\n');
    
    console.log('📋 SOLUTION RECOMMANDÉE:');
    console.log('   1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('   2. Copiez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
    console.log('   3. Collez et exécutez\n');
    
    console.log('💡 OU utilisez Supabase CLI:\n');
    console.log('   npx supabase db push\n');
    
    // Vérifier si Supabase CLI est disponible
    console.log('🔍 Vérification de Supabase CLI...');
    const { execSync } = await import('child_process');
    
    try {
      execSync('which supabase', { stdio: 'ignore' });
      console.log('✅ Supabase CLI trouvé !\n');
      console.log('🚀 Tentative d\'application via CLI...\n');
      
      // Créer un fichier temporaire avec juste la fonction
      const tempFile = join(__dirname, '../temp_fix_function.sql');
      const fs = await import('fs');
      fs.writeFileSync(tempFile, functionSql);
      
      console.log('📝 Fichier temporaire créé, tentative via supabase CLI...');
      
      // Essayer d'appliquer via supabase db execute
      try {
        execSync(`cd ${join(__dirname, '..')} && npx supabase db execute --file ${tempFile}`, {
          stdio: 'inherit'
        });
        console.log('✅ Correction appliquée avec succès via Supabase CLI !\n');
        
        // Nettoyer
        fs.unlinkSync(tempFile);
        return;
      } catch (cliError) {
        console.log('⚠️ CLI non disponible ou erreur, utilisation manuelle recommandée\n');
        fs.unlinkSync(tempFile);
      }
    } catch (e) {
      console.log('⚠️ Supabase CLI non trouvé\n');
    }
    
    // Afficher le SQL à appliquer manuellement
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📋 SQL À APPLIQUER MANUELLEMENT');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Copiez ce SQL dans Supabase Dashboard → SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(functionSql.substring(0, 500) + '...\n');
    console.log('─'.repeat(60));
    console.log('\n📄 Fichier complet: APPLY_FIX_WORKFLOW_NOW.sql\n');
    
    throw new Error('Application automatique non disponible. Veuillez appliquer manuellement.');
    
  } catch (error) {
    if (error.message.includes('Application automatique non disponible')) {
      // C'est attendu, on affiche juste les instructions
      process.exit(0);
    }
    
    console.error('\n❌ ERREUR lors de l\'application:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Exécuter
applyFix().then(() => {
  console.log('✅ Processus terminé !\n');
}).catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});

