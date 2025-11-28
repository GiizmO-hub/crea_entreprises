#!/usr/bin/env node

/**
 * Script de test de la configuration Stripe
 * Vérifie que tout est bien configuré et fonctionne
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import Stripe from 'stripe';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🧪 TEST DE LA CONFIGURATION STRIPE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

let errors = [];
let warnings = [];

// Test 1: Vérifier Supabase
console.log('1️⃣  Test connexion Supabase...');
try {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables Supabase manquantes');
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test de connexion
  const { data, error } = await supabase.from('entreprises').select('id').limit(1);
  
  if (error && !error.message.includes('permission denied')) {
    throw error;
  }
  
  console.log('   ✅ Connexion Supabase OK');
  console.log('   📍 URL:', SUPABASE_URL);
} catch (error) {
  errors.push('Supabase: ' + error.message);
  console.log('   ❌ Erreur:', error.message);
}

// Test 2: Vérifier Stripe
console.log('');
console.log('2️⃣  Test connexion Stripe...');
try {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY non configurée');
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  
  // Tester l'API Stripe
  const account = await stripe.account.retrieve();
  
  console.log('   ✅ Connexion Stripe OK');
  console.log('   🏢 Compte:', account.business_profile?.name || account.email || 'Test account');
  console.log('   💳 Mode:', account.livemode ? 'Production' : 'Test');
} catch (error) {
  errors.push('Stripe: ' + error.message);
  console.log('   ❌ Erreur:', error.message);
}

// Test 3: Vérifier les Edge Functions
console.log('');
console.log('3️⃣  Test Edge Functions Supabase...');
try {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Tester si la fonction create-stripe-checkout existe
  // On ne peut pas vraiment tester sans créer un paiement, mais on peut vérifier la structure
  console.log('   ⚠️  Impossible de tester directement les Edge Functions');
  console.log('   💡 Testez en créant un paiement dans l\'application');
  
} catch (error) {
  warnings.push('Edge Functions: ' + error.message);
  console.log('   ⚠️  ', error.message);
}

// Test 4: Vérifier les secrets dans Supabase (si possible)
console.log('');
console.log('4️⃣  Vérification des secrets...');
console.log('   ℹ️  Les secrets Edge Functions ne sont pas accessibles via API');
console.log('   ✅ Vérifiez manuellement dans Supabase Dashboard :');
console.log('      Settings → Edge Functions → Secrets');
console.log('      - STRIPE_SECRET_KEY doit être présent');
console.log('      - STRIPE_WEBHOOK_SECRET doit être présent');

// Test 5: Générer un résumé
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  📊 RÉSUMÉ DES TESTS');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

if (errors.length === 0) {
  console.log('✅ Configuration de base OK !');
  console.log('');
  console.log('📝 Prochaines étapes :');
  console.log('');
  console.log('1. Vérifiez les secrets dans Supabase Dashboard');
  console.log('   Settings → Edge Functions → Secrets');
  console.log('');
  console.log('2. Vérifiez le webhook dans Stripe Dashboard');
  console.log('   Developers → Webhooks');
  console.log('   URL: https://[PROJET-ID].supabase.co/functions/v1/stripe-webhooks');
  console.log('');
  console.log('3. Testez avec un paiement réel :');
  console.log('   - Créez une entreprise dans l\'application');
  console.log('   - Choisissez "Paiement par carte bancaire"');
  console.log('   - Utilisez la carte de test: 4242 4242 4242 4242');
  console.log('');
} else {
  console.log('❌ Erreurs détectées :');
  errors.forEach(err => console.log('   -', err));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  Avertissements :');
  warnings.forEach(warn => console.log('   -', warn));
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('');


