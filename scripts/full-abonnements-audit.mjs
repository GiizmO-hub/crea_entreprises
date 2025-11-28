#!/usr/bin/env node

/**
 * Audit complet du système d'abonnements
 * Vérifie toutes les fonctions, triggers, politiques RLS, et données
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, DB_PASSWORD;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_DB_PASSWORD') {
        DB_PASSWORD = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
DB_PASSWORD = DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function fullAudit() {
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    console.log('='.repeat(80));
    console.log('🔍 AUDIT COMPLET DU SYSTÈME D\'ABONNEMENTS');
    console.log('='.repeat(80));
    console.log('');

    // ========================================================================
    // PARTIE 1: ANALYSE DES FONCTIONS - Recherche de SELECT ... INTO
    // ========================================================================
    console.log('📋 PARTIE 1: ANALYSE DES FONCTIONS');
    console.log('-'.repeat(80));
    
    const functions = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (
          p.proname LIKE '%abonnement%'
          OR p.proname LIKE '%sync%'
          OR p.proname LIKE '%link%'
          OR pg_get_functiondef(p.oid) LIKE '%abonnements%'
        )
      ORDER BY p.proname
    `);

    console.log(`\n🔧 ${functions.rows.length} fonction(s) trouvée(s)\n`);

    const problematicFunctions = [];

    for (const func of functions.rows) {
      const def = func.definition || '';
      const lines = def.split('\n');
      const issues = [];

      // Chercher SELECT ... INTO sans LIMIT 1
      const selectIntoPattern = /SELECT\s+[^INTO]*INTO\s+\w+/gi;
      let match;
      while ((match = selectIntoPattern.exec(def)) !== null) {
        const selectLine = match[0];
        const lineNum = def.substring(0, match.index).split('\n').length;
        
        // Vérifier si LIMIT 1 est présent dans les prochaines lignes
        const afterMatch = def.substring(match.index + match[0].length);
        const nextLines = afterMatch.split('\n').slice(0, 5).join('\n');
        
        if (!nextLines.match(/LIMIT\s+1/i) && !selectLine.match(/MAX\(/i)) {
          issues.push({
            type: 'SELECT INTO sans LIMIT 1',
            line: lineNum,
            code: selectLine.substring(0, 100)
          });
        }
      }

      // Chercher MAX() sur UUID
      if (def.match(/MAX\(\s*\w*id\s*\)/i) && !def.match(/MAX\(email\)/i)) {
        issues.push({
          type: 'MAX() sur UUID (peut causer erreur)',
          line: 0,
          code: 'Utilise MAX() sur une colonne ID'
        });
      }

      if (issues.length > 0) {
        problematicFunctions.push({
          name: func.function_name,
          issues: issues,
          definition: def
        });
        
        console.log(`⚠️  ${func.function_name}:`);
        issues.forEach(issue => {
          console.log(`   - ${issue.type}`);
          if (issue.code) console.log(`     Code: ${issue.code}`);
        });
        console.log('');
      } else {
        console.log(`✅ ${func.function_name}: Aucun problème détecté`);
      }
    }

    // ========================================================================
    // PARTIE 2: ANALYSE DES TRIGGERS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('⚡ PARTIE 2: ANALYSE DES TRIGGERS');
    console.log('-'.repeat(80));

    const triggers = await client.query(`
      SELECT 
        tgname as trigger_name,
        pg_get_triggerdef(oid) as definition,
        (SELECT proname FROM pg_proc WHERE oid = tgfoid) as function_name
      FROM pg_trigger
      WHERE tgrelid = 'abonnements'::regclass
        AND tgisinternal = false
    `);

    console.log(`\n⚡ ${triggers.rows.length} trigger(s) trouvé(s)\n`);

    for (const trigger of triggers.rows) {
      console.log(`📌 ${trigger.trigger_name}`);
      console.log(`   Fonction: ${trigger.function_name}`);
      
      // Analyser la fonction du trigger
      const triggerFunc = await client.query(`
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc
        WHERE proname = $1
        LIMIT 1
      `, [trigger.function_name]);

      if (triggerFunc.rows.length > 0) {
        const funcDef = triggerFunc.rows[0].definition;
        if (funcDef.match(/SELECT\s+[^INTO]*INTO.*LIMIT/i)) {
          console.log(`   ✅ Utilise LIMIT dans SELECT ... INTO`);
        } else if (funcDef.match(/SELECT\s+[^INTO]*INTO/i)) {
          console.log(`   ⚠️  Contient SELECT ... INTO sans vérification LIMIT`);
        }
      }
      console.log('');
    }

    // ========================================================================
    // PARTIE 3: VÉRIFICATION DES DONNÉES - Doublons potentiels
    // ========================================================================
    console.log('='.repeat(80));
    console.log('📊 PARTIE 3: VÉRIFICATION DES DONNÉES');
    console.log('-'.repeat(80));

    // Vérifier les clients sans entreprise_id
    const clientsSansEntreprise = await client.query(`
      SELECT COUNT(*) as count
      FROM clients
      WHERE entreprise_id IS NULL
    `);
    console.log(`\n📋 Clients sans entreprise_id: ${clientsSansEntreprise.rows[0].count}`);

    // Vérifier les espaces membres sans abonnement_id
    const espacesSansAbonnement = await client.query(`
      SELECT COUNT(*) as count
      FROM espaces_membres_clients
      WHERE abonnement_id IS NULL
    `);
    console.log(`📋 Espaces membres sans abonnement_id: ${espacesSansAbonnement.rows[0].count}`);

    // Vérifier les doublons potentiels (clients avec même email)
    const doublonsClients = await client.query(`
      SELECT email, COUNT(*) as count
      FROM clients
      WHERE email IS NOT NULL
      GROUP BY email
      HAVING COUNT(*) > 1
    `);
    console.log(`📋 Emails de clients dupliqués: ${doublonsClients.rows.length}`);
    if (doublonsClients.rows.length > 0) {
      console.log('   ⚠️  Doublons trouvés:');
      doublonsClients.rows.forEach(d => {
        console.log(`      - ${d.email}: ${d.count} occurrences`);
      });
    }

    // Vérifier les entreprises multiples pour un même user_id
    const entreprisesMultiples = await client.query(`
      SELECT user_id, COUNT(*) as count
      FROM entreprises
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);
    console.log(`\n📋 Users avec plusieurs entreprises: ${entreprisesMultiples.rows.length}`);
    if (entreprisesMultiples.rows.length > 0) {
      console.log('   ⚠️  Cas trouvés:');
      entreprisesMultiples.rows.forEach(e => {
        console.log(`      - User ${e.user_id}: ${e.count} entreprises`);
      });
    }

    // ========================================================================
    // PARTIE 4: VÉRIFICATION DES POLITIQUES RLS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔒 PARTIE 4: POLITIQUES RLS');
    console.log('-'.repeat(80));

    const policies = await client.query(`
      SELECT 
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'abonnements'
      ORDER BY cmd
    `);

    console.log(`\n🔒 ${policies.rows.length} politique(s) RLS trouvée(s)\n`);

    for (const policy of policies.rows) {
      console.log(`📌 ${policy.policyname} (${policy.cmd})`);
      
      // Vérifier si utilise auth.users directement
      if (policy.qual && policy.qual.includes('auth.users')) {
        console.log('   ⚠️  Accède directement à auth.users - peut causer des problèmes');
      }
      
      // Vérifier si utilise check_is_super_admin
      if (policy.qual && policy.qual.includes('check_is_super_admin')) {
        console.log('   ✅ Utilise check_is_super_admin()');
      }
      
      console.log('');
    }

    // ========================================================================
    // PARTIE 5: TEST DE CRÉATION D'ABONNEMENT
    // ========================================================================
    console.log('='.repeat(80));
    console.log('🧪 PARTIE 5: TEST SIMULÉ DE CRÉATION');
    console.log('-'.repeat(80));

    // Trouver un client de test
    const testClient = await client.query(`
      SELECT c.id, c.email, c.entreprise_id, e.user_id
      FROM clients c
      JOIN entreprises e ON e.id = c.entreprise_id
      LIMIT 1
    `);

    if (testClient.rows.length > 0) {
      const client = testClient.rows[0];
      console.log(`\n📋 Client de test: ${client.email}`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Entreprise ID: ${client.entreprise_id}`);
      console.log(`   User ID (entreprise): ${client.user_id}`);

      // Vérifier combien d'entreprises pour ce user_id
      const entreprisesCount = await client.query(`
        SELECT COUNT(*) as count
        FROM entreprises
        WHERE user_id = $1
      `, [client.user_id]);
      
      console.log(`   ⚠️  Nombre d'entreprises pour ce user: ${entreprisesCount.rows[0].count}`);
      
      if (parseInt(entreprisesCount.rows[0].count) > 1) {
        console.log(`   ❌ PROBLÈME: Plusieurs entreprises pour le même user_id !`);
        console.log(`      Cela peut causer "more than one row" dans les requêtes.`);
      }

      // Vérifier le plan
      const plan = await client.query(`
        SELECT id, nom
        FROM plans_abonnement
        WHERE actif = true
        LIMIT 1
      `);

      if (plan.rows.length > 0) {
        console.log(`\n📋 Plan de test: ${plan.rows[0].nom}`);
        console.log(`   ID: ${plan.rows[0].id}`);
      }
    }

    // ========================================================================
    // PARTIE 6: RÉSUMÉ ET RECOMMANDATIONS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📝 RÉSUMÉ ET RECOMMANDATIONS');
    console.log('='.repeat(80));

    if (problematicFunctions.length > 0) {
      console.log(`\n❌ ${problematicFunctions.length} fonction(s) problématique(s) détectée(s)`);
    } else {
      console.log('\n✅ Aucune fonction problématique détectée');
    }

    if (entreprisesMultiples.rows.length > 0) {
      console.log(`\n❌ ${entreprisesMultiples.rows.length} user(s) avec plusieurs entreprises`);
      console.log('   → Cela peut causer "more than one row" dans les requêtes SELECT');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

fullAudit();


