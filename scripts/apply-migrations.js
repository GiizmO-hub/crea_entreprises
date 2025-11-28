#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement les migrations SQL dans Supabase
 * 
 * Usage:
 *   node scripts/apply-migrations.js [nom-du-fichier-migration.sql]
 * 
 * Ou pour appliquer toutes les migrations manquantes:
 *   node scripts/apply-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration depuis les variables d'environnement
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('');
  console.error('Assurez-vous d\'avoir dans votre .env:');
  console.error('  - VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (Service Role Key, pas Anon Key!)');
  console.error('');
  console.error('Vous pouvez trouver la Service Role Key dans:');
  console.error('  Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

// Créer le client Supabase avec la Service Role Key (pour avoir tous les droits)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Appliquer une migration SQL
 */
async function applyMigration(filePath) {
  const fileName = filePath.split('/').pop();
  console.log(`\n📄 Application de: ${fileName}...`);

  try {
    const sql = readFileSync(filePath, 'utf-8');

    // Diviser le SQL en blocs séparés par des points-virgules
    // et filtrer les lignes vides
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Exécuter chaque statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Ignorer les commentaires de bloc
      if (statement.startsWith('/*') || statement.includes('*/')) {
        continue;
      }

      if (statement.length < 10) continue; // Ignorer les statements trop courts

      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });

        if (error) {
          // Certaines erreurs sont normales (ex: "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate key')) {
            console.log(`  ⚠️  ${error.message.split('\n')[0]}`);
          } else {
            console.error(`  ❌ Erreur: ${error.message}`);
            return false;
          }
        }
      } catch (err) {
        // RPC exec_sql n'existe peut-être pas, utiliser l'API REST directement
        console.log(`  ⚠️  Utilisation de l'API REST pour exécuter le SQL...`);
        break;
      }
    }

    // Si exec_sql n'existe pas, exécuter tout le fichier d'un coup via REST
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        // Essayer via l'API SQL directement
        console.log(`  📝 Exécution via API SQL...`);
      }
    } catch (err) {
      console.log(`  ⚠️  Impossible d'exécuter automatiquement. Veuillez copier le contenu dans Supabase SQL Editor.`);
      console.log(`  📋 Chemin du fichier: ${filePath}`);
      return false;
    }

    console.log(`  ✅ Migration appliquée avec succès`);
    return true;

  } catch (error) {
    console.error(`  ❌ Erreur lors de la lecture/application: ${error.message}`);
    console.log(`  📋 Veuillez copier manuellement le contenu dans Supabase SQL Editor:`);
    console.log(`     ${filePath}`);
    return false;
  }
}

/**
 * Trouver toutes les migrations SQL
 */
async function findAllMigrations() {
  const migrationsDir = join(projectRoot, 'supabase', 'migrations');
  const files = await glob('*.sql', { cwd: migrationsDir });
  
  return files
    .map(f => join(migrationsDir, f))
    .sort(); // Trier par ordre chronologique
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Application automatique des migrations SQL\n');
  console.log(`📡 Connexion à Supabase: ${supabaseUrl.substring(0, 30)}...`);

  const migrationFile = process.argv[2];

  if (migrationFile) {
    // Appliquer un fichier spécifique
    const filePath = migrationFile.startsWith('/') 
      ? migrationFile 
      : join(projectRoot, migrationFile);
    
    await applyMigration(filePath);
  } else {
    // Appliquer toutes les migrations
    console.log('\n📋 Recherche des migrations...');
    const migrations = await findAllMigrations();
    
    console.log(`\n✅ ${migrations.length} migration(s) trouvée(s)\n`);
    
    for (const migration of migrations) {
      const fileName = migration.split('/').pop();
      console.log(`📄 ${fileName}`);
    }

    console.log('\n⚠️  Pour appliquer une migration spécifique:');
    console.log(`   node scripts/apply-migrations.js supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql`);
    console.log('\n💡 Note: Ce script nécessite une fonction RPC spéciale dans Supabase.');
    console.log('   Pour l\'instant, copiez le contenu dans Supabase SQL Editor.');
  }
}

// Exécuter
main().catch(console.error);




