#!/usr/bin/env node

/**
 * Script pour diagnostiquer les problèmes d'abonnements
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

async function checkAbonnements() {
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

    // 1. Lister tous les abonnements
    console.log('📊 Liste des abonnements:\n');
    
    const abonnements = await client.query(`
      SELECT 
        a.id,
        a.entreprise_id,
        a.client_id,
        a.plan_id,
        a.statut,
        a.date_debut,
        a.date_fin,
        a.montant_mensuel,
        a.mode_paiement,
        a.created_at,
        e.nom as entreprise_nom,
        p.nom as plan_nom,
        c.nom as client_nom,
        c.email as client_email
      FROM abonnements a
      LEFT JOIN entreprises e ON e.id = a.entreprise_id
      LEFT JOIN plans_abonnement p ON p.id = a.plan_id
      LEFT JOIN clients c ON c.id = (
        SELECT id FROM clients WHERE entreprise_id = a.entreprise_id LIMIT 1
      )
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    console.log(`📋 Total d'abonnements trouvés: ${abonnements.rows.length}\n`);

    if (abonnements.rows.length > 0) {
      abonnements.rows.forEach((ab, idx) => {
        console.log(`${idx + 1}. Abonnement ID: ${ab.id}`);
        console.log(`   Statut: ${ab.statut || 'NULL'}`);
        console.log(`   Entreprise: ${ab.entreprise_nom || 'NULL'} (${ab.entreprise_id})`);
        console.log(`   Client: ${ab.client_nom || 'NULL'} (${ab.client_email || 'NULL'})`);
        console.log(`   Plan: ${ab.plan_nom || 'NULL'}`);
        console.log(`   Montant: ${ab.montant_mensuel || 'NULL'}€/mois`);
        console.log(`   Mode paiement: ${ab.mode_paiement || 'NULL'}`);
        console.log(`   Date début: ${ab.date_debut}`);
        console.log(`   Client ID (user_id): ${ab.client_id || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Aucun abonnement trouvé\n');
    }

    // 2. Vérifier les problèmes potentiels
    console.log('🔍 Vérification des problèmes:\n');

    // Abonnements sans entreprise
    const abonnementsSansEntreprise = await client.query(`
      SELECT COUNT(*) as count
      FROM abonnements
      WHERE entreprise_id IS NULL
    `);
    console.log(`⚠️  Abonnements sans entreprise_id: ${abonnementsSansEntreprise.rows[0].count}`);

    // Abonnements sans plan
    const abonnementsSansPlan = await client.query(`
      SELECT COUNT(*) as count
      FROM abonnements
      WHERE plan_id IS NULL
    `);
    console.log(`⚠️  Abonnements sans plan_id: ${abonnementsSansPlan.rows[0].count}`);

    // Abonnements avec entreprise_id invalide
    const abonnementsEntrepriseInvalide = await client.query(`
      SELECT COUNT(*) as count
      FROM abonnements a
      WHERE NOT EXISTS (SELECT 1 FROM entreprises e WHERE e.id = a.entreprise_id)
    `);
    console.log(`⚠️  Abonnements avec entreprise_id invalide: ${abonnementsEntrepriseInvalide.rows[0].count}`);

    // Abonnements avec plan_id invalide
    const abonnementsPlanInvalide = await client.query(`
      SELECT COUNT(*) as count
      FROM abonnements a
      WHERE a.plan_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM plans_abonnement p WHERE p.id = a.plan_id)
    `);
    console.log(`⚠️  Abonnements avec plan_id invalide: ${abonnementsPlanInvalide.rows[0].count}`);

    console.log('');

    // 3. Vérifier les RLS policies
    console.log('🔒 Vérification des politiques RLS:\n');
    
    const policies = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE tablename = 'abonnements'
      ORDER BY cmd, policyname
    `);

    if (policies.rows.length > 0) {
      policies.rows.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.policyname} (${p.cmd})`);
      });
    } else {
      console.log('   ⚠️  AUCUNE politique RLS trouvée pour abonnements !');
    }

    console.log('');

    // 4. Vérifier la fonction create_abonnement_complete
    console.log('🔧 Vérification de la fonction create_abonnement_complete:\n');
    
    const functionExists = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'create_abonnement_complete'
    `);

    if (functionExists.rows.length > 0) {
      console.log('   ✅ Fonction existe');
      const funcSrc = functionExists.rows[0].prosrc;
      if (funcSrc.includes('RAISE NOTICE')) {
        console.log('   ✅ Logs activés');
      } else {
        console.log('   ⚠️  Pas de logs dans la fonction');
      }
    } else {
      console.log('   ❌ Fonction n\'existe pas !');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkAbonnements();


