/**
 * Script pour appliquer la migration de diagnostic
 * 
 * Usage: node scripts/apply-diagnostic-migration.js
 * 
 * Nécessite:
 * - VITE_SUPABASE_URL dans .env
 * - SUPABASE_SERVICE_ROLE_KEY dans .env (pour exécuter du SQL)
 */

const fs = require('fs');
const path = require('path');

// Lire les variables d'environnement
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env non trouvé');
    console.log('💡 Créez un fichier .env avec:');
    console.log('   VITE_SUPABASE_URL=https://votre-projet.supabase.co');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });

  return envVars;
}

async function applyMigration() {
  console.log('🚀 Application de la migration de diagnostic...\n');

  // Charger les variables d'environnement
  const envVars = loadEnv();
  
  const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ VITE_SUPABASE_URL non trouvé dans .env');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY non trouvé dans .env');
    console.log('\n💡 Pour obtenir votre SERVICE_ROLE_KEY:');
    console.log('   1. Allez sur Supabase Dashboard');
    console.log('   2. Settings → API');
    console.log('   3. Copiez la "service_role" key');
    console.log('\n⚠️  ALTERNATIVE: Appliquez la migration manuellement via le Dashboard Supabase');
    console.log('   (Voir GUIDE_DIAGNOSTIC_WORKFLOW.md)');
    process.exit(1);
  }

  // Lire le fichier de migration
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Fichier de migration non trouvé: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📄 Migration chargée:', migrationPath);
  console.log('📏 Taille:', migrationSQL.length, 'caractères\n');

  // Exécuter la migration via l'API Supabase
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Migration appliquée avec succès !\n');
      console.log('📊 Résultat:', JSON.stringify(result, null, 2));
    } else {
      // Si la fonction exec_sql n'existe pas, suggérer l'application manuelle
      console.error('❌ Erreur lors de l\'application de la migration');
      console.error('Status:', response.status);
      const errorText = await response.text();
      console.error('Erreur:', errorText);
      console.log('\n💡 SOLUTION ALTERNATIVE:');
      console.log('   Appliquez la migration manuellement via le Dashboard Supabase:');
      console.log('   1. Ouvrez Supabase Dashboard');
      console.log('   2. Allez dans SQL Editor');
      console.log('   3. Copiez-collez le contenu de:');
      console.log('      ', migrationPath);
      console.log('   4. Cliquez sur "Run"');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'application:', error.message);
    console.log('\n💡 SOLUTION ALTERNATIVE:');
    console.log('   Appliquez la migration manuellement via le Dashboard Supabase');
    console.log('   (Voir GUIDE_DIAGNOSTIC_WORKFLOW.md pour les instructions)');
  }
}

// Exécuter
applyMigration().catch(console.error);


