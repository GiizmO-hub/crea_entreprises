#!/usr/bin/env node

/**
 * Script pour analyser la table plans_abonnement
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Charger les variables d'environnement
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Récupérer DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ou SUPABASE_DB_URL non défini dans .env');
  process.exit(1);
}

async function analyzeTable() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Vérifier la structure de la table
    console.log('📋 STRUCTURE DE LA TABLE plans_abonnement:');
    console.log('='.repeat(60));
    const structure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'plans_abonnement'
      ORDER BY ordinal_position;
    `);
    
    if (structure.rows.length === 0) {
      console.log('❌ La table plans_abonnement n\'existe pas !');
      await client.end();
      return;
    }
    
    structure.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      const defaultVal = col.column_default ? ` DEFAULT: ${col.column_default}` : '';
      const maxLength = col.character_maximum_length ? ` (max: ${col.character_maximum_length})` : '';
      console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}${maxLength}${defaultVal}`);
    });

    // 2. Compter les plans
    console.log('\n📊 CONTENU DE LA TABLE:');
    console.log('='.repeat(60));
    const count = await client.query('SELECT COUNT(*) as total FROM plans_abonnement');
    console.log(`Nombre total de plans: ${count.rows[0].total}\n`);

    // 3. Lister tous les plans
    const plans = await client.query(`
      SELECT 
        id,
        nom,
        description,
        prix_mensuel,
        prix_annuel,
        actif,
        ordre,
        max_entreprises,
        max_utilisateurs,
        fonctionnalites,
        created_at
      FROM plans_abonnement 
      ORDER BY ordre, nom
    `);

    if (plans.rows.length === 0) {
      console.log('⚠️ Aucun plan trouvé dans la table');
    } else {
      plans.rows.forEach((plan, index) => {
        console.log(`\n📦 Plan ${index + 1}:`);
        console.log(`  ID: ${plan.id}`);
        console.log(`  Nom: ${plan.nom}`);
        console.log(`  Description: ${plan.description || 'Aucune'}`);
        console.log(`  Prix mensuel: ${plan.prix_mensuel}€`);
        console.log(`  Prix annuel: ${plan.prix_annuel}€`);
        console.log(`  Actif: ${plan.actif ? '✅ Oui' : '❌ Non'}`);
        console.log(`  Ordre: ${plan.ordre}`);
        if (plan.max_entreprises) console.log(`  Max entreprises: ${plan.max_entreprises}`);
        if (plan.max_utilisateurs) console.log(`  Max utilisateurs: ${plan.max_utilisateurs}`);
        if (plan.fonctionnalites) {
          console.log(`  Fonctionnalités: ${JSON.stringify(plan.fonctionnalites, null, 2)}`);
        }
        console.log(`  Créé le: ${plan.created_at}`);
      });
    }

    // 4. Vérifier les plans actifs
    console.log('\n\n✅ PLANS ACTIFS:');
    console.log('='.repeat(60));
    const activePlans = await client.query(`
      SELECT id, nom, prix_mensuel, ordre 
      FROM plans_abonnement 
      WHERE actif = true 
      ORDER BY ordre
    `);
    console.log(`Nombre de plans actifs: ${activePlans.rows.length}`);
    activePlans.rows.forEach(plan => {
      console.log(`  - ${plan.nom} (${plan.prix_mensuel}€/mois, ordre: ${plan.ordre})`);
    });

    // 5. Vérifier les contraintes et index
    console.log('\n\n🔍 CONTRAINTES ET INDEX:');
    console.log('='.repeat(60));
    const constraints = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'plans_abonnement'::regclass
    `);
    
    if (constraints.rows.length > 0) {
      constraints.rows.forEach(con => {
        const type = con.constraint_type === 'p' ? 'PRIMARY KEY' : 
                     con.constraint_type === 'u' ? 'UNIQUE' :
                     con.constraint_type === 'f' ? 'FOREIGN KEY' :
                     con.constraint_type === 'c' ? 'CHECK' : con.constraint_type;
        console.log(`  ${type}: ${con.constraint_name}`);
        console.log(`    ${con.definition}`);
      });
    } else {
      console.log('  Aucune contrainte trouvée');
    }

    const indexes = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'plans_abonnement'
    `);
    
    if (indexes.rows.length > 0) {
      console.log('\n  Index:');
      indexes.rows.forEach(idx => {
        console.log(`    - ${idx.indexname}`);
      });
    }

    // 6. Vérifier les relations avec plans_modules
    console.log('\n\n🔗 RELATIONS AVEC plans_modules:');
    console.log('='.repeat(60));
    const relations = await client.query(`
      SELECT 
        pm.plan_id,
        p.nom as plan_nom,
        COUNT(pm.module_code) as nb_modules
      FROM plans_modules pm
      RIGHT JOIN plans_abonnement p ON p.id = pm.plan_id
      GROUP BY pm.plan_id, p.nom
      ORDER BY p.nom
    `);
    
    if (relations.rows.length > 0) {
      relations.rows.forEach(rel => {
        console.log(`  Plan "${rel.plan_nom}": ${rel.nb_modules || 0} module(s) associé(s)`);
      });
    } else {
      console.log('  Aucune relation trouvée (table plans_modules peut être vide)');
    }

    await client.end();
    console.log('\n✅ Analyse terminée');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:');
    console.error(error.message);
    if (error.code) console.error(`Code: ${error.code}`);
    if (error.detail) console.error(`Détail: ${error.detail}`);
    process.exit(1);
  }
}

// Exécuter
analyzeTable().catch(console.error);

