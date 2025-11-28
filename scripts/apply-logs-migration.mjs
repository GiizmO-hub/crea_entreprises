#!/usr/bin/env node

/**
 * Script pour appliquer la migration de logs via l'API Supabase
 * Usage: node scripts/apply-logs-migration.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vérifier les variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('');
  console.error('💡 Créez un fichier .env.local avec:');
  console.error('   SUPABASE_URL=votre_url_supabase');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key');
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

// Appliquer la migration via l'API Supabase
async function applyMigration() {
  try {
    console.log('⏳ Application de la migration...');
    
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      // Si exec_sql n'existe pas, essayer directement via l'endpoint SQL
      console.log('⚠️  Méthode RPC non disponible, tentative via endpoint SQL direct...');
      
      // Alternative: Utiliser l'endpoint SQL Editor de Supabase
      // Pour cela, il faut utiliser le dashboard manuellement ou l'API de migration
      console.log('');
      console.log('💡 Application manuelle nécessaire via le Dashboard Supabase:');
      console.log('   1. Allez sur: https://app.supabase.com/project/[votre-project]/sql');
      console.log('   2. Collez le contenu du fichier:');
      console.log(`      ${migrationFile}`);
      console.log('   3. Cliquez sur "Run"');
      console.log('');
      
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    console.log('✅ Migration appliquée avec succès !');
    console.log('');
    console.log('📋 Résultat:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('🎯 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier les logs dans Supabase Dashboard → Logs');
    console.log('   2. Tester la création d\'une entreprise');
    console.log('   3. Surveiller les logs NOTICE pour diagnostiquer les problèmes');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    console.error('');
    console.error('💡 Alternative: Appliquer manuellement via le Dashboard Supabase:');
    console.error('   1. Allez sur: https://app.supabase.com/project/[votre-project]/sql');
    console.error('   2. Collez le contenu du fichier:', migrationFile);
    console.error('   3. Cliquez sur "Run"');
    process.exit(1);
  }
}

applyMigration();


