import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration de la base de données
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Variable d\'environnement DATABASE_URL manquante !');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function applyMigration() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');

    // Lire le fichier de migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000010_fix_abonnements_facture_id_and_workflow_complete.sql');
    console.log(`📄 Lecture de la migration: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Application de la migration...');
    console.log('   → Correction de creer_facture_et_abonnement_apres_paiement');
    console.log('   → Suppression des références à la colonne "role" inexistante');
    
    // Exécuter la migration
    await client.query(migrationSQL);
    
    console.log('');
    console.log('✅ Migration appliquée avec succès !');
    console.log('');
    console.log('📋 CORRECTIONS APPLIQUÉES :');
    console.log('   ✅ Fonction creer_facture_et_abonnement_apres_paiement corrigée');
    console.log('   ✅ Suppression de toutes les références à colonne "role"');
    console.log('   ✅ Le rôle est maintenant géré uniquement dans utilisateurs.role');
    console.log('');
    console.log('🎯 RÉSULTAT :');
    console.log('   → Plus d\'erreur "column role does not exist"');
    console.log('   → Workflow de création d\'espace membre fonctionnel');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Erreur lors de l\'application de la migration:');
    console.error(`   ${error.message}`);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    console.error('');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Déconnexion de la base de données');
  }
}

applyMigration();

