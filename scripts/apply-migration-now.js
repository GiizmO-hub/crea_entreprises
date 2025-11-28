/**
 * Script pour appliquer la migration de diagnostic directement
 * Utilise l'API Supabase REST avec SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

console.log('🚀 Application de la migration de diagnostic...\n');

// Créer le client Supabase avec SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    // Lire le fichier de migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
    console.log('📄 Lecture de la migration:', migrationPath);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration chargée (' + migrationSQL.length + ' caractères)\n');

    // Diviser le SQL en instructions séparées (par point-virgule)
    // Mais garder les blocs DO $$ ... $$ intacts
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    let dollarQuote = '';

    const lines = migrationSQL.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentStatement += line + '\n';

      // Détecter les blocs DO $$
      if (line.match(/^\s*DO\s+\$\$/i)) {
        inDoBlock = true;
        dollarQuote = '$$';
      } else if (line.match(/^\s*DO\s+\$([a-zA-Z_]*)\$/i)) {
        const match = line.match(/\$([a-zA-Z_]*)\$/);
        if (match) {
          inDoBlock = true;
          dollarQuote = '$' + match[1] + '$';
        }
      }

      // Détecter la fin d'un bloc DO $$
      if (inDoBlock && line.includes(dollarQuote + ';')) {
        inDoBlock = false;
        dollarQuote = '';
      }

      // Si on n'est pas dans un bloc DO et qu'on trouve un point-virgule, c'est une instruction
      if (!inDoBlock && line.trim().endsWith(';')) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
          currentStatement = '';
        }
      }
    }

    // Ajouter la dernière instruction si elle existe
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`📝 ${statements.length} instructions SQL détectées\n`);

    // Exécuter chaque instruction via RPC exec_sql ou directement
    console.log('🔄 Exécution de la migration...\n');

    // Essayer d'abord via une fonction RPC exec_sql si elle existe
    // Sinon, exécuter directement via l'API REST
    
    // Pour l'instant, on va utiliser une approche plus simple :
    // Utiliser l'API REST avec une requête SQL directe
    
    // Note: Supabase n'a pas d'API REST directe pour exécuter du SQL arbitraire
    // Il faut utiliser soit:
    // 1. Supabase CLI (supabase db push)
    // 2. Connection PostgreSQL directe
    // 3. Exécuter manuellement via Dashboard
    
    console.log('⚠️  L\'API Supabase REST ne permet pas d\'exécuter du SQL arbitraire directement.');
    console.log('💡 SOLUTION: Appliquez la migration via le Dashboard Supabase');
    console.log('');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('2. Copiez le contenu du fichier:');
    console.log('   ', migrationPath);
    console.log('3. Collez dans l\'éditeur SQL');
    console.log('4. Cliquez sur "Run"');
    console.log('');
    console.log('✅ Alternative: Utilisez Supabase CLI');
    console.log('   supabase db push');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

applyMigration();


