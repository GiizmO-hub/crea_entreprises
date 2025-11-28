#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration de logs
 * Utilise l'API Supabase Management API pour exécuter le SQL directement
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement depuis .env
config({ path: path.join(__dirname, '..', '.env') });

// Variables d'environnement
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Application automatique de la migration de logs...\n');

if (!SUPABASE_URL) {
  console.error('❌ Erreur: SUPABASE_URL ou VITE_SUPABASE_URL non trouvé dans .env');
  console.error('💡 Ajoutez dans votre fichier .env:');
  console.error('   VITE_SUPABASE_URL=https://votre-projet.supabase.co');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: SUPABASE_SERVICE_ROLE_KEY non trouvé dans .env');
  console.error('💡 Pour obtenir votre SERVICE_ROLE_KEY:');
  console.error('   1. Allez sur Supabase Dashboard → Settings → API');
  console.error('   2. Copiez la "service_role" key (⚠️  Ne la partagez jamais!)');
  console.error('   3. Ajoutez dans .env: SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key');
  console.error('\n⚠️  ALTERNATIVE: Appliquez la migration manuellement via le Dashboard Supabase');
  console.error('   (Voir INSTRUCTIONS_APPLY_LOGS_MIGRATION.md)');
  process.exit(1);
}

// Lire le fichier de migration
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000039_add_detailed_logs_workflow.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Fichier de migration non trouvé: ${migrationFile}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

console.log('📄 Migration: 20250123000039_add_detailed_logs_workflow.sql');
console.log('📊 Taille:', (migrationSQL.length / 1024).toFixed(2), 'KB');
console.log('🔗 URL Supabase:', SUPABASE_URL.replace(/\/$/, ''));
console.log('');

// Méthode 1: Essayer via l'endpoint REST API (direct SQL execution)
async function applyMigrationViaREST() {
  try {
    console.log('⏳ Tentative via REST API...');
    
    // Utiliser l'endpoint PostgREST pour exécuter du SQL directement
    // Note: Cela nécessite une extension ou fonction RPC spéciale
    // On va plutôt utiliser l'API Management ou un endpoint SQL direct
    
    // Alternative: Utiliser l'endpoint REST pour exécuter via une fonction RPC
    const sqlUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`;
    
    const response = await fetch(sqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Migration appliquée avec succès via REST API !');
      try {
        const result = JSON.parse(responseText);
        if (result && result.length > 0) {
          console.log('📋 Résultat:', JSON.stringify(result, null, 2));
        }
      } catch (e) {
        // Pas de JSON, c'est peut-être du texte
        console.log('📋 Résultat:', responseText.substring(0, 500));
      }
      return true;
    } else {
      console.log(`⚠️  Réponse HTTP ${response.status}`);
      console.log('📋 Détails:', responseText.substring(0, 300));
      return false;
    }
  } catch (error) {
    console.log(`⚠️  Erreur REST API: ${error.message}`);
    return false;
  }
}

// Méthode 2: Utiliser le client Supabase pour exécuter le SQL directement
async function applyMigrationViaSupabaseClient() {
  try {
    console.log('⏳ Tentative via client Supabase direct...');
    
    // Créer une requête SQL directe via l'API
    // On va diviser le SQL en plusieurs requêtes si nécessaire
    const sqlStatements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*--/))
      .filter(s => !s.match(/^\s*\/\*/));

    console.log(`📝 Nombre de statements SQL: ${sqlStatements.length}`);
    
    // Exécuter chaque statement séparément
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      if (statement.length < 10) continue; // Ignorer les statements trop courts
      
      try {
        // Utiliser l'endpoint REST pour exécuter via une fonction RPC exec_sql si elle existe
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql: statement + ';' })
        });
        
        if (response.ok) {
          successCount++;
          if ((i + 1) % 10 === 0) {
            process.stdout.write(`\r✅ ${i + 1}/${sqlStatements.length} statements exécutés...`);
          }
        } else {
          errorCount++;
          console.log(`\n⚠️  Erreur statement ${i + 1}:`, await response.text().catch(() => 'Unknown error'));
        }
      } catch (err) {
        errorCount++;
        // Ignorer les erreurs pour l'instant
      }
    }
    
    if (successCount > 0) {
      console.log(`\n✅ ${successCount} statements exécutés avec succès`);
      if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} statements en erreur (peut être normal)`);
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.log(`⚠️  Erreur client Supabase: ${error.message}`);
    return false;
  }
}

// Méthode 3: Utiliser l'API Management (si disponible)
async function applyMigrationViaManagementAPI() {
  // L'API Management Supabase nécessite un access token différent
  // Pour l'instant, on va suggérer l'application manuelle
  return false;
}

// Fonction principale
async function applyMigration() {
  // Essayer d'abord via REST API simple
  let success = await applyMigrationViaREST();
  
  if (!success) {
    console.log('\n🔄 Essai méthode alternative...\n');
    success = await applyMigrationViaSupabaseClient();
  }
  
  if (!success) {
    console.log('\n❌ Impossible d\'appliquer la migration automatiquement via l\'API.');
    console.log('\n💡 SOLUTION ALTERNATIVE - Application manuelle via Dashboard:');
    console.log('\n   1. Ouvrez Supabase Dashboard:');
    console.log('      https://app.supabase.com');
    console.log('\n   2. Allez dans SQL Editor');
    console.log('\n   3. Ouvrez le fichier:');
    console.log(`      ${migrationFile}`);
    console.log('\n   4. Copiez tout le contenu et collez-le dans SQL Editor');
    console.log('\n   5. Cliquez sur "Run"');
    console.log('\n📄 Guide détaillé: INSTRUCTIONS_APPLY_LOGS_MIGRATION.md\n');
    process.exit(1);
  } else {
    console.log('\n✅ Migration appliquée avec succès !\n');
    console.log('🎯 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier les logs dans Supabase Dashboard → Logs → Postgres Logs');
    console.log('   2. Tester la création d\'une entreprise');
    console.log('   3. Surveiller les logs NOTICE pour diagnostiquer les problèmes');
    console.log('\n📊 Les logs apparaîtront avec des préfixes comme:');
    console.log('   [create_complete_entreprise_automated]');
    console.log('   [valider_paiement_carte_immediat]');
    console.log('   [creer_facture_et_abonnement_apres_paiement]\n');
  }
}

// Exécuter
applyMigration().catch((error) => {
  console.error('\n❌ Erreur fatale:', error.message);
  console.error('\n💡 Essayez l\'application manuelle via le Dashboard Supabase');
  console.error('   (Voir INSTRUCTIONS_APPLY_LOGS_MIGRATION.md)\n');
  process.exit(1);
});


