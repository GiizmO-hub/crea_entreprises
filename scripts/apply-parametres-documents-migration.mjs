#!/usr/bin/env node

/**
 * Script pour appliquer la migration parametres_documents automatiquement
 * 
 * Ce script applique la migration SQL via une connexion PostgreSQL directe
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement depuis .env
config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

// Configuration depuis les variables d'environnement
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL doit être configuré');
  console.error('');
  console.error('📋 Pour obtenir la connection string:');
  console.error('   1. Ouvrez Supabase Dashboard → Settings → Database');
  console.error('   2. Scroll jusqu\'à "Connection string"');
  console.error('   3. Sélectionnez "URI" (pas "Connection pooling")');
  console.error('   4. Copiez la connection string');
  console.error('   5. Ajoutez-la dans .env.local:');
  console.error('      DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres');
  console.error('');
  process.exit(1);
}

/**
 * Fonction principale
 */
async function applyMigration() {
  console.log('🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION PARAMETRES_DOCUMENTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrationFile = join(projectRoot, 'supabase', 'migrations', '20250131000001_create_parametres_documents.sql');

  // Créer le client PostgreSQL
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Nécessaire pour Supabase
    },
  });

  try {
    // Se connecter
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté!\n');

    // Lire le fichier SQL
    console.log('📄 Lecture de la migration...');
    const sqlContent = readFileSync(migrationFile, 'utf-8');
    console.log('✅ Migration lue\n');

    // Nettoyer le SQL (enlever les commentaires de bloc)
    let cleanSQL = sqlContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Enlever les commentaires /* */
      .trim();

    // Exécuter le SQL
    console.log('⚙️  Application de la migration...');
    await client.query(cleanSQL);
    
    console.log('✅ Migration appliquée avec succès!\n');

    // Vérifier que la table existe
    console.log('🔍 Vérification de la table...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parametres_documents'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Table parametres_documents créée avec succès!\n');
    } else {
      console.log('⚠️  La table n\'a pas été trouvée après l\'application\n');
    }

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  La table ou certains objets existent déjà');
      console.log('   Cela signifie que la migration a peut-être déjà été appliquée\n');
    } else {
      console.error('❌ Erreur:', error.message);
      console.error('');
      console.error('💡 Si l\'erreur persiste, appliquez la migration manuellement:');
      console.error('   1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
      console.error('   2. Copiez le contenu de: supabase/migrations/20250131000001_create_parametres_documents.sql');
      console.error('   3. Collez dans l\'éditeur SQL');
      console.error('   4. Cliquez sur "Run"\n');
      process.exit(1);
    }
  } finally {
    // Fermer la connexion
    await client.end();
    console.log('🔌 Connexion fermée\n');
    console.log('✅ Terminé !');
  }
}

// Exécuter
applyMigration().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

