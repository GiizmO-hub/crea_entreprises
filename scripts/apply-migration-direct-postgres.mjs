/**
 * APPLICATION AUTOMATIQUE DE MIGRATION VIA POSTGRESQL DIRECT
 * 
 * Ce script applique automatiquement la migration via une connexion PostgreSQL directe
 * en utilisant la connection string Supabase.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_PROJECT_REF = 'ewlozuwvrteopotfizcr';

// Connection string PostgreSQL Supabase
// Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
// Nous allons demander le mot de passe à l'utilisateur ou utiliser une variable d'environnement
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

console.log('🚀 APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION\n');
console.log('='.repeat(80));

// Lister toutes les migrations
const allFiles = fs.readdirSync(migrationsDir);
const migrations = allFiles
  .filter(f => f.endsWith('.sql') && !f.includes('APPLY_FIXES'))
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

// Méthode 1 : Essayer avec Supabase CLI d'abord
console.log('📤 Tentative d\'application via Supabase CLI...\n');

try {
  const { execSync } = await import('child_process');
  
  // Vérifier si supabase CLI est disponible
  try {
    execSync('which supabase', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ Supabase CLI disponible\n');
    
    // Essayer d'appliquer la migration
    try {
      const result = execSync(
        `cd "${path.join(__dirname, '..')}" && npx supabase db push --db-url "postgresql://postgres.${SUPABASE_PROJECT_REF}:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"`,
        { encoding: 'utf8', stdio: 'pipe', timeout: 30000 }
      );
      console.log('✅ Migration appliquée via Supabase CLI !');
      console.log(result);
      process.exit(0);
    } catch (err) {
      console.log('⚠️  Supabase CLI ne peut pas appliquer directement\n');
    }
  } catch (err) {
    console.log('⚠️  Supabase CLI non disponible\n');
  }
} catch (err) {
  console.log('⚠️  Impossible d\'utiliser Supabase CLI\n');
}

// Méthode 2 : Connexion PostgreSQL directe
console.log('📤 Tentative d\'application via connexion PostgreSQL directe...\n');

if (!DB_PASSWORD) {
  console.error('❌ Mot de passe PostgreSQL requis');
  console.error('\n📖 Options pour fournir le mot de passe:');
  console.error('   1. Variable d\'environnement: export SUPABASE_DB_PASSWORD="votre_mot_de_passe"');
  console.error('   2. Ou: export DATABASE_PASSWORD="votre_mot_de_passe"');
  console.error('\n💡 Pour obtenir le mot de passe:');
  console.error('   1. Allez sur: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/database');
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
  
  process.exit(1);
}

// Construire la connection string
// Format pour connection pooling: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres.${SUPABASE_PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000
});

try {
  console.log('🔌 Connexion à la base de données...');
  await client.connect();
  console.log('✅ Connecté à la base de données\n');
  
  console.log('📤 Application de la migration...\n');
  
  // Exécuter la migration
  const result = await client.query(migrationContent);
  
  console.log('✅ Migration appliquée avec succès !\n');
  console.log('📋 Résultat:');
  if (result.rows && result.rows.length > 0) {
    result.rows.forEach(row => {
      console.log(`   ${JSON.stringify(row)}`);
    });
  }
  
  await client.end();
  
  console.log('\n✅ TERMINÉ ! La migration a été appliquée avec succès.\n');
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
  
  await client.end().catch(() => {});
  
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
