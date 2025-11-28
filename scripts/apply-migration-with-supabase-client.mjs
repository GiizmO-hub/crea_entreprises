#!/usr/bin/env node

/**
 * Script pour appliquer la migration en utilisant le client Supabase du projet
 * Nécessite: @supabase/supabase-js installé
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY' || key === 'VITE_SUPABASE_SERVICE_ROLE_KEY') {
        SUPABASE_SERVICE_ROLE_KEY = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Application automatique de la migration de logs...\n');

if (!SUPABASE_URL) {
  console.error('❌ Erreur: SUPABASE_URL non trouvé dans .env');
  process.exit(1);
}

// Lire la migration
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000039_add_detailed_logs_workflow.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');

console.log('📄 Migration: 20250123000039_add_detailed_logs_workflow.sql');
console.log('📊 Taille:', (migrationSQL.length / 1024).toFixed(2), 'KB');
console.log('🔗 URL:', SUPABASE_URL.replace(/\/$/, ''));
console.log('');

async function applyMigration() {
  try {
    // Si on a la service_role_key, créer un client avec les privilèges admin
    if (SUPABASE_SERVICE_ROLE_KEY) {
      console.log('✅ Service Role Key trouvée, utilisation du client admin...\n');
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      console.log('⏳ Application de la migration...\n');
      
      // Exécuter le SQL via RPC exec_sql si disponible
      // Sinon, utiliser directement l'API REST
      const response = await supabase.rpc('exec_sql', { sql: migrationSQL });
      
      if (response.error) {
        // La fonction exec_sql n'existe peut-être pas
        console.log('⚠️  Fonction exec_sql non disponible, tentative alternative...\n');
        
        // Utiliser l'API REST directement
        const apiResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql: migrationSQL })
        });
        
        if (apiResponse.ok) {
          console.log('✅ Migration appliquée avec succès via API REST !\n');
          const result = await apiResponse.text();
          console.log('📋 Résultat:', result.substring(0, 500));
          return;
        } else {
          const errorText = await apiResponse.text();
          console.log('⚠️  Erreur API:', errorText.substring(0, 300));
        }
      } else {
        console.log('✅ Migration appliquée avec succès !\n');
        console.log('📋 Résultat:', JSON.stringify(response.data, null, 2));
        return;
      }
    }
    
    // Si on arrive ici, l'application automatique n'a pas fonctionné
    console.log('⚠️  Application automatique via API non disponible.\n');
    console.log('💡 APPLICATION MANUELLE RECOMMANDÉE:\n');
    console.log('   1. Ouvrez: https://app.supabase.com');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Allez dans: SQL Editor → New query');
    console.log('   4. Ouvrez le fichier:');
    console.log(`      ${migrationFile}`);
    console.log('   5. Copiez tout le contenu (Ctrl+A / Cmd+A)');
    console.log('   6. Collez dans SQL Editor (Ctrl+V / Cmd+V)');
    console.log('   7. Cliquez sur "Run" (ou Ctrl+Enter)\n');
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.log('💡 Pour activer l\'application automatique:');
      console.log('   1. Allez sur Supabase Dashboard → Settings → API');
      console.log('   2. Copiez la "service_role" key');
      console.log('   3. Ajoutez dans .env: SUPABASE_SERVICE_ROLE_KEY=votre_key\n');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n💡 Utilisez l\'application manuelle via Dashboard Supabase\n');
    process.exit(1);
  }
}

applyMigration();


