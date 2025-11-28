#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000031
 * Mettre à jour les rôles existants
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

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000031_fix_mettre_a_jour_role_existants.sql');
    console.log(`📖 Lecture: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier le résultat
    const { rows: result } = await client.query(`
      SELECT * FROM corriger_roles_client_super_admin()
    `);
    
    if (result.length > 0) {
      console.log('📊 Résultat de la correction des rôles:');
      console.log(JSON.stringify(result[0], null, 2));
    }

    // Vérifier les rôles après correction
    const { rows: users } = await client.query(`
      SELECT 
        u.email,
        u.role,
        c.entreprise_id,
        e.nom as entreprise_nom
      FROM utilisateurs u
      INNER JOIN clients c ON c.email = u.email
      LEFT JOIN entreprises e ON e.id = c.entreprise_id
      WHERE e.nom = 'Groupe MCLEM'
      ORDER BY u.created_at DESC;
    `);
    
    console.log('\n📋 Rôles après correction:');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} - Rôle: ${u.role}`);
    });

    console.log('\n📋 Résumé :');
    console.log('   ✅ Fonction corriger_roles_client_super_admin créée');
    console.log('   ✅ Rôles mis à jour pour les paiements déjà traités');
    console.log('   ✅ Les super admins devraient maintenant être détectés !');

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

