#!/usr/bin/env node
/**
 * Script de diagnostic complet Supabase pour Stripe
 * Récupère toutes les informations nécessaires pour diagnostiquer les problèmes Stripe
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const env = {};
  const envPaths = [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  
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
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = env.DATABASE_URL;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

console.log('\n🔍 DIAGNOSTIC COMPLET SUPABASE POUR STRIPE\n');
console.log('═'.repeat(80));

async function diagnosticComplet() {
  const report = {
    configuration: {},
    edgeFunctions: {},
    paiements: {},
    webhooks: {},
    recommendations: []
  };
  
  try {
    // 1. CONFIGURATION
    console.log('\n1️⃣  CONFIGURATION SUPABASE\n');
    
    report.configuration = {
      supabase_url: supabaseUrl,
      service_key_configured: !!supabaseServiceKey,
      database_url_configured: !!DATABASE_URL
    };
    
    console.log(`   📋 URL Supabase: ${supabaseUrl}`);
    console.log(`   ${supabaseServiceKey ? '✅' : '⚠️'} Service Role Key configuré: ${supabaseServiceKey ? 'Oui' : 'Non'}`);
    console.log(`   ${DATABASE_URL ? '✅' : '⚠️'} Database URL configuré: ${DATABASE_URL ? 'Oui' : 'Non'}`);
    
    // Note: Les secrets Edge Functions ne sont pas accessibles via l'API client
    console.log('\n   ⚠️  VÉRIFICATION MANUELLE REQUISE :');
    console.log('      → Ouvrir Supabase Dashboard → Settings → Edge Functions → Secrets');
    console.log('      → Vérifier que STRIPE_SECRET_KEY est présent');
    console.log('      → Vérifier que STRIPE_WEBHOOK_SECRET est présent');
    
    report.configuration.secrets_check = 'MANUAL_CHECK_REQUIRED';
    
    // 2. EDGE FUNCTIONS
    console.log('\n\n2️⃣  EDGE FUNCTIONS\n');
    
    const edgeFunctions = ['create-stripe-checkout', 'stripe-webhooks'];
    
    for (const funcName of edgeFunctions) {
      console.log(`\n   📁 ${funcName}`);
      
      // Vérifier si le fichier existe localement
      const funcPath = join(__dirname, '..', 'supabase', 'functions', funcName, 'index.ts');
      if (existsSync(funcPath)) {
        console.log('      ✅ Fichier local existe');
        
        const content = readFileSync(funcPath, 'utf8');
        
        // Vérifier les imports Stripe
        if (content.includes('import Stripe')) {
          const versionMatch = content.match(/stripe@([\d.]+)/);
          console.log(`      ✅ Version Stripe: ${versionMatch ? versionMatch[1] : 'N/A'}`);
        }
        
        // Vérifier les variables d'environnement
        const hasSecretKey = content.includes('STRIPE_SECRET_KEY');
        const hasWebhookSecret = content.includes('STRIPE_WEBHOOK_SECRET');
        console.log(`      ${hasSecretKey ? '✅' : '❌'} STRIPE_SECRET_KEY référencé`);
        console.log(`      ${hasWebhookSecret ? '✅' : '❌'} STRIPE_WEBHOOK_SECRET référencé`);
        
        report.edgeFunctions[funcName] = {
          exists: true,
          has_secret_key: hasSecretKey,
          has_webhook_secret: hasWebhookSecret
        };
      } else {
        console.log('      ❌ Fichier local manquant');
        report.edgeFunctions[funcName] = { exists: false };
      }
      
      // Note: On ne peut pas vérifier le déploiement via l'API client facilement
      console.log(`      ⚠️  VÉRIFICATION MANUELLE :`);
      console.log(`         → Supabase Dashboard → Edge Functions → ${funcName}`);
      console.log(`         → URL: ${supabaseUrl.replace('https://', 'https://')}/functions/v1/${funcName}`);
    }
    
    // 3. PAIEMENTS
    console.log('\n\n3️⃣  PAIEMENTS DANS LA BASE DE DONNÉES\n');
    
    try {
      const { data: paiements, error: pErr } = await supabase
        .from('paiements')
        .select('id, statut, stripe_payment_id, entreprise_id, montant_ttc, methode_paiement, created_at')
        .eq('methode_paiement', 'stripe')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (pErr) {
        console.log(`   ❌ Erreur lors de la récupération: ${pErr.message}`);
        report.paiements.error = pErr.message;
      } else if (!paiements || paiements.length === 0) {
        console.log('   ⚠️  Aucun paiement Stripe trouvé dans la base de données');
        report.paiements.count = 0;
      } else {
        console.log(`   📊 ${paiements.length} paiement(s) Stripe trouvé(s):\n`);
        
        const stats = {
          total: paiements.length,
          en_attente: 0,
          paye: 0,
          avec_stripe_id: 0,
          sans_stripe_id: 0
        };
        
        paiements.forEach((p, idx) => {
          if (idx < 5) { // Afficher les 5 premiers en détail
            console.log(`   ${idx + 1}. ID: ${p.id.substring(0, 8)}...`);
            console.log(`      Statut: ${p.statut}`);
            console.log(`      Stripe Payment ID: ${p.stripe_payment_id || '❌ MANQUANT'}`);
            console.log(`      Entreprise ID: ${p.entreprise_id || '❌ MANQUANT'}`);
            console.log(`      Montant: ${p.montant_ttc}€`);
            console.log(`      Créé le: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
            console.log('');
          }
          
          if (p.statut === 'en_attente') stats.en_attente++;
          if (p.statut === 'paye') stats.paye++;
          if (p.stripe_payment_id) stats.avec_stripe_id++;
          else stats.sans_stripe_id++;
        });
        
        console.log('\n   📊 STATISTIQUES:');
        console.log(`      Total: ${stats.total}`);
        console.log(`      En attente: ${stats.en_attente}`);
        console.log(`      Payé: ${stats.paye}`);
        console.log(`      Avec Stripe Payment ID: ${stats.avec_stripe_id}`);
        console.log(`      Sans Stripe Payment ID: ${stats.sans_stripe_id} ⚠️`);
        
        report.paiements = {
          count: stats.total,
          stats: stats,
          recent: paiements.slice(0, 5).map(p => ({
            id: p.id,
            statut: p.statut,
            stripe_payment_id: p.stripe_payment_id,
            entreprise_id: p.entreprise_id,
            montant_ttc: p.montant_ttc,
            created_at: p.created_at
          }))
        };
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
      report.paiements.error = err.message;
    }
    
    // 4. ABONNEMENTS
    console.log('\n\n4️⃣  ABONNEMENTS CRÉÉS\n');
    
    try {
      const { data: abonnements, error: aErr } = await supabase
        .from('abonnements')
        .select('id, entreprise_id, plan_id, statut, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (aErr) {
        console.log(`   ❌ Erreur: ${aErr.message}`);
      } else if (!abonnements || abonnements.length === 0) {
        console.log('   ⚠️  Aucun abonnement trouvé');
        report.abonnements = { count: 0 };
      } else {
        console.log(`   📊 ${abonnements.length} abonnement(s) trouvé(s):\n`);
        abonnements.slice(0, 5).forEach((a, idx) => {
          console.log(`   ${idx + 1}. ID: ${a.id.substring(0, 8)}...`);
          console.log(`      Entreprise: ${a.entreprise_id?.substring(0, 8) || 'N/A'}...`);
          console.log(`      Plan: ${a.plan_id?.substring(0, 8) || 'N/A'}...`);
          console.log(`      Statut: ${a.statut}`);
          console.log('');
        });
        
        report.abonnements = {
          count: abonnements.length,
          recent: abonnements.slice(0, 5)
        };
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
    }
    
    // 5. FACTURES
    console.log('\n\n5️⃣  FACTURES LIÉES AUX PAIEMENTS STRIPE\n');
    
    try {
      const { data: factures, error: fErr } = await supabase
        .from('factures')
        .select('id, numero, entreprise_id, paiement_id, statut, montant_ttc, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (fErr) {
        console.log(`   ❌ Erreur: ${fErr.message}`);
      } else if (!factures || factures.length === 0) {
        console.log('   ⚠️  Aucune facture trouvée');
      } else {
        const facturesAvecPaiement = factures.filter(f => f.paiement_id);
        console.log(`   📊 ${factures.length} facture(s) trouvée(s), ${facturesAvecPaiement.length} avec paiement_id\n`);
        
        facturesAvecPaiement.slice(0, 5).forEach((f, idx) => {
          console.log(`   ${idx + 1}. Facture: ${f.numero || f.id.substring(0, 8)}...`);
          console.log(`      Paiement ID: ${f.paiement_id?.substring(0, 8) || 'N/A'}...`);
          console.log(`      Statut: ${f.statut}`);
          console.log(`      Montant: ${f.montant_ttc}€`);
          console.log('');
        });
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
    }
    
    // 6. RÉSUMÉ ET RECOMMANDATIONS
    console.log('\n\n6️⃣  RÉSUMÉ ET RECOMMANDATIONS\n');
    console.log('═'.repeat(80));
    
    const recommendations = [];
    
    if (report.paiements.stats && report.paiements.stats.sans_stripe_id > 0) {
      recommendations.push({
        level: 'HIGH',
        issue: `${report.paiements.stats.sans_stripe_id} paiement(s) sans stripe_payment_id`,
        fix: 'Les webhooks Stripe ne sont peut-être pas reçus ou configurés correctement'
      });
    }
    
    if (report.paiements.stats && report.paiements.stats.en_attente > 0) {
      recommendations.push({
        level: 'MEDIUM',
        issue: `${report.paiements.stats.en_attente} paiement(s) en attente`,
        fix: 'Vérifier que les webhooks Stripe sont bien configurés et reçus'
      });
    }
    
    if (report.abonnements && report.abonnements.count === 0) {
      recommendations.push({
        level: 'HIGH',
        issue: 'Aucun abonnement créé',
        fix: 'Le workflow de création d\'abonnement après paiement ne fonctionne pas'
      });
    }
    
    if (recommendations.length > 0) {
      console.log('\n   🚨 PROBLÈMES IDENTIFIÉS:\n');
      recommendations.forEach((rec, idx) => {
        const icon = rec.level === 'HIGH' ? '🔴' : '🟡';
        console.log(`   ${icon} ${idx + 1}. ${rec.issue}`);
        console.log(`      💡 Solution: ${rec.fix}\n`);
      });
    } else {
      console.log('\n   ✅ Aucun problème majeur identifié dans la base de données');
    }
    
    report.recommendations = recommendations;
    
    // 7. SAVE REPORT
    const reportPath = join(__dirname, '..', 'RAPPORT_DIAGNOSTIC_SUPABASE_STRIPE.json');
    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n   📄 Rapport sauvegardé: ${reportPath}`);
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    throw error;
  }
}

diagnosticComplet()
  .then(() => {
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Diagnostic terminé\n');
    console.log('📋 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier les logs dans Supabase Dashboard → Edge Functions → Logs');
    console.log('   2. Vérifier les webhooks dans Stripe Dashboard → Webhooks → Logs');
    console.log('   3. Partager les informations Stripe pour diagnostic complet\n');
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });

