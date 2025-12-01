#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non défini');
  process.exit(1);
}

async function diagnose() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // 1. Vérifier la structure de la table abonnements
    console.log('📋 STRUCTURE DE LA TABLE abonnements:');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'abonnements'
      ORDER BY ordinal_position
    `);
    
    structure.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}`);
    });
    
    // 2. Vérifier le trigger
    console.log('\n🔍 TRIGGER:');
    const trigger = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'trigger_paiement_creer_facture_abonnement'
    `);
    
    if (trigger.rows.length > 0) {
      console.log('  ✅ Trigger existe:', trigger.rows[0].trigger_name);
    } else {
      console.log('  ❌ Trigger n\'existe pas');
    }
    
    // 3. Vérifier les paiements payés sans abonnement
    console.log('\n📊 PAIEMENTS PAYÉS SANS ABONNEMENT:');
    const paiementsSansAbonnement = await client.query(`
      SELECT 
        p.id as paiement_id,
        p.entreprise_id,
        p.statut,
        p.notes,
        e.nom as entreprise_nom
      FROM paiements p
      LEFT JOIN entreprises e ON e.id = p.entreprise_id
      WHERE p.statut = 'paye'
        AND p.entreprise_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM abonnements a
          WHERE a.entreprise_id = p.entreprise_id
            AND a.statut = 'actif'
        )
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    
    console.log(`  Nombre: ${paiementsSansAbonnement.rows.length}`);
    paiementsSansAbonnement.rows.forEach((p, i) => {
      console.log(`\n  ${i + 1}. Paiement ${p.paiement_id.substring(0, 8)}...`);
      console.log(`     Entreprise: ${p.entreprise_nom || p.entreprise_id}`);
      console.log(`     Notes: ${p.notes ? p.notes.substring(0, 100) : 'Aucune'}`);
    });
    
    // 4. Vérifier les abonnements existants
    console.log('\n📦 ABONNEMENTS EXISTANTS:');
    const abonnements = await client.query(`
      SELECT 
        a.id,
        a.entreprise_id,
        a.client_id,
        a.plan_id,
        a.statut,
        p.nom as plan_nom,
        e.nom as entreprise_nom
      FROM abonnements a
      LEFT JOIN plans_abonnement p ON p.id = a.plan_id
      LEFT JOIN entreprises e ON e.id = a.entreprise_id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);
    
    console.log(`  Nombre total: ${abonnements.rows.length}`);
    abonnements.rows.forEach((a, i) => {
      console.log(`\n  ${i + 1}. Abonnement ${a.id.substring(0, 8)}...`);
      console.log(`     Entreprise: ${a.entreprise_nom || a.entreprise_id}`);
      console.log(`     Client ID: ${a.client_id || 'NULL'}`);
      console.log(`     Plan: ${a.plan_nom || a.plan_id || 'NULL'}`);
      console.log(`     Statut: ${a.statut}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

diagnose().catch(console.error);

