import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   Besoin de: VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n📋 Pour appliquer manuellement:');
  console.error('   1. Ouvrez le Dashboard Supabase');
  console.error('   2. Allez dans "SQL Editor"');
  console.error('   3. Copiez-collez le contenu des migrations');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applySQL(sql) {
  // Diviser le SQL en blocs (séparés par ;)
  const blocks = sql.split(';').filter(b => b.trim().length > 0);
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim() + ';';
    
    try {
      // Utiliser l'API REST directement
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql_query: block })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      // Si exec_sql n'existe pas, afficher les instructions
      console.error(`\n❌ Impossible d'appliquer automatiquement via l'API`);
      console.error(`   ${error.message}\n`);
      return false;
    }
  }
  
  return true;
}

async function applyMigration(filename) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 Migration: ${filename}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const filePath = join(process.cwd(), 'supabase', 'migrations', filename);
    const sql = readFileSync(filePath, 'utf-8');
    
    console.log(`✅ Fichier lu: ${filePath}`);
    
    const success = await applySQL(sql);
    
    if (success) {
      console.log(`✅ Migration appliquée avec succès !\n`);
      return true;
    } else {
      throw new Error('Échec de l\'application');
    }

  } catch (error) {
    console.error(`❌ Erreur: ${error.message}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 INSTRUCTIONS MANUELLES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`1. Ouvrez: https://supabase.com/dashboard/project/_/sql`);
    console.log(`2. Copiez le contenu de: supabase/migrations/${filename}`);
    console.log(`3. Collez dans l'éditeur SQL`);
    console.log(`4. Cliquez sur "Run"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return false;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 APPLICATION AUTOMATIQUE DES MIGRATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const migrations = [
    '20250130000002_fix_rls_clients_can_view_their_enterprise.sql',
    '20250130000003_sync_all_client_modules_from_subscriptions.sql'
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Migrations réussies: ${successCount}/${migrations.length}`);
  console.log(`❌ Migrations échouées: ${errorCount}/${migrations.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errorCount > 0) {
    console.log('⚠️  Veuillez appliquer les migrations manuellement via le Dashboard Supabase.');
  }
}

main();
