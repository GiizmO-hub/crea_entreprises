import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 RESTAURATION RLS PROGRESSIVE - ÉTAPE 2');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000010_restore_rls_etape2_tables_speciales.sql');
  
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
    console.log('🔄 Application de l\'ÉTAPE 2...');
    console.log('   → Tables spéciales: utilisateurs, collaborateurs, espaces_membres_clients\n');
    
    await client.query(migrationSQL);

    console.log('✅ ÉTAPE 2 appliquée avec succès !\n');
    console.log('📋 RLS RESTAURÉES POUR :');
    console.log('   ✅ utilisateurs (corrige erreur 403)');
    console.log('   ✅ collaborateurs');
    console.log('   ✅ collaborateurs_entreprise (si table existe)');
    console.log('   ✅ espaces_membres_clients\n');
    console.log('🧪 TEST MAINTENANT :');
    console.log('   → Rechargez l\'application (F5)');
    console.log('   → Les erreurs 403 et 404 devraient être corrigées\n');

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

