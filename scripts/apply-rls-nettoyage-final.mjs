import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧹 NETTOYAGE FINAL - RESTAURATION RLS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000014_restore_rls_final_cleanup.sql');
  
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
    console.log('🧹 Application du nettoyage final...');
    console.log('   → Remplacement de toutes les policies temporaires\n');
    
    await client.query(migrationSQL);

    console.log('✅ Nettoyage final appliqué avec succès !\n');
    console.log('📋 RÉSULTAT :');
    console.log('   ✅ Toutes les policies temporaires remplacées');
    console.log('   ✅ RLS restaurées pour toutes les tables');
    console.log('   ✅ Application sécurisée !\n');
    console.log('🧪 TEST MAINTENANT :');
    console.log('   → Rechargez l\'application (F5)');
    console.log('   → Vérifiez que tout fonctionne toujours');
    console.log('   → L\'application est maintenant sécurisée avec RLS\n');

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

