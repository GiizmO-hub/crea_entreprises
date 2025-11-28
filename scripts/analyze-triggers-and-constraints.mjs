import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Client } = pg;

const client = new Client({
  host: process.env.SUPABASE_DB_HOST || 'localhost',
  port: process.env.SUPABASE_DB_PORT || 5432,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
});

async function analyzeDatabase() {
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Analyser les triggers sur entreprises
    console.log('📋 TRIGGERS SUR ENTREPRISES:');
    console.log('='.repeat(60));
    const triggersEntreprises = await client.query(`
      SELECT 
        tgname as trigger_name,
        pg_get_triggerdef(oid) as trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'entreprises'::regclass
      AND NOT tgisinternal
      ORDER BY tgname;
    `);
    if (triggersEntreprises.rows.length === 0) {
      console.log('  Aucun trigger trouvé\n');
    } else {
      triggersEntreprises.rows.forEach(t => {
        console.log(`  - ${t.trigger_name}`);
        console.log(`    ${t.trigger_definition}\n`);
      });
    }

    // 2. Analyser les triggers sur clients
    console.log('📋 TRIGGERS SUR CLIENTS:');
    console.log('='.repeat(60));
    const triggersClients = await client.query(`
      SELECT 
        tgname as trigger_name,
        pg_get_triggerdef(oid) as trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'clients'::regclass
      AND NOT tgisinternal
      ORDER BY tgname;
    `);
    if (triggersClients.rows.length === 0) {
      console.log('  Aucun trigger trouvé\n');
    } else {
      triggersClients.rows.forEach(t => {
        console.log(`  - ${t.trigger_name}`);
        console.log(`    ${t.trigger_definition}\n`);
      });
    }

    // 3. Analyser les triggers sur espaces_membres_clients
    console.log('📋 TRIGGERS SUR ESPACES_MEMBRES_CLIENTS:');
    console.log('='.repeat(60));
    const triggersEspaces = await client.query(`
      SELECT 
        tgname as trigger_name,
        pg_get_triggerdef(oid) as trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'espaces_membres_clients'::regclass
      AND NOT tgisinternal
      ORDER BY tgname;
    `);
    if (triggersEspaces.rows.length === 0) {
      console.log('  Aucun trigger trouvé\n');
    } else {
      triggersEspaces.rows.forEach(t => {
        console.log(`  - ${t.trigger_name}`);
        console.log(`    ${t.trigger_definition}\n`);
      });
    }

    // 4. Analyser les contraintes FK avec CASCADE sur entreprises
    console.log('📋 CONTRAINTES FK AVEC CASCADE VERS ENTREPRISES:');
    console.log('='.repeat(60));
    const fkCascade = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'entreprises'
        AND rc.delete_rule = 'CASCADE'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    if (fkCascade.rows.length === 0) {
      console.log('  Aucune contrainte CASCADE trouvée\n');
    } else {
      fkCascade.rows.forEach(fk => {
        console.log(`  - ${fk.table_name}.${fk.column_name} → entreprises (CASCADE)`);
      });
      console.log('');
    }

    // 5. Vérifier la fonction delete_entreprise_complete
    console.log('📋 FONCTION delete_entreprise_complete:');
    console.log('='.repeat(60));
    const functionDef = await client.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'delete_entreprise_complete';
    `);
    if (functionDef.rows.length === 0) {
      console.log('  ❌ Fonction non trouvée\n');
    } else {
      console.log('  ✅ Fonction trouvée');
      // Afficher seulement les premières lignes pour voir la structure
      const def = functionDef.rows[0].definition;
      const lines = def.split('\n').slice(0, 50);
      console.log('  Premières lignes:');
      lines.forEach(line => console.log(`    ${line}`));
      console.log('  ...\n');
    }

    // 6. Vérifier s'il y a des triggers BEFORE DELETE problématiques
    console.log('⚠️  TRIGGERS BEFORE DELETE (potentiellement problématiques):');
    console.log('='.repeat(60));
    const beforeTriggers = await client.query(`
      SELECT 
        tgname as trigger_name,
        tgrelid::regclass as table_name,
        pg_get_triggerdef(oid) as trigger_definition
      FROM pg_trigger
      WHERE tgtype & 2 = 2  -- BEFORE trigger
        AND NOT tgisinternal
        AND tgrelid::regclass::text IN ('entreprises', 'clients', 'espaces_membres_clients')
      ORDER BY tgrelid::regclass::text, tgname;
    `);
    if (beforeTriggers.rows.length === 0) {
      console.log('  ✅ Aucun trigger BEFORE DELETE trouvé\n');
    } else {
      console.log('  ⚠️  ATTENTION: Triggers BEFORE DELETE trouvés:\n');
      beforeTriggers.rows.forEach(t => {
        console.log(`  - ${t.table_name}.${t.trigger_name}`);
        console.log(`    ${t.trigger_definition}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

analyzeDatabase();


