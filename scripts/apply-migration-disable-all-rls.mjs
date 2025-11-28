import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ⚠️  DÉSACTIVATION TEMPORAIRE DE TOUTES LES RESTRICTIONS RLS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000008_disable_all_rls_temporarily.sql');
  
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
    console.log('⚠️  ATTENTION: Cette migration va supprimer TOUTES les restrictions RLS !');
    console.log('   → Tous les utilisateurs authentifiés pourront accéder à TOUT\n');
    console.log('🔄 Exécution de la migration...\n');
    
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');
    console.log('📋 RÉSULTAT :');
    console.log('   ✅ Toutes les policies RLS ont été supprimées');
    console.log('   ✅ Policies temporaires "allow all" créées');
    console.log('   ✅ Tous les utilisateurs authentifiés peuvent maintenant tout voir\n');
    console.log('🧪 TEST :');
    console.log('   → Rechargez l\'application (F5)');
    console.log('   → Les données devraient maintenant s\'afficher');
    console.log('   → Si ça fonctionne, le problème vient des RLS policies\n');
    console.log('⚠️  IMPORTANT :');
    console.log('   → Cette configuration est INSÉCURISÉE');
    console.log('   → Ne PAS utiliser en production');
    console.log('   → On remettra les restrictions progressivement ensuite\n');

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

