/**
 * Script pour appliquer la migration de diagnostic directement via PostgreSQL
 * 
 * Usage: node scripts/apply-migration-direct.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { config } from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env
config({ path: join(__dirname, '..', '.env') });

function extractDbConnection(url) {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432'),
      database: urlObj.pathname.slice(1) || 'postgres',
      user: urlObj.username || 'postgres',
      password: urlObj.password || '',
      ssl: { rejectUnauthorized: false } // Supabase nécessite SSL
    };
  } catch (error) {
    return null;
  }
}

async function applyMigration() {
  console.log('🚀 Application de la migration de diagnostic...\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.log('⚠️  DATABASE_URL non trouvé dans .env\n');
    console.log('💡 SOLUTION RECOMMANDÉE - Via Dashboard Supabase:');
    console.log('   1. Ouvrez: https://supabase.com/dashboard');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Cliquez sur "SQL Editor" dans le menu gauche');
    console.log('   4. Cliquez sur "New Query"');
    console.log('   5. Ouvrez le fichier: supabase/migrations/20250123000038_diagnostic_workflow_complet.sql');
    console.log('   6. Copiez tout le contenu (Cmd+A puis Cmd+C)');
    console.log('   7. Collez dans l\'éditeur SQL (Cmd+V)');
    console.log('   8. Cliquez sur "Run" (ou Cmd+Enter)\n');
    
    console.log('💡 Pour une application automatique future:');
    console.log('   Ajoutez DATABASE_URL dans votre .env');
    console.log('   Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres');
    console.log('   (Trouvable dans Supabase Dashboard → Settings → Database → Connection string)\n');
    return;
  }

  console.log('🔗 Tentative de connexion à la base de données...\n');
  
  const dbConfig = extractDbConnection(databaseUrl);
  if (!dbConfig) {
    console.error('❌ Format de DATABASE_URL invalide');
    return;
  }

  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Lire la migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
    console.log('📄 Lecture de la migration:', migrationPath);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration chargée (' + migrationSQL.length + ' caractères)\n');
    
    // Exécuter la migration
    console.log('🔄 Exécution de la migration...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');
    
    // Exécuter le diagnostic immédiatement
    console.log('🔍 Exécution du diagnostic...\n');
    const result = await client.query('SELECT test_diagnostic_rapide()');
    console.log(result.rows[0].test_diagnostic_rapide);
    console.log('');
    
    await client.end();
    console.log('✅ Terminé !\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\n💡 Vérifiez votre DATABASE_URL dans .env');
      console.log('   Format attendu: postgresql://postgres:[password]@[host]:[port]/postgres');
    } else if (error.message.includes('permission denied') || error.message.includes('access denied')) {
      console.log('\n💡 Problème de permissions. Vérifiez que:');
      console.log('   1. Votre DATABASE_URL utilise les bonnes credentials');
      console.log('   2. Votre utilisateur a les permissions nécessaires');
    }
    await client.end();
    process.exit(1);
  }
}

applyMigration().catch(console.error);


