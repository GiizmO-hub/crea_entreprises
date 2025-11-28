/**
 * Script pour appliquer directement la migration via Supabase client
 * Utilise rpc('exec_sql') si disponible, sinon affiche les instructions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 APPLICATION DE LA MIGRATION 20250130000001');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!SUPABASE_URL) {
    console.error('❌ SUPABASE_URL non définie');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000001_extend_update_client_complete_with_all_data.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Fichier de migration non trouvé : ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  console.log('✅ Fichier de migration lu\n');

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY non définie');
    console.log('\n💡 Pour appliquer automatiquement, ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local');
    console.log('\n📋 INSTRUCTIONS MANUELLES :\n');
    console.log('   1. Ouvrez Supabase Dashboard > SQL Editor');
    console.log('   2. Copiez le contenu suivant :\n');
    console.log('─'.repeat(70));
    console.log(migrationSQL);
    console.log('─'.repeat(70));
    console.log('\n   3. Collez et exécutez le SQL\n');
    return;
  }

  console.log('📡 Connexion à Supabase...\n');

  // Créer le client avec service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Diviser le SQL en blocs si nécessaire
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`📝 Exécution de ${statements.length} instructions SQL...\n`);

  try {
    // Exécuter via RPC si disponible, sinon afficher les instructions
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });

    if (error) {
      console.error('❌ Erreur RPC:', error.message);
      console.log('\n💡 La fonction exec_sql n\'existe peut-être pas.');
      console.log('📋 Veuillez appliquer la migration manuellement (voir instructions ci-dessus)\n');
      return;
    }

    console.log('✅ Migration appliquée avec succès !\n');
    console.log('📋 Résultat :', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n📋 Veuillez appliquer la migration manuellement (voir instructions ci-dessus)\n');
  }
}

applyMigration();

