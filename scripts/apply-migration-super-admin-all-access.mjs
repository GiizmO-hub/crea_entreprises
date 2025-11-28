import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION MIGRATION - SUPER ADMIN ALL ACCESS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000007_fix_rls_super_admin_all_access.sql');
  
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
    console.log('🔄 Exécution de la migration (SOLUTION RADICALE)...');
    console.log('   ⚠️  Cela va remplacer TOUTES les policies existantes\n');
    
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');
    console.log('📋 CHANGEMENTS :');
    console.log('   ✅ Toutes les policies remplacées par des versions ultra-simples');
    console.log('   ✅ Super admin peut maintenant accéder à TOUT');
    console.log('   ✅ Plus de sous-requêtes complexes\n');
    console.log('🎯 PROCHAINE ÉTAPE :');
    console.log('   → Rechargez l\'application (F5)');
    console.log('   → Déconnectez-vous et reconnectez-vous');
    console.log('   → Les erreurs 403 devraient disparaître\n');

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

