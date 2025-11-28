#!/usr/bin/env node
/**
 * Script pour appliquer automatiquement la correction via Edge Function apply-migration
 * ou via connexion PostgreSQL directe si disponible
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

async function applyFix() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DE LA CORRECTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
  const sqlContent = readFileSync(sqlFile, 'utf8');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Méthode 1: Utiliser l'Edge Function apply-migration si elle existe
  console.log('🔍 Méthode 1: Edge Function apply-migration...\n');
  
  try {
    const { data, error } = await supabase.functions.invoke('apply-migration', {
      body: { sql: sqlContent }
    });

    if (!error && data?.success) {
      console.log('✅ Correction appliquée avec succès via Edge Function !\n');
      console.log(data);
      return true;
    } else {
      console.log('⚠️ Edge Function non disponible ou erreur\n');
    }
  } catch (e) {
    console.log('⚠️ Edge Function non disponible\n');
  }

  // Méthode 2: Utiliser l'API Management de Supabase (si disponible)
  console.log('🔍 Méthode 2: API Management Supabase...\n');
  
  try {
    // Essayer d'utiliser l'endpoint SQL Management
    const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql: sqlContent })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Correction appliquée via API Management !\n');
      console.log(result);
      return true;
    } else {
      console.log('⚠️ API Management non disponible\n');
    }
  } catch (e) {
    console.log('⚠️ API Management non disponible\n');
  }

  // Méthode 3: Utiliser pg directement si DATABASE_URL est disponible
  console.log('🔍 Méthode 3: Connexion PostgreSQL directe...\n');
  
  try {
    const { Pool } = await import('pg');
    const dbUrl = process.env.DATABASE_URL;
    
    if (dbUrl) {
      console.log('📡 Connexion à PostgreSQL...\n');
      const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      
      const result = await pool.query(sqlContent);
      console.log('✅ Correction appliquée via PostgreSQL direct !\n');
      
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => console.log('   →', row));
      }
      
      await pool.end();
      return true;
    } else {
      console.log('⚠️ DATABASE_URL non trouvé dans .env\n');
      console.log('💡 Pour obtenir DATABASE_URL:');
      console.log('   Supabase Dashboard → Settings → Database → Connection String\n');
    }
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️ Module pg non disponible\n');
    } else {
      console.log('⚠️ Erreur connexion PostgreSQL:', e.message, '\n');
    }
  }

  // Si toutes les méthodes échouent
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📋 APPLICATION MANUELLE REQUISE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Le fichier SQL est prêt:\n');
  console.log('   📄 APPLY_FIX_WORKFLOW_NOW.sql\n');
  console.log('Pour l\'appliquer:\n');
  console.log('   1. Ouvrez https://supabase.com/dashboard');
  console.log('   2. Sélectionnez votre projet');
  console.log('   3. SQL Editor (menu de gauche)');
  console.log('   4. Nouvelle requête');
  console.log('   5. Copiez-collez le contenu de APPLY_FIX_WORKFLOW_NOW.sql');
  console.log('   6. Cliquez sur "Run" (ou Ctrl+Enter)\n');
  
  return false;
}

applyFix().then((success) => {
  if (success) {
    console.log('🧪 Testez maintenant la création d\'entreprise via le frontend !\n');
  }
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});

