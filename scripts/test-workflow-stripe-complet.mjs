#!/usr/bin/env node
/**
 * Script de test complet du workflow Stripe
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const env = {};
  const envPaths = [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  
  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    } catch (err) {}
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWorkflow() {
  console.log('\n🧪 TEST DU WORKFLOW STRIPE COMPLET\n');
  console.log('═'.repeat(60));
  
  // 1. Vérifier les paiements Stripe récents
  console.log('\n1️⃣  Paiements Stripe récents:\n');
  const { data: paiements, error: pErr } = await supabase
    .from('paiements')
    .select('id, statut, stripe_payment_id, entreprise_id, montant_ttc, created_at')
    .eq('methode_paiement', 'stripe')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (pErr) {
    console.error('❌ Erreur:', pErr.message);
  } else if (!paiements || paiements.length === 0) {
    console.log('   ⚠️  Aucun paiement Stripe trouvé');
  } else {
    paiements.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p.id.substring(0, 8)}...`);
      console.log(`      Statut: ${p.statut}`);
      console.log(`      Stripe Payment ID: ${p.stripe_payment_id || 'N/A'}`);
      console.log(`      Entreprise ID: ${p.entreprise_id || 'N/A'}`);
      console.log(`      Montant: ${p.montant_ttc}€`);
      console.log('');
    });
  }
  
  // 2. Vérifier les abonnements
  console.log('\n2️⃣  Abonnements créés:\n');
  const { data: abonnements, error: aErr } = await supabase
    .from('abonnements')
    .select('id, entreprise_id, plan_id, statut, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (aErr) {
    console.error('❌ Erreur:', aErr.message);
  } else if (!abonnements || abonnements.length === 0) {
    console.log('   ⚠️  Aucun abonnement trouvé');
  } else {
    abonnements.forEach((a, i) => {
      console.log(`   ${i + 1}. ID: ${a.id.substring(0, 8)}...`);
      console.log(`      Entreprise: ${a.entreprise_id?.substring(0, 8) || 'N/A'}...`);
      console.log(`      Plan: ${a.plan_id?.substring(0, 8) || 'N/A'}...`);
      console.log(`      Statut: ${a.statut}`);
      console.log('');
    });
  }
  
  console.log('═'.repeat(60));
  console.log('\n✅ Test terminé\n');
}

testWorkflow().catch(console.error);
