/**
 * Script pour appliquer la migration de diagnostic via Supabase API
 * 
 * Usage: node scripts/apply-diagnostic-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env
config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  console.log('\n💡 Ajoutez ces variables dans votre fichier .env');
  process.exit(1);
}

console.log('🚀 Application de la migration de diagnostic...\n');

// Créer le client Supabase avec SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    // Lire la migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
    console.log('📄 Lecture de la migration:', migrationPath);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration chargée (' + migrationSQL.length + ' caractères)\n');

    // La migration contient plusieurs instructions SQL séparées
    // On va les exécuter une par une via RPC si possible
    // Sinon, on utilise une fonction RPC qui exécute du SQL
    
    console.log('🔄 Tentative d\'application via API Supabase...\n');
    
    // Essayer d'abord de créer une fonction RPC temporaire qui exécute le SQL
    // Puis l'appeler avec le SQL de la migration
    
    // Note: Supabase ne permet pas d'exécuter du SQL arbitraire directement via l'API REST
    // Il faut utiliser soit:
    // 1. Une connexion PostgreSQL directe (nécessite DATABASE_URL)
    // 2. Le Dashboard Supabase SQL Editor
    // 3. Supabase CLI (supabase db push)
    
    console.log('⚠️  L\'API Supabase REST ne permet pas d\'exécuter du SQL arbitraire directement.\n');
    console.log('💡 SOLUTION: Appliquez la migration via le Dashboard Supabase\n');
    console.log('📋 ÉTAPES:');
    console.log('   1. Ouvrez: https://supabase.com/dashboard');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Cliquez sur "SQL Editor" dans le menu gauche');
    console.log('   4. Cliquez sur "New Query"');
    console.log('   5. Ouvrez le fichier:');
    console.log('      ' + migrationPath);
    console.log('   6. Copiez tout le contenu (Cmd+A puis Cmd+C)');
    console.log('   7. Collez dans l\'éditeur SQL (Cmd+V)');
    console.log('   8. Cliquez sur "Run" (ou appuyez sur Cmd+Enter)\n');
    
    console.log('✅ Après application, testez avec:');
    console.log('   SELECT test_diagnostic_rapide();\n');
    
    // Alternative: Si on a DATABASE_URL, on peut utiliser pg directement
    const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (databaseUrl) {
      console.log('💡 DATABASE_URL détecté. Tentative via connexion PostgreSQL directe...\n');
      
      try {
        // Importer pg dynamiquement
        const { default: pg } = await import('pg');
        const { Client } = pg;
        
        // Extraire les infos de connexion
        const urlObj = new URL(databaseUrl);
        const client = new Client({
          host: urlObj.hostname,
          port: parseInt(urlObj.port || '5432'),
          database: urlObj.pathname.slice(1) || 'postgres',
          user: urlObj.username || 'postgres',
          password: urlObj.password || '',
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        console.log('✅ Connecté à PostgreSQL\n');
        
        console.log('🔄 Exécution de la migration...\n');
        await client.query(migrationSQL);
        
        console.log('✅ Migration appliquée avec succès !\n');
        
        // Exécuter le diagnostic
        console.log('🔍 Exécution du diagnostic...\n');
        const result = await client.query('SELECT test_diagnostic_rapide()');
        console.log(result.rows[0].test_diagnostic_rapide);
        console.log('');
        
        await client.end();
        console.log('✅ Terminé !\n');
        
      } catch (pgError) {
        console.error('❌ Erreur lors de la connexion PostgreSQL:', pgError.message);
        console.log('\n💡 Utilisez la méthode Dashboard Supabase ci-dessus\n');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n💡 Utilisez la méthode Dashboard Supabase:\n');
    console.log('   1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('   2. Copiez-collez le contenu de la migration');
    console.log('   3. Exécutez\n');
  }
}

applyMigration().catch(console.error);


