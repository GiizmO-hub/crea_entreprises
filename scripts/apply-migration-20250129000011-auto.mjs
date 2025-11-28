#!/usr/bin/env node
/**
 * Script pour appliquer automatiquement la migration 20250129000011
 * Essaie plusieurs méthodes pour s'assurer que la migration est appliquée
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour charger les variables d'environnement
function loadEnv() {
  const envPaths = [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  
  const env = {};
  
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            env[key] = value;
          }
        }
      });
    }
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

// Permettre de passer le chemin en argument ou utiliser la migration par défaut
const migrationPath = process.argv[2] || join(__dirname, '..', 'supabase', 'migrations', '20250129000011_fix_abonnement_creation_complete_analyze.sql');

async function applyViaDatabaseUrl(migrationFilePath) {
  if (!DATABASE_URL) {
    return { success: false, error: 'DATABASE_URL non disponible' };
  }
  
  console.log('📋 Méthode 1 : Application via DATABASE_URL...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : {
      rejectUnauthorized: false,
    },
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Connecté à la base de données');
    
    const migrationSQL = readFileSync(migrationFilePath, 'utf8');
    console.log('📄 Lecture de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !');
    client.release();
    await pool.end();
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    return { success: false, error: error.message };
  }
}

async function applyViaSupabaseRPC() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: 'Supabase URL ou Service Key non disponible' };
  }
  
  console.log('📋 Méthode 2 : Tentative via Supabase RPC...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Créer une fonction temporaire pour exécuter le SQL
    // Note: Cette méthode nécessite que la fonction execute_sql existe
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.log('⚠️ Fonction execute_sql non disponible, méthode 2 échouée');
      return { success: false, error: error.message };
    }
    
    console.log('✅ Migration appliquée via RPC');
    return { success: true };
  } catch (error) {
    console.log('⚠️ Erreur méthode 2:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  // Utiliser le chemin passé en argument ou celui par défaut
  const migrationFilePath = process.argv[2] || migrationPath;
  const migrationFileName = migrationFilePath.split('/').pop();
  
  console.log('\n🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION\n');
  console.log(`📄 Migration: ${migrationFileName}\n`);
  
  // Vérifier que le fichier existe
  if (!existsSync(migrationFilePath)) {
    console.error(`❌ Fichier migration non trouvé: ${migrationFilePath}`);
    process.exit(1);
  }
  
  // Essayer méthode 1 : DATABASE_URL
  let result = await applyViaDatabaseUrl(migrationFilePath);
  
  // Si méthode 1 échoue, essayer méthode 2
  if (!result.success) {
    console.log('');
    result = await applyViaSupabaseRPC();
  }
  
  // Si les deux méthodes échouent, donner les instructions
  if (!result.success) {
    console.log('\n❌ Aucune méthode automatique n\'a fonctionné');
    console.log('\n📋 INSTRUCTIONS MANUELLES :');
    console.log('');
    console.log('1️⃣  Via Supabase Dashboard :');
    console.log('   → Ouvrir Supabase Dashboard');
    console.log('   → Aller dans SQL Editor');
    console.log('   → Copier le contenu du fichier :');
    console.log(`   → ${migrationPath}`);
    console.log('   → Coller et exécuter');
    console.log('');
    console.log('2️⃣  Via Supabase CLI :');
    console.log('   → npx supabase db push');
    console.log('');
    console.log('3️⃣  Via psql (si vous avez DATABASE_URL) :');
    console.log(`   → psql "${DATABASE_URL || 'VOTRE_DATABASE_URL'}" -f "${migrationPath}"`);
    console.log('');
    
    // Afficher le contenu de la migration pour copier-coller
    console.log('📄 CONTENU DE LA MIGRATION (à copier dans SQL Editor) :');
    console.log('═'.repeat(80));
    const migrationContent = readFileSync(migrationPath, 'utf8');
    console.log(migrationContent.substring(0, 500) + '...\n');
    console.log('═'.repeat(80));
    console.log(`\n📄 Fichier complet : ${migrationPath}`);
    
    process.exit(1);
  }
  
  console.log('\n✅✅✅ MIGRATION APPLIQUÉE AVEC SUCCÈS ! ✅✅✅\n');
  console.log('📋 CORRECTIONS APPLIQUÉES :');
  console.log('   ✅ Fonction diagnostic_creation_abonnement() créée');
  console.log('   ✅ Logs ultra détaillés ajoutés à creer_facture_et_abonnement_apres_paiement');
  console.log('   ✅ Structure table abonnements vérifiée');
  console.log('   ✅ Colonne facture_id ajoutée si nécessaire');
  console.log('');
  console.log('🎯 PROCHAINES ÉTAPES :');
  console.log('   1. Tester la création d\'une entreprise avec paiement');
  console.log('   2. Vérifier les logs dans Supabase Dashboard → Logs');
  console.log('   3. Utiliser diagnostic_creation_abonnement(paiement_id) pour diagnostiquer');
  console.log('');
}

main().catch(console.error);

