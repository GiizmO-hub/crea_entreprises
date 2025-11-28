#!/usr/bin/env node

/**
 * Script de test pour identifier exactement où se produit l'erreur
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

const USER_ID = '060d7ec6-9307-4f6d-b85f-c89712774212';

const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function test() {
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
    console.log('✅ Connecté\n');

    // 1. Vérifier combien d'entreprises pour ce user
    const entreprises = await client.query(`
      SELECT id, nom, created_at
      FROM entreprises
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [USER_ID]);

    console.log(`📋 Entreprises trouvées pour user ${USER_ID}: ${entreprises.rows.length}`);
    entreprises.rows.forEach((e, idx) => {
      console.log(`   ${idx + 1}. ${e.nom} (${e.id}) - Créée: ${e.created_at}`);
    });

    if (entreprises.rows.length > 1) {
      console.log(`\n⚠️  PROBLÈME: ${entreprises.rows.length} entreprises pour le même user_id !`);
      console.log(`   Cela peut causer "more than one row" dans les requêtes SELECT id FROM entreprises WHERE user_id = ...`);
    }

    // 2. Trouver un client
    const clients = await client.query(`
      SELECT c.id, c.email, c.entreprise_id, e.nom as entreprise_nom
      FROM clients c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE e.user_id = $1
      LIMIT 1
    `, [USER_ID]);

    if (clients.rows.length === 0) {
      console.log('\n❌ Aucun client trouvé pour tester');
      return;
    }

    const testClient = clients.rows[0];
    console.log(`\n📋 Client de test: ${testClient.email}`);
    console.log(`   ID: ${testClient.id}`);
    console.log(`   Entreprise: ${testClient.entreprise_nom} (${testClient.entreprise_id})`);

    // 3. Trouver un plan
    const plan = await client.query(`
      SELECT id, nom, prix_mensuel
      FROM plans_abonnement
      WHERE actif = true
      LIMIT 1
    `);

    if (plan.rows.length === 0) {
      console.log('\n❌ Aucun plan actif trouvé');
      return;
    }

    const testPlan = plan.rows[0];
    console.log(`\n📋 Plan de test: ${testPlan.nom} (${testPlan.id})`);

    // 4. Activer les logs PostgreSQL
    await client.query('SET client_min_messages TO NOTICE');

    // 5. Tester la fonction
    console.log('\n🧪 Test de create_abonnement_complete...\n');

    // Simuler la session utilisateur
    await client.query(`SET LOCAL role = 'authenticated'`);
    await client.query(`SET LOCAL request.jwt.claims = json_build_object('sub', $1::text, 'role', 'authenticated')`, [USER_ID]);

    try {
      const result = await client.query(`
        SELECT create_abonnement_complete(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          'mensuel',
          CURRENT_DATE,
          NULL,
          NULL,
          ARRAY[]::uuid[],
          'actif'
        ) as result
      `, [testClient.id, testPlan.id, testClient.entreprise_id]);

      console.log('\n✅ SUCCÈS !');
      console.log('Résultat:', JSON.stringify(result.rows[0].result, null, 2));
    } catch (error) {
      console.log('\n❌ ERREUR DÉTECTÉE:');
      console.log(`   Message: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Detail: ${error.detail}`);
      console.log(`   Position: ${error.position}`);
      
      if (error.message.includes('more than one row')) {
        console.log('\n🔍 ANALYSE: Erreur "more than one row" détectée');
        console.log('   Cela signifie qu\'une requête SELECT ... INTO retourne plusieurs lignes.');
        console.log('   Les causes possibles:');
        console.log('   1. Plusieurs entreprises pour le même user_id');
        console.log('   2. Plusieurs clients avec le même ID (impossible mais vérifié)');
        console.log('   3. Plusieurs espaces membres pour le même client');
        console.log('   4. Plusieurs auth.users avec le même email');
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

test();


