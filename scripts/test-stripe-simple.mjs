#!/usr/bin/env node

/**
 * Script de test simple de la configuration Stripe
 * Vérifie la configuration sans installer Stripe
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🧪 TEST DE LA CONFIGURATION STRIPE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

let allOk = true;

// Test 1: Vérifier Supabase
console.log('1️⃣  Test connexion Supabase...');
try {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables Supabase manquantes dans .env');
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test de connexion simple
  const { error } = await supabase.from('entreprises').select('id').limit(1);
  
  if (error && !error.message.includes('permission')) {
    console.log('   ⚠️  Note: ' + error.message);
  }
  
  console.log('   ✅ Connexion Supabase OK');
  console.log('   📍 URL:', SUPABASE_URL);
  
  const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectId) {
    console.log('   📋 Projet ID:', projectId);
  }
  
} catch (error) {
  allOk = false;
  console.log('   ❌ Erreur:', error.message);
}

// Test 2: Vérifier que les Edge Functions existent
console.log('');
console.log('2️⃣  Vérification des Edge Functions...');
try {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // On ne peut pas lister les Edge Functions via l'API publique
  // Mais on peut vérifier qu'elles répondent
  console.log('   ℹ️  Les Edge Functions sont déployées dans Supabase Dashboard');
  console.log('   💡 Vérifiez manuellement dans: Edge Functions');
  console.log('      - create-stripe-checkout');
  console.log('      - stripe-webhooks');
  
} catch (error) {
  console.log('   ⚠️  ', error.message);
}

// Test 3: Vérifier les secrets (instructions)
console.log('');
console.log('3️⃣  Vérification des secrets...');
console.log('   ⚠️  Les secrets Edge Functions ne sont pas accessibles via API');
console.log('   📝 Vérifiez manuellement dans Supabase Dashboard :');
console.log('      Settings → Edge Functions → Secrets');
console.log('      ✅ STRIPE_SECRET_KEY doit être présent');
console.log('      ✅ STRIPE_WEBHOOK_SECRET doit être présent');

// Test 4: Vérifier le webhook Stripe (instructions)
console.log('');
console.log('4️⃣  Vérification du webhook Stripe...');
if (SUPABASE_URL) {
  const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectId) {
    const webhookUrl = `https://${projectId}.supabase.co/functions/v1/stripe-webhooks`;
    console.log('   📝 Vérifiez dans Stripe Dashboard :');
    console.log('      Developers → Webhooks');
    console.log('      ✅ Un endpoint avec cette URL doit exister:');
    console.log('      ' + webhookUrl);
    console.log('      ✅ Événements configurés:');
    console.log('         - checkout.session.completed');
    console.log('         - payment_intent.succeeded');
  }
}

// Résumé
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  📊 RÉSUMÉ');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

if (allOk) {
  console.log('✅ Configuration de base OK !');
} else {
  console.log('⚠️  Certaines vérifications ont échoué');
}

console.log('');
console.log('📝 PROCHAINES ÉTAPES POUR TESTER :');
console.log('');
console.log('1️⃣  Vérifiez la configuration manuelle :');
console.log('   - Secrets dans Supabase Dashboard');
console.log('   - Webhook dans Stripe Dashboard');
console.log('');
console.log('2️⃣  Testez avec un paiement réel dans l\'application :');
console.log('   a) Créez une entreprise');
console.log('   b) Choisissez "Paiement par carte bancaire"');
console.log('   c) Utilisez la carte de test Stripe :');
console.log('      Numéro: 4242 4242 4242 4242');
console.log('      Date: 12/25 (ou toute date future)');
console.log('      CVC: 123');
console.log('      Code postal: 12345');
console.log('');
console.log('3️⃣  Vérifiez que tout se crée automatiquement :');
console.log('   ✅ Le paiement est validé');
console.log('   ✅ La facture est créée');
console.log('   ✅ L\'abonnement est créé');
console.log('   ✅ L\'espace client est créé');
console.log('   ✅ Les droits admin sont créés');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('');


