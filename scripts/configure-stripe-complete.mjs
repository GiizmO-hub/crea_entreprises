#!/usr/bin/env node

/**
 * Script de configuration automatique complète de Stripe
 * 
 * Configure automatiquement :
 * 1. Les secrets Stripe dans Supabase (via API si possible)
 * 2. Génère les instructions pour le webhook Stripe
 * 
 * Clés Stripe fournies :
 * - STRIPE_SECRET_KEY: sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk
 * - STRIPE_WEBHOOK_SECRET: whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Charger les variables d'environnement
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Clés Stripe fournies
const STRIPE_SECRET_KEY = 'sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk';
const STRIPE_WEBHOOK_SECRET = 'whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef';

// Récupérer les variables d'environnement
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Essayer de lire depuis .env si pas trouvé
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = join(projectRoot, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      if (line.startsWith('VITE_SUPABASE_URL=') && !SUPABASE_URL) {
        SUPABASE_URL = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith('SUPABASE_URL=') && !SUPABASE_URL) {
        SUPABASE_URL = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=') && !SUPABASE_SERVICE_ROLE_KEY) {
        SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('');
  console.log('❌ Variables d\'environnement manquantes !');
  console.log('');
  console.log('📝 Veuillez configurer dans votre fichier .env :');
  console.log('   VITE_SUPABASE_URL=https://[PROJET-ID].supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  console.log('');
  console.log('💡 Vous pouvez trouver ces valeurs dans :');
  console.log('   Supabase Dashboard → Settings → API');
  console.log('');
  console.log('🔗 Ou fournissez-les maintenant :');
  console.log('');
  process.exit(1);
}

// Extraire l'ID du projet depuis l'URL
const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectId) {
  console.error('❌ Impossible d\'extraire l\'ID du projet depuis SUPABASE_URL');
  console.error('URL fournie:', SUPABASE_URL);
  process.exit(1);
}

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 CONFIGURATION AUTOMATIQUE STRIPE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Informations détectées :');
console.log('   ✅ Projet Supabase ID:', projectId);
console.log('   ✅ URL Supabase:', SUPABASE_URL);
console.log('   ✅ Clé Stripe Secrète:', STRIPE_SECRET_KEY.substring(0, 20) + '...');
console.log('   ✅ Webhook Secret:', STRIPE_WEBHOOK_SECRET.substring(0, 20) + '...');
console.log('');

// Fonction pour configurer les secrets via Supabase Client (si possible)
async function configureSecretsViaSupabase() {
  console.log('🔧 Tentative de configuration automatique des secrets...');
  console.log('');
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Note: L'API Supabase pour configurer les secrets Edge Functions
    // nécessite l'API Management qui n'est pas directement accessible via le client JS
    // On va donc fournir les instructions manuelles
    
    console.log('⚠️  Configuration automatique des secrets Edge Functions');
    console.log('   nécessite l\'accès à l\'API Supabase Management.');
    console.log('');
    console.log('📝 INSTRUCTIONS MANUELLES (2 minutes) :');
    console.log('');
    console.log('1️⃣  Ouvrez votre navigateur et allez sur :');
    console.log('   https://supabase.com/dashboard/project/' + projectId + '/settings/functions');
    console.log('');
    console.log('2️⃣  Dans la section "Secrets", cliquez sur "Add new secret"');
    console.log('');
    console.log('3️⃣  Ajoutez le premier secret :');
    console.log('   Nom: STRIPE_SECRET_KEY');
    console.log('   Valeur: ' + STRIPE_SECRET_KEY);
    console.log('   → Cliquez sur "Add secret"');
    console.log('');
    console.log('4️⃣  Ajoutez le deuxième secret :');
    console.log('   Nom: STRIPE_WEBHOOK_SECRET');
    console.log('   Valeur: ' + STRIPE_WEBHOOK_SECRET);
    console.log('   → Cliquez sur "Add secret"');
    console.log('');
    console.log('✅ Une fois les 2 secrets ajoutés, revenez ici et appuyez sur Entrée...');
    console.log('');
    
    // Attendre la confirmation de l'utilisateur
    await new Promise((resolve) => {
      process.stdin.once('data', () => resolve());
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

// Fonction pour générer les instructions du webhook Stripe
function generateStripeWebhookInstructions() {
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/stripe-webhooks`;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌐 CONFIGURATION DU WEBHOOK STRIPE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📝 INSTRUCTIONS (3 minutes) :');
  console.log('');
  console.log('1️⃣  Ouvrez votre navigateur et allez sur :');
  console.log('   https://dashboard.stripe.com/test/webhooks');
  console.log('');
  console.log('2️⃣  Cliquez sur "Add endpoint" (ou "Add webhook endpoint")');
  console.log('');
  console.log('3️⃣  Configurez l\'endpoint :');
  console.log('   Endpoint URL:');
  console.log('   ' + webhookUrl);
  console.log('');
  console.log('   Description:');
  console.log('   Supabase Edge Function - Webhooks');
  console.log('');
  console.log('4️⃣  Sélectionnez les événements (cliquez sur "Select events") :');
  console.log('   ✅ checkout.session.completed (REQUIS)');
  console.log('   ✅ payment_intent.succeeded (REQUIS)');
  console.log('   ✅ customer.subscription.created (optionnel)');
  console.log('   ✅ customer.subscription.updated (optionnel)');
  console.log('   ✅ customer.subscription.deleted (optionnel)');
  console.log('   ✅ invoice.paid (optionnel)');
  console.log('   ✅ invoice.payment_failed (optionnel)');
  console.log('');
  console.log('5️⃣  Cliquez sur "Add endpoint"');
  console.log('');
  console.log('6️⃣  Vérifiez que le "Signing secret" affiché est :');
  console.log('   ' + STRIPE_WEBHOOK_SECRET);
  console.log('   (Si différent, utilisez celui affiché dans Stripe Dashboard)');
  console.log('');
  console.log('✅ Une fois le webhook créé, revenez ici et appuyez sur Entrée...');
  console.log('');
  
  // Attendre la confirmation
  return new Promise((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

// Fonction pour tester la configuration
async function testConfiguration() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST DE LA CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📝 Pour tester que tout fonctionne :');
  console.log('');
  console.log('1️⃣  Dans votre application, créez une entreprise');
  console.log('');
  console.log('2️⃣  Choisissez "Paiement par carte bancaire"');
  console.log('');
  console.log('3️⃣  Utilisez la carte de test Stripe :');
  console.log('   Numéro: 4242 4242 4242 4242');
  console.log('   Date: 12/25 (ou toute date future)');
  console.log('   CVC: 123');
  console.log('   Code postal: 12345');
  console.log('');
  console.log('4️⃣  Vérifiez que :');
  console.log('   ✅ Le paiement est validé automatiquement');
  console.log('   ✅ La facture est créée');
  console.log('   ✅ L\'abonnement est créé');
  console.log('   ✅ L\'espace client est créé');
  console.log('   ✅ Les droits admin sont créés');
  console.log('');
}

// Fonction principale
async function main() {
  try {
    // Étape 1 : Configuration des secrets Supabase
    await configureSecretsViaSupabase();
    
    // Étape 2 : Configuration du webhook Stripe
    await generateStripeWebhookInstructions();
    
    // Étape 3 : Instructions de test
    await testConfiguration();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ CONFIGURATION TERMINÉE !');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎉 Stripe est maintenant configuré et prêt à être utilisé !');
    console.log('');
    console.log('📚 Pour plus d\'informations, consultez :');
    console.log('   - GUIDE_ACTIVATION_STRIPE.md');
    console.log('   - CONFIGURATION_STRIPE_RAPIDE.md');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Erreur lors de la configuration:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


