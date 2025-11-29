/**
 * Script pour appliquer automatiquement la migration du module Gestion de Stock
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration depuis les variables d'environnement
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY non définie dans les variables d\'environnement');
  console.error('💡 Ajoutez-la dans votre fichier .env.local ou .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🚀 APPLICATION AUTOMATIQUE - MODULE GESTION DE STOCK');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Lire le fichier SQL
  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000010_create_gestion_stock_module.sql');
  
  console.log(`📄 Lecture du fichier: ${migrationFile}\n`);

  let sqlContent;
  try {
    sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);
  } catch (error) {
    console.error('❌ Erreur lecture fichier:', error.message);
    process.exit(1);
  }

  // Diviser le SQL en instructions (en respectant les blocs DO $$ ... $$)
  const statements = [];
  let currentStatement = '';
  let inDoBlock = false;
  let dollarQuote = '';
  let depth = 0;

  const lines = sqlContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Détecter les blocs DO $$ ... $$
    if (line.trim().match(/^DO\s+\$\$/i)) {
      inDoBlock = true;
      dollarQuote = '$$';
      depth = 1;
      currentStatement += line + '\n';
      continue;
    }

    if (inDoBlock) {
      currentStatement += line + '\n';
      
      // Compter les $$ pour détecter la fin du bloc
      const matches = line.match(/\$\$/g);
      if (matches) {
        depth += matches.length;
        if (depth % 2 === 0) {
          // Fin du bloc DO
          statements.push(currentStatement.trim());
          currentStatement = '';
          inDoBlock = false;
          dollarQuote = '';
          depth = 0;
        }
      }
      continue;
    }

    // Instructions normales
    if (line.trim().endsWith(';') && !line.trim().startsWith('--')) {
      currentStatement += line;
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    } else if (line.trim()) {
      currentStatement += line + '\n';
    }
  }

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`📊 ${statements.length} instructions SQL détectées\n`);

  // Appliquer chaque instruction
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Ignorer les commentaires seuls
    if (statement.trim().startsWith('--') || !statement.trim()) {
      continue;
    }

    console.log(`⏳ Application instruction ${i + 1}/${statements.length}...`);

    try {
      // Utiliser rpc pour exécuter le SQL
      // Note: Supabase ne permet pas d'exécuter du SQL arbitraire via l'API REST
      // On va utiliser une approche alternative : créer une fonction temporaire
      
      // Pour les instructions CREATE TABLE, ALTER TABLE, etc., on doit utiliser
      // une connexion PostgreSQL directe ou une Edge Function
      
      // Solution: Utiliser l'API Management de Supabase si disponible
      // Sinon, on affiche les instructions pour application manuelle
      
      console.log('⚠️  L\'API REST Supabase ne permet pas l\'exécution SQL directe.');
      console.log('📋 Instructions prêtes pour application manuelle.\n');
      
      // Créer un fichier SQL prêt à appliquer
      const outputFile = path.join(__dirname, '..', 'APPLY_STOCK_MIGRATION_NOW.sql');
      fs.writeFileSync(outputFile, sqlContent);
      
      console.log('✅ Fichier SQL créé:', outputFile);
      console.log('\n📋 POUR APPLIQUER :');
      console.log('   1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
      console.log('   2. Ouvrez le fichier : APPLY_STOCK_MIGRATION_NOW.sql');
      console.log('   3. Copiez tout (Cmd+A, Cmd+C)');
      console.log('   4. Collez dans l\'éditeur SQL (Cmd+V)');
      console.log('   5. Cliquez sur "Run"\n');
      
      break;
      
    } catch (error) {
      console.error(`❌ Erreur instruction ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  // Vérifier si le module existe déjà
  console.log('🔍 Vérification du module...\n');
  
  const { data: module, error: moduleError } = await supabase
    .from('modules_activation')
    .select('*')
    .eq('module_code', 'gestion-stock')
    .maybeSingle();

  if (moduleError && moduleError.code !== 'PGRST116') {
    console.error('⚠️  Erreur vérification module:', moduleError.message);
  } else if (module) {
    console.log('✅ Module gestion-stock trouvé dans la base');
    console.log(`   - Nom: ${module.module_nom}`);
    console.log(`   - Créé: ${module.est_cree ? 'Oui' : 'Non'}`);
    console.log(`   - Actif: ${module.actif ? 'Oui' : 'Non'}\n`);
  } else {
    console.log('⚠️  Module gestion-stock non trouvé (sera créé par la migration)\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ SCRIPT TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Exécution
applyMigration().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

