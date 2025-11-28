#!/usr/bin/env node
/**
 * Script pour appliquer la correction via connexion PostgreSQL directe
 * Nécessite les credentials de connexion PostgreSQL
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

async function applyViaPostgres() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION DE LA CORRECTION VIA POSTGRESQL');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Essayer de récupérer les credentials PostgreSQL depuis les variables d'env
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.log('⚠️ DATABASE_URL non trouvé dans .env\n');
    console.log('💡 Pour obtenir la connection string:');
    console.log('   1. Supabase Dashboard → Settings → Database');
    console.log('   2. Connection String → URI');
    console.log('   3. Ajoutez DATABASE_URL dans .env\n');
    return false;
  }

  try {
    console.log('📡 Connexion à PostgreSQL...\n');
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    // Lire le fichier SQL
    const sqlFile = join(__dirname, '../APPLY_FIX_WORKFLOW_NOW.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');
    
    console.log('📝 Exécution du SQL...\n');
    
    // Exécuter le SQL
    const result = await pool.query(sqlContent);
    
    console.log('✅ Correction appliquée avec succès !\n');
    
    if (result.rows && result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log('   →', row);
      });
    }
    
    await pool.end();
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution:', error.message);
    if (error.message.includes('password authentication')) {
      console.log('\n💡 Vérifiez votre DATABASE_URL dans .env\n');
    }
    return false;
  }
}

// Vérifier si pg est installé
try {
  applyViaPostgres().then((success) => {
    if (success) {
      console.log('✅ Correction appliquée ! Testez maintenant via le frontend.\n');
      process.exit(0);
    } else {
      console.log('\n📋 Application manuelle recommandée via Supabase Dashboard.\n');
      process.exit(0);
    }
  });
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('⚠️ Module pg non installé.\n');
    console.log('💡 Installez-le avec: npm install pg\n');
    console.log('📋 OU appliquez manuellement via Supabase Dashboard.\n');
  }
  process.exit(0);
}

