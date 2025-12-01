#!/usr/bin/env node

/**
 * Script pour appliquer la migration de correction complète des factures en double
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ Erreur: DATABASE_URL ou SUPABASE_DB_URL non défini dans .env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');
    
    const migrationFile = join(__dirname, '..', 'supabase', 'migrations', '20250131000015_fix_doublons_factures_complet.sql');
    console.log(`📄 Lecture du fichier de migration: ${migrationFile}`);
    
    let sql = readFileSync(migrationFile, 'utf-8');
    
    // Nettoyer le SQL : supprimer uniquement les commentaires de ligne (garder les commentaires multi-lignes pour les fonctions)
    sql = sql.replace(/--.*$/gm, ''); // Commentaires de ligne uniquement
    
    // Supprimer la dernière ligne SELECT si elle existe
    sql = sql.replace(/SELECT\s+'.*'\s+as\s+resultat\s*;?\s*$/i, '');
    
    console.log(`📝 Exécution du fichier SQL complet...`);
    
    try {
      await client.query(sql);
      console.log(`✅ Migration exécutée avec succès`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de la migration:`, error.message);
      throw error;
    }
    
    console.log('\n✅ Migration appliquée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Déconnexion de la base de données');
  }
}

applyMigration();

