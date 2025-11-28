#!/usr/bin/env node
/**
 * Script pour appliquer la migration de correction de création d'abonnement
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Variable d\'environnement DATABASE_URL manquante !');
  console.error('   Ajoutez DATABASE_URL dans votre fichier .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000011_fix_abonnement_creation_complete_analyze.sql');
  
  console.log('🔌 Connexion à la base de données...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connecté à la base de données');
    
    console.log('📄 Lecture de la migration:', migrationPath);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Application de la migration...');
    console.log('   → Ajout logs ultra détaillés pour création abonnement');
    console.log('   → Fonction de diagnostic créée');
    console.log('   → Amélioration creer_facture_et_abonnement_apres_paiement');
    
    await client.query(migrationSQL);
    
    console.log('\n✅ Migration appliquée avec succès !');
    console.log('\n📋 CORRECTIONS APPLIQUÉES :');
    console.log('   ✅ Fonction diagnostic_creation_abonnement créée');
    console.log('   ✅ Logs ultra détaillés ajoutés à creer_facture_et_abonnement_apres_paiement');
    console.log('   ✅ Structure table abonnements vérifiée');
    console.log('   ✅ Colonne facture_id ajoutée si nécessaire');
    
    console.log('\n🎯 RÉSULTAT :');
    console.log('   → Diagnostic complet disponible via diagnostic_creation_abonnement()');
    console.log('   → Logs détaillés pour comprendre pourquoi l\'abonnement ne se crée pas');
    console.log('   → Meilleure gestion des erreurs');
    
    client.release();
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:', error.message);
    console.error('   Détails:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Déconnexion de la base de données');
  }
}

applyMigration().catch(console.error);

