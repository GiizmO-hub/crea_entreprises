#!/usr/bin/env node

/**
 * Script pour tester la fonction create_abonnement_complete et identifier les erreurs
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

async function testFunction() {
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

    // Trouver un client pour tester
    const clientResult = await client.query(`
      SELECT id, email, entreprise_id
      FROM clients
      WHERE entreprise_id IN (
        SELECT id FROM entreprises WHERE user_id = $1
      )
      LIMIT 1
    `, [USER_ID]);

    if (clientResult.rows.length === 0) {
      console.log('⚠️  Aucun client trouvé pour tester');
      return;
    }

    const testClient = clientResult.rows[0];
    console.log(`📋 Client de test: ${testClient.email} (${testClient.id})\n`);

    // Trouver un plan
    const planResult = await client.query(`
      SELECT id, nom, prix_mensuel
      FROM plans_abonnement
      WHERE actif = true
      LIMIT 1
    `);

    if (planResult.rows.length === 0) {
      console.log('⚠️  Aucun plan trouvé pour tester');
      return;
    }

    const testPlan = planResult.rows[0];
    console.log(`📋 Plan de test: ${testPlan.nom} (${testPlan.id})\n`);

    // Tester la fonction avec logs activés
    console.log('🧪 Test de create_abonnement_complete...\n');
    
    // Simuler la session utilisateur
    await client.query(`SET LOCAL role = 'authenticated'`);
    await client.query(`SET LOCAL request.jwt.claims = json_build_object('sub', $1::text, 'role', 'authenticated')`, [USER_ID]);
    
    const result = await client.query(`
      SELECT create_abonnement_complete(
        $1::uuid,  -- p_client_id
        $2::uuid,  -- p_plan_id
        $3::uuid,  -- p_entreprise_id
        'mensuel', -- p_mode_paiement
        CURRENT_DATE, -- p_date_debut
        NULL,      -- p_date_fin
        NULL,      -- p_montant_mensuel
        ARRAY[]::uuid[], -- p_options_ids
        'actif'    -- p_statut
      ) as result
    `, [testClient.id, testPlan.id, testClient.entreprise_id]);

    console.log('📊 Résultat:', JSON.stringify(result.rows[0].result, null, 2));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('Position:', error.position);
    if (error.message.includes('more than one row')) {
      console.error('\n🔍 ERREUR "more than one row" détectée !');
      console.error('Cela signifie qu\'une requête SELECT ... INTO retourne plusieurs lignes.');
    }
  } finally {
    await client.end();
  }
}

testFunction();


