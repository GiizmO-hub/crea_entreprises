#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration 20250129000032
 * Corriger clients_with_roles pour utiliser utilisateurs.role
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

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000032_fix_clients_with_roles_utilisateurs_role.sql');
    console.log(`📖 Lecture: ${migrationPath}`);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Lu (${migrationSQL.length} caractères)\n`);

    console.log('🚀 Application de la migration...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier que role_code est maintenant correct
    const { rows: clientsData } = await client.query(`
      SELECT 
        cwr.id,
        cwr.email,
        cwr.role_code,
        u.role as role_from_utilisateurs
      FROM clients_with_roles cwr
      INNER JOIN clients c ON c.id = cwr.id
      LEFT JOIN utilisateurs u ON u.email = c.email
      WHERE c.entreprise_id = (SELECT id FROM entreprises WHERE nom = 'Groupe MCLEM' LIMIT 1)
      LIMIT 5;
    `);
    
    console.log('📊 Rôles depuis clients_with_roles:');
    clientsData.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.email}`);
      console.log(`     role_code: ${c.role_code}`);
      console.log(`     role_from_utilisateurs: ${c.role_from_utilisateurs}`);
      if (c.role_code === 'client_super_admin' && c.role_from_utilisateurs === 'client_super_admin') {
        console.log(`     ✅ CORRECT !`);
      } else {
        console.log(`     ⚠️  Vérifier...`);
      }
    });

    // Compter les super admins
    const { rows: countData } = await client.query(`
      SELECT COUNT(*) as count
      FROM clients_with_roles
      WHERE role_code = 'client_super_admin'
        AND entreprise_id = (SELECT id FROM entreprises WHERE nom = 'Groupe MCLEM' LIMIT 1);
    `);
    
    console.log(`\n👑 Nombre de super admins détectés: ${countData[0].count}`);

    console.log('\n📋 Résumé :');
    console.log('   ✅ Vue clients_with_roles recréée');
    console.log('   ✅ Priorité donnée à utilisateurs.role');
    console.log('   ✅ Le frontend devrait maintenant détecter les super admins !');

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

