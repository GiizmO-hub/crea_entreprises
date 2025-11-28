import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE MIGRATION RLS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Vérifier DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non configuré dans .env');
    console.error('   Veuillez ajouter DATABASE_URL dans votre fichier .env');
    return;
  }

  console.log('✅ DATABASE_URL trouvé\n');

  // Lire le fichier de migration
  const migrationPath = join(__dirname, '../supabase/migrations/20250128000001_fix_complete_rls_platform_super_admin.sql');
  console.log('📄 Lecture du fichier de migration...');
  console.log(`   Chemin: ${migrationPath}\n`);

  let migrationSQL;
  try {
    migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Fichier lu avec succès (${migrationSQL.length} caractères)\n`);
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du fichier:', error.message);
    return;
  }

  // Parser DATABASE_URL
  let pg;
  try {
    pg = await import('pg');
  } catch (error) {
    console.error('❌ Module pg non installé. Installation...');
    console.error('   Exécutez: npm install pg');
    return;
  }

  const { Client } = pg.default || pg;

  // Créer la connexion PostgreSQL
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connexion réussie\n');

    console.log('🔄 Exécution de la migration...');
    console.log('   ⚠️  Cela peut prendre quelques secondes...\n');

    // Exécuter la migration
    await client.query(migrationSQL);

    console.log('✅ Migration appliquée avec succès !\n');

    // Vérifier que is_platform_super_admin existe
    console.log('🔍 Vérification de la fonction is_platform_super_admin()...');
    const checkFunction = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'is_platform_super_admin'
    `);

    if (checkFunction.rows.length > 0) {
      console.log('✅ Fonction is_platform_super_admin() trouvée\n');
    } else {
      console.warn('⚠️  Fonction is_platform_super_admin() non trouvée\n');
    }

    // Vérifier les policies RLS
    console.log('🔍 Vérification des policies RLS...\n');
    
    const tables = ['entreprises', 'clients', 'factures', 'abonnements'];
    for (const table of tables) {
      const policies = await client.query(`
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = $1
      `, [table]);

      if (policies.rows.length > 0) {
        console.log(`✅ Table ${table}: ${policies.rows.length} policies trouvées`);
        policies.rows.forEach(p => {
          console.log(`   - ${p.policyname}`);
        });
      } else {
        console.warn(`⚠️  Table ${table}: Aucune policy trouvée`);
      }
    }

    console.log('\n✅ Vérification terminée !\n');

  } catch (error) {
    console.error('\n❌ ERREUR lors de l\'application de la migration:');
    console.error(`   Message: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    console.error('\n📋 Vérifiez les erreurs ci-dessus et corrigez la migration si nécessaire.\n');
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée\n');
  }
}

applyMigration();

