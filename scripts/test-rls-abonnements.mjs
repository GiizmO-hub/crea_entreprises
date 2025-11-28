#!/usr/bin/env node

/**
 * Test des politiques RLS pour abonnements
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

async function testRLS() {
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

    // Tester la fonction is_platform_super_admin
    console.log('🧪 Test de la fonction is_platform_super_admin()...\n');
    
    try {
      // Simuler la session utilisateur
      await client.query(`SET LOCAL role = 'authenticated'`);
      await client.query(`SET LOCAL request.jwt.claims = json_build_object('sub', $1::text, 'role', 'authenticated')`, [USER_ID]);
      
      const result = await client.query(`SELECT is_platform_super_admin() as is_admin`);
      console.log(`   Résultat: ${result.rows[0].is_admin}\n`);
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}\n`);
    }

    // Tester la lecture des abonnements avec RLS
    console.log('🧪 Test de la lecture des abonnements avec RLS...\n');
    
    try {
      await client.query(`SET LOCAL role = 'authenticated'`);
      await client.query(`SET LOCAL request.jwt.claims = json_build_object('sub', $1::text, 'role', 'authenticated')`, [USER_ID]);
      
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM abonnements
      `);
      console.log(`   ✅ Lecture réussie: ${result.rows[0].count} abonnement(s)\n`);
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
      console.log(`   Code: ${error.code}\n`);
    }

    // Vérifier les politiques RLS actuelles
    console.log('📋 Politiques RLS sur abonnements:\n');
    const policies = await client.query(`
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'abonnements'
      ORDER BY cmd, policyname
    `);

    policies.rows.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.policyname} (${p.cmd})`);
      if (p.qual) {
        const qualPreview = p.qual.length > 100 ? p.qual.substring(0, 100) + '...' : p.qual;
        console.log(`   USING: ${qualPreview}`);
      }
      if (p.with_check) {
        const checkPreview = p.with_check.length > 100 ? p.with_check.substring(0, 100) + '...' : p.with_check;
        console.log(`   WITH CHECK: ${checkPreview}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

testRLS();


