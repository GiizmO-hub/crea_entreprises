#!/usr/bin/env node
/**
 * Diagnostic complet du workflow Stripe
 * Vérifie les abonnements, paiements, et le flux complet
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const envPaths = [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  
  const env = {};
  
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            env[key] = value;
          }
        }
      });
    }
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL manquante !');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false,
  },
});

async function diagnosticComplet() {
  console.log('\n🔍 DIAGNOSTIC COMPLET DU WORKFLOW STRIPE\n');
  console.log('═'.repeat(80));
  
  const client = await pool.connect();
  
  try {
    // 1. Vérifier les abonnements
    console.log('\n1️⃣  ABONNEMENTS SOUSCRITS\n');
    const { rows: abonnements } = await client.query(`
      SELECT 
        a.id,
        a.entreprise_id,
        a.plan_id,
        a.statut,
        a.date_debut,
        a.date_fin,
        a.created_at,
        pa.nom as plan_nom,
        e.nom as entreprise_nom
      FROM abonnements a
      LEFT JOIN plans_abonnement pa ON a.plan_id = pa.id
      LEFT JOIN entreprises e ON a.entreprise_id = e.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);
    
    if (abonnements.length === 0) {
      console.log('   ⚠️  AUCUN ABONNEMENT TROUVÉ');
    } else {
      console.log(`   ✅ ${abonnements.length} abonnement(s) trouvé(s):\n`);
      abonnements.forEach((ab, idx) => {
        console.log(`   ${idx + 1}. ID: ${ab.id}`);
        console.log(`      Entreprise: ${ab.entreprise_nom || 'N/A'} (${ab.entreprise_id})`);
        console.log(`      Plan: ${ab.plan_nom || 'N/A'} (${ab.plan_id})`);
        console.log(`      Statut: ${ab.statut}`);
        console.log(`      Date début: ${ab.date_debut}`);
        console.log(`      Date fin: ${ab.date_fin}`);
        console.log(`      Créé le: ${ab.created_at}\n`);
      });
    }
    
    // 2. Vérifier les paiements Stripe
    console.log('\n2️⃣  PAIEMENTS STRIPE\n');
    const { rows: paiements } = await client.query(`
      SELECT 
        id,
        entreprise_id,
        statut,
        methode_paiement,
        montant_ttc,
        stripe_payment_id,
        date_paiement,
        created_at,
        notes
      FROM paiements
      WHERE methode_paiement = 'stripe'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (paiements.length === 0) {
      console.log('   ⚠️  AUCUN PAIEMENT STRIPE TROUVÉ');
    } else {
      console.log(`   📊 ${paiements.length} paiement(s) Stripe trouvé(s):\n`);
      
      const stats = {
        en_attente: 0,
        paye: 0,
        echec: 0,
        autre: 0
      };
      
      paiements.forEach((p, idx) => {
        stats[p.statut] = (stats[p.statut] || 0) + 1;
        if (idx < 5) { // Afficher les 5 premiers en détail
          console.log(`   ${idx + 1}. ID: ${p.id}`);
          console.log(`      Entreprise: ${p.entreprise_id}`);
          console.log(`      Statut: ${p.statut}`);
          console.log(`      Montant: ${p.montant_ttc}€`);
          console.log(`      Stripe Payment ID: ${p.stripe_payment_id || 'N/A'}`);
          console.log(`      Date paiement: ${p.date_paiement || 'N/A'}`);
          console.log(`      Créé le: ${p.created_at}`);
          
          // Analyser les notes
          let notes = null;
          try {
            notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
            if (notes?.plan_id) {
              console.log(`      Plan ID dans notes: ${notes.plan_id}`);
            }
          } catch (e) {
            // Ignorer
          }
          console.log('');
        }
      });
      
      console.log('\n   📊 STATISTIQUES DES STATUTS:');
      Object.entries(stats).forEach(([statut, count]) => {
        console.log(`      ${statut}: ${count}`);
      });
    }
    
    // 3. Vérifier les factures liées aux paiements
    console.log('\n3️⃣  FACTURES LIÉES AUX PAIEMENTS\n');
    const { rows: factures } = await client.query(`
      SELECT 
        f.id,
        f.numero,
        f.entreprise_id,
        f.statut,
        f.montant_ttc,
        f.date_emission,
        f.paiement_id,
        p.statut as paiement_statut,
        p.stripe_payment_id
      FROM factures f
      LEFT JOIN paiements p ON f.paiement_id = p.id
      WHERE p.methode_paiement = 'stripe' OR f.paiement_id IS NOT NULL
      ORDER BY f.created_at DESC
      LIMIT 10
    `);
    
    if (factures.length === 0) {
      console.log('   ⚠️  AUCUNE FACTURE LIÉE AUX PAIEMENTS STRIPE');
    } else {
      console.log(`   ✅ ${factures.length} facture(s) trouvée(s):\n`);
      factures.forEach((f, idx) => {
        console.log(`   ${idx + 1}. Facture: ${f.numero || f.id}`);
        console.log(`      Entreprise: ${f.entreprise_id}`);
        console.log(`      Statut facture: ${f.statut}`);
        console.log(`      Montant: ${f.montant_ttc}€`);
        console.log(`      Paiement ID: ${f.paiement_id || 'N/A'}`);
        if (f.paiement_statut) {
          console.log(`      Statut paiement: ${f.paiement_statut}`);
        }
        if (f.stripe_payment_id) {
          console.log(`      Stripe Payment ID: ${f.stripe_payment_id}`);
        }
        console.log('');
      });
    }
    
    // 4. Vérifier les entreprises créées récemment
    console.log('\n4️⃣  ENTREPRISES CRÉÉES RÉCEMMENT\n');
    const { rows: entreprises } = await client.query(`
      SELECT 
        id,
        nom,
        statut,
        created_at,
        (SELECT COUNT(*) FROM abonnements WHERE entreprise_id = e.id) as nb_abonnements,
        (SELECT COUNT(*) FROM factures WHERE entreprise_id = e.id) as nb_factures,
        (SELECT COUNT(*) FROM paiements WHERE entreprise_id = e.id AND methode_paiement = 'stripe') as nb_paiements_stripe
      FROM entreprises e
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (entreprises.length === 0) {
      console.log('   ⚠️  AUCUNE ENTREPRISE TROUVÉE');
    } else {
      console.log(`   📊 ${entreprises.length} entreprise(s) trouvée(s):\n`);
      entreprises.forEach((e, idx) => {
        console.log(`   ${idx + 1}. ${e.nom} (${e.id})`);
        console.log(`      Statut: ${e.statut}`);
        console.log(`      Abonnements: ${e.nb_abonnements}`);
        console.log(`      Factures: ${e.nb_factures}`);
        console.log(`      Paiements Stripe: ${e.nb_paiements_stripe}`);
        console.log(`      Créée le: ${e.created_at}\n`);
      });
    }
    
    // 5. Vérifier les Edge Functions Stripe
    console.log('\n5️⃣  VÉRIFICATION DES EDGE FUNCTIONS STRIPE\n');
    console.log('   → Vérification des fichiers Edge Functions...\n');
    
    const edgeFunctionsPath = join(__dirname, '..', 'supabase', 'functions');
    const functionsToCheck = [
      'create-stripe-checkout',
      'stripe-webhooks'
    ];
    
    for (const funcName of functionsToCheck) {
      const funcPath = join(edgeFunctionsPath, funcName, 'index.ts');
      if (existsSync(funcPath)) {
        console.log(`   ✅ ${funcName}/index.ts existe`);
        
        const content = readFileSync(funcPath, 'utf8');
        if (content.includes('STRIPE_SECRET_KEY') || content.includes('STRIPE_WEBHOOK_SECRET')) {
          console.log(`      ✅ Variables Stripe configurées`);
        } else {
          console.log(`      ⚠️  Variables Stripe non trouvées dans le code`);
        }
      } else {
        console.log(`   ❌ ${funcName}/index.ts MANQUANT`);
      }
    }
    
    // 6. Résumé et recommandations
    console.log('\n' + '═'.repeat(80));
    console.log('\n📋 RÉSUMÉ DU DIAGNOSTIC\n');
    
    const recommendations = [];
    
    if (abonnements.length === 0) {
      recommendations.push('⚠️  Aucun abonnement trouvé - le workflow de création d\'abonnement après paiement ne fonctionne pas');
    }
    
    const paiementsEnAttente = paiements.filter(p => p.statut === 'en_attente').length;
    if (paiementsEnAttente > 0) {
      recommendations.push(`⚠️  ${paiementsEnAttente} paiement(s) en attente - les webhooks Stripe ne sont peut-être pas configurés correctement`);
    }
    
    const paiementsSansStripeId = paiements.filter(p => !p.stripe_payment_id && p.statut === 'paye').length;
    if (paiementsSansStripeId > 0) {
      recommendations.push(`⚠️  ${paiementsSansStripeId} paiement(s) marqué(s) comme "paye" sans stripe_payment_id - peut-être forçé manuellement`);
    }
    
    if (recommendations.length > 0) {
      console.log('🚨 PROBLÈMES IDENTIFIÉS:\n');
      recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
    } else {
      console.log('✅ Aucun problème majeur identifié');
    }
    
    console.log('\n' + '═'.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

diagnosticComplet().catch(console.error);

