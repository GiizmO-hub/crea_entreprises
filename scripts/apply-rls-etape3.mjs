import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 RESTAURATION RLS PROGRESSIVE - ÉTAPE 3');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000012_restore_rls_etape3_documents_projets.sql');
  
  let migrationSQL;
  try {
    migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Fichier lu: ${migrationSQL.length} caractères\n`);
  } catch (error) {
    console.error('❌ Erreur lecture:', error.message);
    return;
  }

  let pg;
  try {
    pg = await import('pg');
  } catch (error) {
    console.error('❌ Module pg non installé');
    return;
  }

  const { Client } = pg.default || pg;
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connexion réussie\n');
    console.log('🔄 Application de l\'ÉTAPE 3...');
    console.log('   → Tables documents et projets\n');
    
    await client.query(migrationSQL);

    console.log('✅ ÉTAPE 3 appliquée avec succès !\n');
    console.log('📋 RLS RESTAURÉES POUR :');
    console.log('   ✅ documents');
    console.log('   ✅ document_folders');
    console.log('   ✅ projets, projets_jalons, projets_taches, projets_documents');
    console.log('   ✅ salaries\n');
    console.log('🧪 TEST MAINTENANT :');
    console.log('   → Rechargez l\'application (F5)');
    console.log('   → Vérifiez les modules Documents et Gestion de Projets\n');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error(`   Message: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.position) console.error(`   Position: ${error.position}`);
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée\n');
  }
}

applyMigration();

