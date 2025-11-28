/**
 * Script pour appliquer la migration de diagnostic directement via PostgreSQL
 * 
 * Usage: node scripts/apply-migration-direct.js
 * 
 * Nécessite:
 * - VITE_SUPABASE_URL dans .env (pour extraire le host)
 * - SUPABASE_DB_PASSWORD dans .env OU utiliser SUPABASE_SERVICE_ROLE_KEY
 * 
 * Alternative: Utilisez le Dashboard Supabase SQL Editor
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Charger .env manuellement (simple version)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env non trouvé');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    }
  });

  return envVars;
}

function extractDbConnection(url) {
  // Format Supabase: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  // Ou: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
  
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432'),
      database: urlObj.pathname.slice(1) || 'postgres',
      user: urlObj.username || 'postgres',
      password: urlObj.password || '',
    };
  } catch (error) {
    return null;
  }
}

async function applyMigration() {
  console.log('🚀 Application de la migration de diagnostic...\n');

  const envVars = loadEnv();
  const supabaseUrl = envVars.VITE_SUPABASE_URL;
  const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  
  // Essayer de construire la connection string
  // Note: Supabase ne fournit pas directement le DATABASE_URL
  // Il faut le récupérer depuis le Dashboard
  
  console.log('⚠️  Pour appliquer la migration automatiquement, nous avons besoin de:');
  console.log('   1. La connection string PostgreSQL de Supabase');
  console.log('   2. Ou utilisez le Dashboard Supabase\n');
  
  console.log('💡 SOLUTION RECOMMANDÉE:');
  console.log('   → Ouvrez Supabase Dashboard → SQL Editor');
  console.log('   → Copiez le contenu de: supabase/migrations/20250123000038_diagnostic_workflow_complet.sql');
  console.log('   → Collez et exécutez\n');
  
  console.log('📋 INSTRUCTIONS DÉTAILLÉES:');
  console.log('   1. Ouvrez: https://supabase.com/dashboard');
  console.log('   2. Sélectionnez votre projet');
  console.log('   3. Cliquez sur "SQL Editor" dans le menu gauche');
  console.log('   4. Cliquez sur "New Query"');
  console.log('   5. Ouvrez le fichier: supabase/migrations/20250123000038_diagnostic_workflow_complet.sql');
  console.log('   6. Copiez tout le contenu (Cmd+A puis Cmd+C)');
  console.log('   7. Collez dans l\'éditeur SQL (Cmd+V)');
  console.log('   8. Cliquez sur "Run" (ou Cmd+Enter)\n');
  
  console.log('✅ Après application, testez avec:');
  console.log('   SELECT test_diagnostic_rapide();\n');
  
  // Si on a une connection string, on peut essayer
  const databaseUrl = envVars.DATABASE_URL || envVars.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.log('💡 Pour une application automatique future:');
    console.log('   Ajoutez DATABASE_URL dans votre .env');
    console.log('   Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres');
    console.log('   (Trouvable dans Supabase Dashboard → Settings → Database → Connection string)');
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
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration chargée:', migrationPath);
    console.log('📏 Taille:', migrationSQL.length, 'caractères\n');
    
    // Exécuter la migration
    console.log('🔄 Exécution de la migration...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');
    
    // Exécuter le diagnostic
    console.log('🔍 Exécution du diagnostic...\n');
    const result = await client.query('SELECT test_diagnostic_rapide()');
    console.log(result.rows[0].test_diagnostic_rapide);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\n💡 Vérifiez votre DATABASE_URL dans .env');
      console.log('   Format attendu: postgresql://postgres:[password]@[host]:[port]/postgres');
    }
    await client.end();
    process.exit(1);
  }
}

applyMigration().catch(console.error);


