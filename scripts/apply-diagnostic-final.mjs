/**
 * Script final pour appliquer la migration de diagnostic
 * Essaie toutes les méthodes possibles
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Tentative d\'application de la migration de diagnostic...\n');

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL non trouvé dans .env');
  process.exit(1);
}

// Lire la migration
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250123000038_diagnostic_workflow_complet.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

console.log('📄 Migration chargée:', migrationPath);
console.log('📏 Taille:', migrationSQL.length, 'caractères\n');

// Méthode : Créer une fonction RPC temporaire via l'API Supabase qui exécute le SQL
// Puis l'appeler avec le SQL de la migration
if (serviceRoleKey) {
  console.log('🔑 SERVICE_ROLE_KEY trouvé. Tentative via API Supabase...\n');
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  try {
    // La migration contient plusieurs CREATE FUNCTION
    // On va essayer de créer une fonction RPC temporaire qui exécute du SQL
    // Puis l'utiliser pour exécuter la migration
    
    // Diviser la migration en instructions individuelles
    // (simplification : exécuter tout d'un coup)
    
    // Note: Supabase ne permet pas d'exécuter du SQL arbitraire directement
    // On doit utiliser une connexion PostgreSQL directe
    
    console.log('⚠️  L\'API Supabase REST ne permet pas d\'exécuter du SQL arbitraire.\n');
    console.log('💡 SOLUTION: Utilisez le Dashboard Supabase\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Essayer via connexion PostgreSQL directe si DATABASE_URL disponible
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (databaseUrl) {
  console.log('🔗 DATABASE_URL trouvé. Tentative via connexion PostgreSQL directe...\n');
  
  try {
    const { default: pg } = await import('pg');
    const { Client } = pg;
    
    const urlObj = new URL(databaseUrl);
    const client = new Client({
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432'),
      database: urlObj.pathname.slice(1) || 'postgres',
      user: urlObj.username || 'postgres',
      password: urlObj.password || '',
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');
    
    console.log('🔄 Exécution de la migration...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');
    
    // Exécuter le diagnostic
    console.log('🔍 Exécution du diagnostic...\n');
    const result = await client.query('SELECT test_diagnostic_rapide()');
    console.log(result.rows[0].test_diagnostic_rapide);
    console.log('');
    
    await client.end();
    console.log('✅ Terminé !\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur PostgreSQL:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Vérifiez votre DATABASE_URL');
    }
  }
}

// Si aucune méthode automatique n'a fonctionné, donner les instructions
console.log('\n' + '='.repeat(60));
console.log('📋 INSTRUCTIONS POUR APPLICATION MANUELLE');
console.log('='.repeat(60) + '\n');
console.log('1. Ouvrez: https://supabase.com/dashboard');
console.log('2. Sélectionnez votre projet');
console.log('3. Cliquez sur "SQL Editor" dans le menu gauche');
console.log('4. Cliquez sur "New Query"');
console.log('5. Ouvrez le fichier:');
console.log('   ' + migrationPath);
console.log('6. Copiez tout le contenu (Cmd+A puis Cmd+C)');
console.log('7. Collez dans le SQL Editor (Cmd+V)');
console.log('8. Cliquez sur "Run" (ou Cmd+Enter)\n');
console.log('✅ Après application, testez avec:');
console.log('   SELECT test_diagnostic_rapide();\n');
console.log('📖 Guide détaillé: voir APPLIQUER_MIGRATION_MAINTENANT.md\n');


