#!/usr/bin/env node
/**
 * Diagnostic complet des scripts Stripe
 * Vérifie les Edge Functions, configurations, et problèmes potentiels
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔍 DIAGNOSTIC COMPLET DES SCRIPTS STRIPE\n');
console.log('═'.repeat(80));

// 1. Vérifier les fichiers Edge Functions
console.log('\n1️⃣  FICHIERS EDGE FUNCTIONS\n');

const edgeFunctionsPath = join(__dirname, '..', 'supabase', 'functions');

const functionsToCheck = [
  'create-stripe-checkout',
  'stripe-webhooks'
];

for (const funcName of functionsToCheck) {
  const funcPath = join(edgeFunctionsPath, funcName, 'index.ts');
  console.log(`\n📁 ${funcName}/index.ts`);
  
  if (!existsSync(funcPath)) {
    console.log('   ❌ FICHIER MANQUANT');
    continue;
  }
  
  console.log('   ✅ Fichier existe');
  
  const content = readFileSync(funcPath, 'utf8');
  
  // Vérifier les imports
  if (content.includes("import Stripe from")) {
    const match = content.match(/stripe@([\d.]+)/);
    if (match) {
      console.log(`   ✅ Stripe importé (version ${match[1]})`);
    }
  } else {
    console.log('   ⚠️  Import Stripe non trouvé');
  }
  
  // Vérifier les variables d'environnement
  if (content.includes('STRIPE_SECRET_KEY')) {
    console.log('   ✅ STRIPE_SECRET_KEY référencé');
  } else {
    console.log('   ⚠️  STRIPE_SECRET_KEY non référencé');
  }
  
  if (content.includes('STRIPE_WEBHOOK_SECRET')) {
    console.log('   ✅ STRIPE_WEBHOOK_SECRET référencé');
  } else {
    console.log('   ⚠️  STRIPE_WEBHOOK_SECRET non référencé');
  }
  
  // Vérifier les problèmes potentiels
  const problems = [];
  
  // Problème 1 : stripe peut être null
  if (content.includes('stripe!.')) {
    problems.push('⚠️  Utilise stripe!. (null assertion) - peut crasher si stripe est null');
  }
  
  if (content.includes('const stripe =') && content.includes('? null') && !content.includes('if (!stripe)')) {
    problems.push('⚠️  stripe peut être null mais pas de vérification avant utilisation');
  }
  
  // Problème 2 : Type SupabaseClient manquant
  if (content.includes('SupabaseClient') && !content.includes('import') && !content.includes('SupabaseClient')) {
    problems.push('⚠️  Type SupabaseClient utilisé mais pas importé');
  }
  
  // Problème 3 : Vérification du paiement
  if (funcName === 'stripe-webhooks' && !content.includes('payment_status !== \'paid\'')) {
    problems.push('⚠️  Pas de vérification payment_status avant validation');
  }
  
  if (problems.length > 0) {
    console.log('\n   🚨 PROBLÈMES IDENTIFIÉS:');
    problems.forEach(p => console.log(`      ${p}`));
  }
  
  // Compter les lignes
  const lines = content.split('\n').length;
  console.log(`   📊 ${lines} lignes de code`);
}

// 2. Vérifier les incohérences
console.log('\n\n2️⃣  INCOHÉRENCES DÉTECTÉES\n');

const checkoutPath = join(edgeFunctionsPath, 'create-stripe-checkout', 'index.ts');
const webhookPath = join(edgeFunctionsPath, 'stripe-webhooks', 'index.ts');

if (existsSync(checkoutPath) && existsSync(webhookPath)) {
  const checkoutContent = readFileSync(checkoutPath, 'utf8');
  const webhookContent = readFileSync(webhookPath, 'utf8');
  
  const checkoutVersion = checkoutContent.match(/stripe@([\d.]+)/)?.[1];
  const webhookVersion = webhookContent.match(/stripe@([\d.]+)/)?.[1];
  
  if (checkoutVersion && webhookVersion && checkoutVersion !== webhookVersion) {
    console.log(`   ⚠️  Versions Stripe différentes:`);
    console.log(`      create-stripe-checkout: ${checkoutVersion}`);
    console.log(`      stripe-webhooks: ${webhookVersion}`);
    console.log(`   💡 Recommandation: Utiliser la même version partout`);
  }
  
  // Vérifier les URLs de redirection
  if (checkoutContent.includes('success_url') && checkoutContent.includes('/success?')) {
    console.log('   ✅ success_url configuré dans create-stripe-checkout');
  }
  
  if (checkoutContent.includes('client_reference_id')) {
    console.log('   ✅ client_reference_id utilisé pour stocker paiement_id');
  }
}

// 3. Vérifier les fonctions RPC appelées
console.log('\n\n3️⃣  FONCTIONS RPC RÉFÉRENCÉES\n');

if (existsSync(checkoutPath)) {
  const content = readFileSync(checkoutPath, 'utf8');
  const rpcMatches = content.matchAll(/rpc\(['"]([^'"]+)['"]/g);
  const rpcFunctions = [...rpcMatches].map(m => m[1]);
  
  if (rpcFunctions.length > 0) {
    console.log('   Dans create-stripe-checkout:');
    rpcFunctions.forEach(f => console.log(`      - ${f}`));
  }
}

if (existsSync(webhookPath)) {
  const content = readFileSync(webhookPath, 'utf8');
  const rpcMatches = content.matchAll(/rpc\(['"]([^'"]+)['"]/g);
  const rpcFunctions = [...rpcMatches].map(m => m[1]);
  
  if (rpcFunctions.length > 0) {
    console.log('   Dans stripe-webhooks:');
    rpcFunctions.forEach(f => console.log(`      - ${f}`));
  }
}

// 4. Recommandations
console.log('\n\n4️⃣  RECOMMANDATIONS\n');

console.log(`
   ✅ À VÉRIFIER :
   1. Les secrets Stripe sont configurés dans Supabase Dashboard
      - STRIPE_SECRET_KEY
      - STRIPE_WEBHOOK_SECRET
   
   2. L'Edge Function stripe-webhooks est déployée
      - URL: https://[project-ref].supabase.co/functions/v1/stripe-webhooks
   
   3. Le webhook est configuré dans Stripe Dashboard
      - Endpoint: https://[project-ref].supabase.co/functions/v1/stripe-webhooks
      - Événements: checkout.session.completed
      - Signing secret correspond à STRIPE_WEBHOOK_SECRET
   
   4. Les versions de Stripe sont cohérentes (14.21.0 recommandé)
`);

console.log('\n' + '═'.repeat(80));
console.log('\n✅ Diagnostic terminé\n');

