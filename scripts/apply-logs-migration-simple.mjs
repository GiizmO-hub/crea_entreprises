#!/usr/bin/env node

/**
 * Script simple pour appliquer la migration de logs
 * Utilise l'API REST native de Node.js (fetch disponible depuis Node 18+)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Application automatique de la migration de logs...\n');

if (!SUPABASE_URL) {
  console.error('❌ Erreur: SUPABASE_URL ou VITE_SUPABASE_URL non trouvé');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erreur: SUPABASE_SERVICE_ROLE_KEY non trouvé dans .env');
  console.error('\n💡 Pour obtenir votre SERVICE_ROLE_KEY:');
  console.error('   1. Allez sur Supabase Dashboard → Settings → API');
  console.error('   2. Copiez la "service_role" key');
  console.error('   3. Ajoutez dans .env: SUPABASE_SERVICE_ROLE_KEY=votre_key\n');
  console.error('⚠️  OU appliquez la migration manuellement via le Dashboard');
  console.error('   (Voir INSTRUCTIONS_APPLY_LOGS_MIGRATION.md)\n');
  process.exit(1);
}

// Lire la migration
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000039_add_detailed_logs_workflow.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Fichier non trouvé: ${migrationFile}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

console.log('📄 Migration: 20250123000039_add_detailed_logs_workflow.sql');
console.log('📊 Taille:', (migrationSQL.length / 1024).toFixed(2), 'KB');
console.log('🔗 URL:', SUPABASE_URL.replace(/\/$/, ''));
console.log('');

// Appliquer via l'API Supabase PostgREST
async function applyMigration() {
  try {
    console.log('⏳ Application de la migration...\n');
    
    // Utiliser l'endpoint REST API pour exécuter le SQL
    // Supabase expose un endpoint pour exécuter du SQL directement via l'API Management
    // Mais pour l'instant, on va utiliser une méthode alternative via une fonction RPC
    
    // Méthode: Créer une fonction RPC temporaire qui exécute le SQL
    // Ou utiliser directement l'endpoint SQL Editor API si disponible
    
    // Pour l'instant, la meilleure méthode est d'utiliser le client Supabase JS
    // avec le service_role_key pour exécuter directement
    
    // Alternative: Utiliser psql via subprocess si disponible
    // Ou générer un fichier temporaire et donner des instructions
    
    console.log('⚠️  Application automatique via API non disponible dans cette configuration.');
    console.log('\n💡 SOLUTION RECOMMANDÉE - Application manuelle via Dashboard:\n');
    console.log('   1. Ouvrez: https://app.supabase.com');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Allez dans: SQL Editor → New query');
    console.log('   4. Ouvrez le fichier:');
    console.log(`      ${migrationFile}`);
    console.log('   5. Copiez tout le contenu (Ctrl+A / Cmd+A)');
    console.log('   6. Collez dans SQL Editor (Ctrl+V / Cmd+V)');
    console.log('   7. Cliquez sur "Run" (ou Ctrl+Enter)\n');
    
    console.log('📋 OU utilisez cette commande curl si vous avez accès:\n');
    console.log(`   curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \\`);
    console.log(`     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}..." \\`);
    console.log(`     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}..." \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"sql": "'"'"'$(cat ${migrationFile} | tr "'"'"' "'"'"'"'"'"')'"'"'"}'`);
    console.log('\n⚠️  Note: La fonction RPC exec_sql doit exister dans votre projet.\n');
    
    // Créer un script shell alternatif
    const shellScript = `#!/bin/bash
# Script pour appliquer la migration via curl

SUPABASE_URL="${SUPABASE_URL}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
MIGRATION_FILE="${migrationFile}"

echo "🚀 Application de la migration..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \\
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"sql\\": $(cat "$MIGRATION_FILE" | jq -Rs .)}"

echo ""
echo "✅ Migration appliquée (ou erreur si fonction exec_sql n'existe pas)"
`;

    const shellScriptPath = path.join(__dirname, 'apply-migration.sh');
    fs.writeFileSync(shellScriptPath, shellScript);
    fs.chmodSync(shellScriptPath, 0o755);
    
    console.log(`💡 Script shell créé: ${shellScriptPath}`);
    console.log(`   Exécutez: bash ${shellScriptPath}\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n💡 Utilisez l\'application manuelle via Dashboard Supabase\n');
    process.exit(1);
  }
}

applyMigration();


