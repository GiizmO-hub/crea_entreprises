#!/usr/bin/env node

/**
 * Script pour vérifier les politiques RLS sur la table entreprises
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
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

// Extraire le project ref
const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Format d\'URL invalide');
  process.exit(1);
}

const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function checkRLS() {
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

    // 1. Vérifier si RLS est activé
    console.log('🔍 Vérification RLS sur la table entreprises...\n');
    
    const rlsEnabled = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'entreprises'
    `);

    if (rlsEnabled.rows.length > 0) {
      const row = rlsEnabled.rows[0];
      console.log(`📊 RLS activé: ${row.relrowsecurity}`);
      console.log(`📊 RLS forcé: ${row.relforcerowsecurity}\n`);
    }

    // 2. Lister toutes les politiques RLS
    console.log('📋 Politiques RLS sur la table entreprises:\n');
    
    const policies = await client.query(`
      SELECT 
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'entreprises'
      ORDER BY cmd, policyname
    `);

    if (policies.rows.length > 0) {
      policies.rows.forEach((policy, idx) => {
        console.log(`${idx + 1}. ${policy.policyname}`);
        console.log(`   Commande: ${policy.cmd}`);
        console.log(`   Rôles: ${policy.roles?.join(', ') || 'all'}`);
        console.log(`   Condition USING: ${policy.qual || 'NULL'}`);
        console.log(`   Condition WITH CHECK: ${policy.with_check || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Aucune politique RLS trouvée\n');
    }

    // 3. Tester la requête avec le user_id comme si c'était l'utilisateur connecté
    console.log('🧪 Test de requête avec SET ROLE...\n');
    
    // D'abord, vérifier si l'utilisateur existe dans auth.users
    const userCheck = await client.query(`
      SELECT id, email
      FROM auth.users
      WHERE id = $1
    `, [USER_ID]);

    if (userCheck.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé dans auth.users\n');
    } else {
      console.log(`✅ Utilisateur trouvé: ${userCheck.rows[0].email}\n`);
      
      // Simuler la requête que fait le frontend
      console.log('🧪 Test de la requête SELECT avec SET LOCAL...\n');
      
      try {
        // Simuler la session utilisateur
        await client.query(`SET LOCAL request.jwt.claims = json_build_object('sub', $1::text)`, [USER_ID]);
        await client.query(`SET LOCAL role = 'authenticated'`);
        
        const testResult = await client.query(`
          SELECT id, nom, user_id, statut
          FROM entreprises
          WHERE user_id = $1
          LIMIT 5
        `, [USER_ID]);

        console.log(`✅ Résultat avec simulation utilisateur: ${testResult.rows.length} entreprises\n`);
        
        if (testResult.rows.length > 0) {
          testResult.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.nom} (${row.statut})`);
          });
        }
      } catch (error) {
        console.log(`❌ Erreur lors du test: ${error.message}\n`);
      }
    }

    // 4. Vérifier les permissions directes
    console.log('\n📋 Permissions GRANT sur la table entreprises:\n');
    
    const grants = await client.query(`
      SELECT 
        grantee,
        privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'entreprises'
      ORDER BY grantee, privilege_type
    `);

    if (grants.rows.length > 0) {
      grants.rows.forEach((grant) => {
        console.log(`- ${grant.grantee}: ${grant.privilege_type}`);
      });
    } else {
      console.log('⚠️  Aucune permission GRANT trouvée\n');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkRLS();


