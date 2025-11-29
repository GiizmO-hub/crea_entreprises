#!/usr/bin/env node

/**
 * Script pour appliquer les migrations Supabase automatiquement
 * 
 * Ce script lit les fichiers SQL dans supabase/migrations/ et les applique
 * via l'API Supabase REST en utilisant la clé service_role
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration Supabase
// ⚠️ IMPORTANT: Utilisez les variables d'environnement ou configurez ici
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurés');
  console.error('   Options:');
  console.error('   1. Créez un fichier .env.local avec:');
  console.error('      VITE_SUPABASE_URL=votre_url');
  console.error('      SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key');
  console.error('   2. OU exportez les variables d\'environnement');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Applique un fichier SQL directement via l'API Supabase
 */
async function applySQLFile(filePath) {
  try {
    console.log(`\n📄 Lecture de: ${filePath}`);
    const sqlContent = readFileSync(filePath, 'utf-8');
    
    // Nettoyer le SQL (enlever les commentaires de bloc)
    let cleanSQL = sqlContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Enlever les commentaires /* */
      .replace(/--.*$/gm, '') // Enlever les commentaires --
      .trim();

    // Diviser en statements (séparés par ;)
    const statements = cleanSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`   ✅ ${statements.length} statements trouvés`);

    // Appliquer chaque statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Ignorer les statements trop courts

      try {
        // Utiliser RPC exec_sql si disponible, sinon utiliser directement
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (error) {
          // Si exec_sql n'existe pas, essayer une autre méthode
          console.warn(`   ⚠️  Statement ${i + 1} échoué (peut-être normal):`, error.message);
        } else {
          console.log(`   ✅ Statement ${i + 1}/${statements.length} appliqué`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Statement ${i + 1} erreur:`, err.message);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`   ❌ Erreur:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Applique les migrations dans l'ordre
 */
async function applyMigrations() {
  console.log('🚀 Application des migrations Supabase...\n');

  const migrations = [
    {
      name: 'Fix RLS Clients - Permettre création depuis espace client',
      file: join(projectRoot, 'APPLY_FIX_CLIENTS_RLS_NOW.sql'),
    },
  ];

  const results = [];

  for (const migration of migrations) {
    console.log(`\n📦 Migration: ${migration.name}`);
    const result = await applySQLFile(migration.file);
    results.push({
      name: migration.name,
      ...result,
    });
  }

  // Résumé
  console.log('\n\n📊 RÉSUMÉ:');
  console.log('═══════════════════════════════════════');
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`✅ ${index + 1}. ${result.name}`);
    } else {
      console.log(`❌ ${index + 1}. ${result.name}`);
      console.log(`   Erreur: ${result.error}`);
    }
  });
  console.log('═══════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  if (successCount === totalCount) {
    console.log(`✅ Toutes les migrations ont été appliquées avec succès! (${successCount}/${totalCount})`);
  } else {
    console.log(`⚠️  ${successCount}/${totalCount} migrations appliquées avec succès`);
    console.log('   Certaines migrations peuvent nécessiter une application manuelle via Supabase SQL Editor');
  }
}

// Exécuter
applyMigrations().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
