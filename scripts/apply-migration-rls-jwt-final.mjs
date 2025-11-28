import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION MIGRATION RLS - auth.jwt() FINALE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré dans .env');
    return;
  }

  const migrationPath = join(__dirname, '../supabase/migrations/20250128000004_fix_rls_auth_jwt_final.sql');
  
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
    console.error('❌ Module pg non installé. Exécutez: npm install pg');
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

    console.log('🔄 Exécution de la migration...');
    console.log('   ⚠️  Cela peut prendre quelques secondes...\n');
    
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier les policies créées
    console.log('🔍 Vérification des policies RLS...\n');
    
    const tables = ['entreprises', 'clients', 'factures', 'abonnements', 'paiements', 'espaces_membres_clients'];
    for (const table of tables) {
      const { rows: policies } = await client.query(`
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = $1
        ORDER BY policyname
      `, [table]);

      if (policies.length > 0) {
        console.log(`✅ Table ${table}: ${policies.length} policies`);
        policies.forEach(p => {
          console.log(`   - ${p.policyname}`);
        });
      } else {
        console.warn(`⚠️  Table ${table}: Aucune policy trouvée`);
      }
    }

    console.log('\n✅ Vérification terminée !\n');
    console.log('📋 PROCHAINES ÉTAPES :');
    console.log('   1. Rechargez l\'application (F5)');
    console.log('   2. Les erreurs 403 devraient disparaître');
    console.log('   3. Les données devraient s\'afficher correctement');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERREUR:');
    console.error(`   Message: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    if (error.position) console.error(`   Position: ${error.position}`);
    if (error.detail) console.error(`   Détail: ${error.detail}`);
    console.error('\n📋 Vérifiez les erreurs ci-dessus.\n');
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée\n');
  }
}

applyMigration();

