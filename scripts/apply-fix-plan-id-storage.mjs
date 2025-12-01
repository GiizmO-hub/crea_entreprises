#!/usr/bin/env node

/**
 * Script pour appliquer la migration de correction du stockage du plan_id dans les notes du paiement
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
    await client.connect();
    console.log('✅ Connexion à la base de données établie');
    
    const migrationFile = join(__dirname, '..', 'supabase', 'migrations', '20250131000016_fix_plan_id_storage_paiement.sql');
    console.log(`📄 Lecture du fichier de migration: ${migrationFile}`);
    
    let sql = readFileSync(migrationFile, 'utf-8');
    
    // Nettoyer le SQL : supprimer les commentaires multi-lignes et les commentaires de ligne
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, ''); // Commentaires multi-lignes
    sql = sql.replace(/--.*$/gm, ''); // Commentaires de ligne
    
    // Exécuter le SQL complet en une seule fois (pour les fonctions PL/pgSQL)
    console.log('📌 Exécution de la migration...');
    await client.query(sql);
    
    console.log('✅ Migration appliquée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error.message);
    if (error.position) {
      console.error(`   Position de l'erreur: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

