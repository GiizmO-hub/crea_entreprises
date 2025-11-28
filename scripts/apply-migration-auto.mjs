/**
 * APPLICATION AUTOMATIQUE DE MIGRATION VIA API SUPABASE
 * 
 * Ce script applique automatiquement la dernière migration via l'API Supabase
 * en utilisant la service_role key pour exécuter le SQL directement.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PROJECT_REF = 'ewlozuwvrteopotfizcr';

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

console.log('🚀 APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION\n');
console.log('='.repeat(80));

// Lister toutes les migrations
const allFiles = fs.readdirSync(migrationsDir);
const migrations = allFiles
  .filter(f => f.endsWith('.sql') && !f.includes('APPLY_FIXES') && f.startsWith('2025'))
  .sort()
  .reverse(); // Plus récent en premier

if (migrations.length === 0) {
  console.error('❌ Aucune migration trouvée !');
  process.exit(1);
}

const lastMigration = migrations[0];
const lastMigrationPath = path.join(migrationsDir, lastMigration);

console.log(`📋 Dernière migration détectée : ${lastMigration}\n`);

// Lire le contenu de la migration
const migrationContent = fs.readFileSync(lastMigrationPath, 'utf8');
console.log(`✅ Migration lue (${(migrationContent.length / 1024).toFixed(2)} KB)\n`);

// Méthode 1 : Essayer avec Service Role Key via RPC
if (SUPABASE_SERVICE_ROLE_KEY) {
  console.log('📤 Tentative d\'application via API Supabase (Service Role)...\n');
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Créer une fonction RPC temporaire pour exécuter le SQL
    // Note: On va créer une fonction qui exécute notre migration
    
    console.log('⚠️  L\'API Supabase REST ne permet pas d\'exécuter du SQL arbitraire directement.');
    console.log('📋 Tentative via connexion PostgreSQL directe...\n');
    
  } catch (error) {
    console.log('⚠️  Erreur avec API Supabase:', error.message);
    console.log('📋 Tentative via connexion PostgreSQL directe...\n');
  }
}

// Méthode 2 : Connexion PostgreSQL directe
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;

if (!DB_PASSWORD) {
  console.error('❌ Mot de passe PostgreSQL requis pour application automatique');
  console.error('\n📖 Options pour fournir le mot de passe:');
  console.error('   1. Variable d\'environnement: export SUPABASE_DB_PASSWORD="votre_mot_de_passe"');
  console.error('   2. Ou: export DATABASE_PASSWORD="votre_mot_de_passe"');
  console.error('\n💡 Pour obtenir le mot de passe:');
  console.error('   1. Allez sur: https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_REF + '/settings/database');
  console.error('   2. Section "Connection string" → "URI" ou "Connection pooling"');
  console.error('   3. Copiez le mot de passe (après les deux-points)\n');
  
  // Créer le fichier SQL pour application manuelle
  const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
  const outputContent = `/*
  ============================================================================
  APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
  ============================================================================
  
  Migration: ${lastMigration}
  Date: ${new Date().toISOString()}
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

${migrationContent}

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration ${lastMigration} appliquée avec succès !' as status;
`;
  
  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql`);
  console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);
  console.log('💡 Pour appliquer automatiquement, configurez SUPABASE_DB_PASSWORD et relancez ce script.\n');
  process.exit(0);
}

// Construire la connection string
// Format pour connection pooling: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres.${SUPABASE_PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

console.log('🔌 Connexion à la base de données PostgreSQL...\n');

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 15000
});

try {
  await client.connect();
  console.log('✅ Connecté à la base de données\n');
  
  console.log('📤 Application de la migration...\n');
  
  // Exécuter la migration
  const result = await client.query(migrationContent);
  
  console.log('✅ Migration appliquée avec succès !\n');
  
  // Afficher les résultats si disponibles
  if (result.rows && result.rows.length > 0) {
    console.log('📋 Résultat:');
    result.rows.forEach(row => {
      if (row.status || row.message) {
        console.log(`   ${row.status || row.message}`);
      }
    });
    console.log('');
  }
  
  await client.end();
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ MIGRATION APPLIQUÉE AVEC SUCCÈS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ La migration ${lastMigration} a été appliquée avec succès !`);
  console.log('');
  console.log('🧪 Pour tester:');
  console.log('   1. Vérifiez les logs dans Supabase Dashboard');
  console.log('   2. Testez un nouveau paiement Stripe');
  console.log('   3. Le workflow devrait aller jusqu\'au bout (100%)');
  console.log('');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Erreur lors de l\'application de la migration:');
  console.error(`   ${error.message}\n`);
  
  if (error.code === '28P01') {
    console.error('💡 Le mot de passe est incorrect ou la connection string est invalide.\n');
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.error('💡 Impossible de se connecter à la base de données. Vérifiez votre connexion internet.\n');
  } else {
    console.error('💡 Détails de l\'erreur:', error);
  }
  
  try {
    await client.end();
  } catch (e) {
    // Ignore
  }
  
  // Créer le fichier SQL pour application manuelle
  const outputPath = path.join(__dirname, '..', 'APPLY_LAST_MIGRATION_NOW.sql');
  const outputContent = `/*
  ============================================================================
  APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
  ============================================================================
  
  Migration: ${lastMigration}
  Date: ${new Date().toISOString()}
  
  Erreur lors de l'application automatique:
  ${error.message}
  
  Instructions manuelles:
    1. Ouvrez : https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

${migrationContent}

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration ${lastMigration} appliquée avec succès !' as status;
`;
  
  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`\n✅ Fichier SQL créé : APPLY_LAST_MIGRATION_NOW.sql`);
  console.log(`   Taille: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  console.log('   Vous pouvez l\'appliquer manuellement via le Dashboard Supabase.\n');
  
  process.exit(1);
}

