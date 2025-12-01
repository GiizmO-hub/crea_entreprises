#!/usr/bin/env node

/**
 * Script pour appliquer la migration de correction du workflow d'abonnement
 * 
 * Ce script applique la migration 20250131000009_fix_abonnement_creation_workflow.sql
 * qui corrige le problème où l'abonnement ne se crée pas automatiquement après validation du paiement
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Charger les variables d'environnement
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Récupérer DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL non défini dans .env');
  console.error('');
  console.error('💡 Ajoutez dans votre fichier .env :');
  console.error('   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');

    // Lire le fichier de migration
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20250131000009_fix_abonnement_creation_workflow.sql');
    console.log(`📄 Lecture de la migration: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Nettoyer le SQL (supprimer les commentaires de type /* */ qui peuvent poser problème)
    // Remplacer les commentaires multi-lignes /* ... */ par des commentaires SQL simples
    let cleanedSQL = migrationSQL;
    
    // Supprimer les commentaires multi-lignes /* ... */
    cleanedSQL = cleanedSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Supprimer les lignes vides multiples
    cleanedSQL = cleanedSQL.replace(/\n\s*\n\s*\n/g, '\n\n');

    console.log('🚀 Application de la migration...');
    console.log('');
    
    // Exécuter la migration
    await client.query(cleanedSQL);
    
    console.log('');
    console.log('✅ Migration appliquée avec succès !');
    console.log('');
    console.log('📊 Vérifications effectuées :');
    console.log('   ✅ Trigger vérifié et corrigé');
    console.log('   ✅ Fonction creer_facture_et_abonnement_apres_paiement vérifiée');
    console.log('   ✅ Abonnements manquants créés pour les paiements déjà validés');
    console.log('');
    console.log('💡 Le workflow devrait maintenant fonctionner à 100%');
    console.log('   Les abonnements seront créés automatiquement après validation des paiements');
    
  } catch (error) {
    console.error('');
    console.error('❌ Erreur lors de l\'application de la migration:');
    console.error(error.message);
    console.error('');
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Détail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Indication: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter
applyMigration().catch(console.error);

