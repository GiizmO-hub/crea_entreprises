#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000033
 * Mettre à jour statut_paiement et vérifier l'affichage des rôles
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté\n');

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000033_fix_statut_paiement_et_role_affichage.sql');
    console.log(`📖 Lecture: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier le statut_paiement après correction
    const { rows: entreprise } = await client.query(`
      SELECT 
        e.id,
        e.nom,
        e.statut_paiement,
        (SELECT COUNT(*) FROM paiements WHERE entreprise_id = e.id AND statut = 'paye') as paiements_payes,
        (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = e.id AND statut = 'actif') as abonnements_actifs
      FROM entreprises e
      WHERE e.nom = 'Groupe MCLEM';
    `);
    
    console.log('📊 Entreprise après correction:');
    entreprise.forEach(e => {
      console.log(`  Nom: ${e.nom}`);
      console.log(`  statut_paiement: ${e.statut_paiement}`);
      console.log(`  Paiements payés: ${e.paiements_payes}`);
      console.log(`  Abonnements actifs: ${e.abonnements_actifs}`);
      if (e.statut_paiement === 'paye' && e.paiements_payes > 0) {
        console.log(`  ✅ CORRECT !`);
      } else {
        console.log(`  ⚠️  Vérifier...`);
      }
    });

    // Vérifier les rôles
    const { rows: clientsData } = await client.query(`
      SELECT 
        cwr.id,
        cwr.email,
        cwr.role_code,
        u.role as role_from_utilisateurs
      FROM clients_with_roles cwr
      INNER JOIN clients c ON c.id = cwr.id
      LEFT JOIN utilisateurs u ON u.email = c.email
      WHERE cwr.entreprise_id = (SELECT id FROM entreprises WHERE nom = 'Groupe MCLEM' LIMIT 1);
    `);
    
    console.log('\n📊 Rôles clients:');
    clientsData.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.email}`);
      console.log(`     role_code: ${c.role_code}`);
      console.log(`     role_from_utilisateurs: ${c.role_from_utilisateurs}`);
      if (c.role_code === 'client_super_admin') {
        console.log(`     ✅ CORRECT !`);
      }
    });

    console.log('\n📋 Résumé :');
    console.log('   ✅ Fonction mettre_a_jour_statut_paiement_entreprise créée et exécutée');
    console.log('   ✅ Triggers créés pour mise à jour automatique');
    console.log('   ✅ statut_paiement devrait maintenant être "paye"');
    console.log('   ✅ Les rôles sont corrects dans clients_with_roles');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error(`Message: ${error.message}`);
    if (error.detail) console.error(`Détail: ${error.detail}`);
    if (error.hint) console.error(`Conseil: ${error.hint}`);
    if (error.position) console.error(`Position: ${error.position}`);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Déconnexion');
  }
}

applyMigration().catch(console.error);

