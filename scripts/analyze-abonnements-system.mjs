#!/usr/bin/env node

/**
 * Analyse complète du système d'abonnements
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

async function analyze() {
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

    // 1. Analyse de la table abonnements
    console.log('='.repeat(80));
    console.log('📊 TABLE: abonnements');
    console.log('='.repeat(80));
    
    const tableInfo = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'abonnements'
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColonnes:');
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 2. Contraintes et clés étrangères
    console.log('\n🔑 Contraintes et clés étrangères:');
    const constraints = await client.query(`
      SELECT
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'abonnements'::regclass
    `);
    
    constraints.rows.forEach(c => {
      console.log(`  - ${c.constraint_name} (${c.constraint_type}): ${c.definition}`);
    });

    // 3. Index
    console.log('\n📑 Index:');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'abonnements'
        AND schemaname = 'public'
    `);
    
    indexes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });

    // 4. Politiques RLS
    console.log('\n🔒 Politiques RLS:');
    const policies = await client.query(`
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'abonnements'
      ORDER BY cmd, policyname
    `);

    if (policies.rows.length > 0) {
      policies.rows.forEach((p, idx) => {
        console.log(`\n  ${idx + 1}. ${p.policyname} (${p.cmd})`);
        if (p.qual) {
          const qualPreview = p.qual.length > 200 ? p.qual.substring(0, 200) + '...' : p.qual;
          console.log(`     USING: ${qualPreview}`);
        }
        if (p.with_check) {
          const checkPreview = p.with_check.length > 200 ? p.with_check.substring(0, 200) + '...' : p.with_check;
          console.log(`     WITH CHECK: ${checkPreview}`);
        }
      });
    } else {
      console.log('  ⚠️  Aucune politique RLS trouvée');
    }

    // 5. Triggers
    console.log('\n⚡ Triggers:');
    const triggers = await client.query(`
      SELECT 
        tgname as trigger_name,
        tgenabled as enabled,
        pg_get_triggerdef(oid) as definition
      FROM pg_trigger
      WHERE tgrelid = 'abonnements'::regclass
        AND tgisinternal = false
    `);

    if (triggers.rows.length > 0) {
      triggers.rows.forEach((t, idx) => {
        console.log(`\n  ${idx + 1}. ${t.trigger_name}`);
        console.log(`     Activé: ${t.enabled}`);
        const defPreview = t.definition.length > 200 ? t.definition.substring(0, 200) + '...' : t.definition;
        console.log(`     Définition: ${defPreview}`);
      });
    } else {
      console.log('  ℹ️  Aucun trigger trouvé');
    }

    // 6. Fonctions liées aux abonnements
    console.log('\n🔧 Fonctions liées aux abonnements:');
    const functions = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (
          p.proname LIKE '%abonnement%'
          OR pg_get_functiondef(p.oid) LIKE '%abonnements%'
        )
      ORDER BY p.proname
    `);

    if (functions.rows.length > 0) {
      functions.rows.forEach((f, idx) => {
        console.log(`\n  ${idx + 1}. ${f.function_name}`);
        // Chercher les utilisations de MAX() sur UUID
        if (f.definition && f.definition.match(/MAX\(.*uuid|MAX\(.*id\)/i)) {
          console.log(`     ⚠️  UTILISE MAX() SUR UUID - PROBLÈME POTENTIEL !`);
        }
      });
    } else {
      console.log('  ℹ️  Aucune fonction trouvée');
    }

    // 7. Vérifier RLS activé
    console.log('\n🔐 RLS Status:');
    const rlsStatus = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'abonnements'
    `);
    
    if (rlsStatus.rows.length > 0) {
      const rls = rlsStatus.rows[0];
      console.log(`  RLS activé: ${rls.relrowsecurity ? '✅ Oui' : '❌ Non'}`);
      console.log(`  RLS forcé: ${rls.relforcerowsecurity ? '✅ Oui' : '❌ Non'}`);
    }

    // 8. Statistiques de données
    console.log('\n📈 Statistiques:');
    const stats = await client.query(`
      SELECT COUNT(*) as total,
        COUNT(DISTINCT entreprise_id) as entreprises,
        COUNT(DISTINCT client_id) as clients,
        COUNT(DISTINCT plan_id) as plans
      FROM abonnements
    `);
    
    if (stats.rows.length > 0) {
      const s = stats.rows[0];
      console.log(`  Total abonnements: ${s.total}`);
      console.log(`  Entreprises distinctes: ${s.entreprises}`);
      console.log(`  Clients distincts: ${s.clients}`);
      console.log(`  Plans distincts: ${s.plans}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

analyze();


