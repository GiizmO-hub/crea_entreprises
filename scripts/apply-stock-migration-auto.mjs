/**
 * Script pour appliquer automatiquement la migration du module Gestion de Stock
 * Utilise l'API Supabase Management pour exécuter le SQL directement
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
  console.error('\n📋 Pour appliquer manuellement:');
  console.error('   1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
  console.error('   2. Ouvrez le fichier: APPLY_STOCK_MIGRATION_NOW.sql');
  console.error('   3. Copiez tout (Cmd+A, Cmd+C)');
  console.error('   4. Collez dans l\'éditeur SQL (Cmd+V)');
  console.error('   5. Cliquez sur "Run"\n');
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
  const migrationFile = path.join(__dirname, '..', 'APPLY_STOCK_MIGRATION_NOW.sql');
  
  console.log(`📄 Lecture du fichier: ${migrationFile}\n`);

  let sqlContent;
  try {
    sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);
  } catch (error) {
    console.error('❌ Erreur lecture fichier:', error.message);
    process.exit(1);
  }

  // Créer une fonction RPC temporaire pour exécuter le SQL
  console.log('⏳ Création d\'une fonction RPC temporaire...\n');

  const createExecFunctionSQL = `
CREATE OR REPLACE FUNCTION exec_sql_temp(p_sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'OK';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$;
`;

  try {
    // Essayer d'exécuter via une requête directe
    // Note: Supabase REST API ne permet pas d'exécuter du SQL arbitraire
    // On va utiliser l'API Management si disponible
    
    console.log('⚠️  L\'API REST Supabase ne permet pas l\'exécution SQL directe.');
    console.log('📋 Tentative via Edge Function ou connexion directe...\n');

    // Méthode alternative: Utiliser l'endpoint SQL Editor API
    const projectRef = 'ewlozuwvrteopotfizcr';
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/sql`;

    console.log('📡 Tentative via API Management Supabase...\n');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        query: sqlContent
      })
    }).catch(() => null);

    if (response && response.ok) {
      const result = await response.json();
      console.log('✅ Migration appliquée avec succès via API Management !\n');
      console.log('📋 Résultat:', JSON.stringify(result, null, 2).substring(0, 500));
      return;
    }

    // Si l'API Management ne fonctionne pas, utiliser une Edge Function
    console.log('⚠️  API Management non disponible, tentative via Edge Function...\n');

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/apply-migration`;
    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        sql: sqlContent
      })
    }).catch(() => null);

    if (edgeResponse && edgeResponse.ok) {
      const result = await edgeResponse.json();
      console.log('✅ Migration appliquée avec succès via Edge Function !\n');
      console.log('📋 Résultat:', JSON.stringify(result, null, 2).substring(0, 500));
      return;
    }

    // Si tout échoue, afficher les instructions manuelles
    console.log('⚠️  Application automatique non disponible.\n');
    console.log('📋 APPLICATION MANUELLE REQUISE:\n');
    console.log('   1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
    console.log('   2. Ouvrez le fichier: APPLY_STOCK_MIGRATION_NOW.sql');
    console.log('   3. Copiez tout (Cmd+A, Cmd+C)');
    console.log('   4. Collez dans l\'éditeur SQL (Cmd+V)');
    console.log('   5. Cliquez sur "Run"\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n📋 APPLICATION MANUELLE REQUISE (voir instructions ci-dessus)\n');
  }

  // Vérifier si le module existe déjà
  console.log('🔍 Vérification du module...\n');
  
  try {
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
  } catch (error) {
    console.error('⚠️  Erreur vérification:', error.message);
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

