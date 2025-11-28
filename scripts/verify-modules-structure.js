#!/usr/bin/env node

/**
 * Script pour vérifier la structure des modules par métier
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

function getPostgresConnection() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) return dbUrl;

  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (!dbHost && !dbUrl) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (supabaseUrl && dbPassword) {
      const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
      if (urlMatch) {
        const projectRef = urlMatch[1];
        return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:${dbPort}/${dbName}`;
      }
    }
  }

  if (dbHost && dbPassword) {
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  throw new Error('Connexion PostgreSQL impossible');
}

async function verifyStructure() {
  console.log('🔍 Vérification de la structure des modules par métier...\n');

  const client = new Client({
    connectionString: getPostgresConnection(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');

    // 1. Vérifier modules_activation
    console.log('📋 1. Table modules_activation:');
    const { rows: modulesCols } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'modules_activation'
      ORDER BY ordinal_position;
    `);
    
    const newCols = modulesCols.filter(col => 
      ['secteur_activite', 'priorite', 'icone', 'route', 'module_parent', 'prix_optionnel', 'est_cree'].includes(col.column_name)
    );
    
    console.log(`   Total colonnes: ${modulesCols.length}`);
    console.log(`   Nouvelles colonnes: ${newCols.length}\n`);
    
    newCols.forEach(col => {
      console.log(`   ✅ ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // 2. Vérifier modules_metier
    console.log('\n📋 2. Table modules_metier:');
    const { rows: metierCols } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'modules_metier'
      ORDER BY ordinal_position;
    `);
    
    console.log(`   Colonnes: ${metierCols.length}\n`);
    metierCols.forEach(col => {
      console.log(`   ✅ ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)}`);
    });

    // Vérifier la contrainte CHECK sur secteur_activite
    const { rows: checkConstraints } = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%secteur%';
    `);
    
    if (checkConstraints.length > 0) {
      console.log(`   ✅ Contrainte CHECK secteur_activite: ${checkConstraints[0].constraint_name}`);
    }

    // 3. Vérifier abonnements_modules
    console.log('\n📋 3. Table abonnements_modules:');
    const { rows: aboCols } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'abonnements_modules'
      ORDER BY ordinal_position;
    `);
    
    console.log(`   Colonnes: ${aboCols.length}\n`);
    aboCols.forEach(col => {
      console.log(`   ✅ ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)}`);
    });

    // 4. Vérifier les index
    console.log('\n📋 4. Index créés:');
    const { rows: indexes } = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (tablename IN ('modules_metier', 'abonnements_modules')
           OR indexname LIKE '%modules_metier%' OR indexname LIKE '%abonnements_modules%')
      ORDER BY tablename, indexname;
    `);
    
    indexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname.padEnd(40)} sur ${idx.tablename}`);
    });

    // 5. Vérifier les fonctions RPC
    console.log('\n📋 5. Fonctions RPC créées:');
    const { rows: functions } = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('get_modules_by_secteur', 'get_modules_by_abonnement')
      ORDER BY routine_name;
    `);
    
    functions.forEach(func => {
      console.log(`   ✅ ${func.routine_name}() - ${func.routine_type}`);
    });

    // 6. Vérifier les politiques RLS
    console.log('\n📋 6. Politiques RLS créées:');
    const { rows: policies } = await client.query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('modules_metier', 'abonnements_modules')
      ORDER BY tablename, policyname;
    `);
    
    policies.forEach(pol => {
      console.log(`   ✅ ${pol.policyname.padEnd(50)} sur ${pol.tablename}`);
    });

    // 7. Vérifier les données existantes
    console.log('\n📋 7. Modules existants dans modules_activation:');
    const { rows: existingModules } = await client.query(`
      SELECT module_code, module_nom, categorie, actif, est_cree
      FROM modules_activation
      ORDER BY categorie, module_nom;
    `);
    
    if (existingModules.length > 0) {
      console.log(`   Total: ${existingModules.length} modules\n`);
      existingModules.forEach(mod => {
        const status = mod.actif ? '✅' : '⏸️';
        const created = mod.est_cree ? 'Créé' : 'À créer';
        console.log(`   ${status} ${mod.module_code.padEnd(30)} ${mod.module_nom.padEnd(30)} ${mod.categorie.padEnd(10)} ${created}`);
      });
    } else {
      console.log('   Aucun module trouvé');
    }

    // 8. Test de la fonction get_modules_by_secteur
    console.log('\n📋 8. Test fonction get_modules_by_secteur:');
    try {
      const { rows: testSecteur } = await client.query(`SELECT * FROM get_modules_by_secteur('transversal') LIMIT 5;`);
      if (testSecteur.length > 0) {
        console.log(`   ✅ Fonction opérationnelle (retourne ${testSecteur.length} résultat(s))`);
      } else {
        console.log('   ⚠️  Fonction opérationnelle mais aucun module trouvé pour "transversal"');
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
    }

    // 9. Test de la fonction get_modules_by_abonnement
    console.log('\n📋 9. Test fonction get_modules_by_abonnement:');
    try {
      // Essayer de trouver un abonnement existant
      const { rows: abonnements } = await client.query(`SELECT id FROM abonnements LIMIT 1;`);
      if (abonnements.length > 0) {
        const { rows: testAbo } = await client.query(`SELECT * FROM get_modules_by_abonnement($1) LIMIT 5;`, [abonnements[0].id]);
        console.log(`   ✅ Fonction opérationnelle (retourne ${testAbo.length} résultat(s) pour abonnement ${abonnements[0].id})`);
      } else {
        console.log('   ⚠️  Fonction opérationnelle mais aucun abonnement trouvé pour tester');
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
    }

    console.log('\n✅✅✅ Vérification terminée avec succès !\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:');
    console.error(`   ${error.message}\n`);
    throw error;
  } finally {
    await client.end();
  }
}

verifyStructure().catch(error => {
  console.error('\n❌ Échec:', error.message);
  process.exit(1);
});




