#!/usr/bin/env node

/**
 * Script d'auto-configuration Stripe
 * 
 * Ce script configure automatiquement :
 * 1. Les secrets Stripe dans Supabase Edge Functions
 * 2. Le webhook Stripe (si possible via API)
 * 
 * Prérequis :
 * - Variables d'environnement dans .env :
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - STRIPE_SECRET_KEY (déjà fourni)
 *   - STRIPE_WEBHOOK_SECRET (déjà fourni)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
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
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('');
  console.error('Veuillez configurer dans votre fichier .env :');
  console.error('  - VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Vous pouvez trouver ces valeurs dans :');
  console.error('  - Supabase Dashboard → Settings → API');
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
console.log('🚀 CONFIGURATION AUTOMATIQUE DE STRIPE');
console.log('');
console.log('📋 Informations détectées :');
console.log('   - Projet Supabase ID:', projectId);
console.log('   - URL Supabase:', SUPABASE_URL);
console.log('   - Clé Stripe Secrète:', STRIPE_SECRET_KEY.substring(0, 20) + '...');
console.log('   - Webhook Secret:', STRIPE_WEBHOOK_SECRET.substring(0, 20) + '...');
console.log('');

// Fonction pour configurer les secrets via l'API Supabase Management
async function configureSupabaseSecrets() {
  console.log('🔧 Étape 1 : Configuration des secrets dans Supabase...');
  console.log('');

  try {
    // Note: L'API Supabase Management pour les secrets nécessite un token spécial
    // Pour l'instant, on va utiliser une approche alternative via l'API REST
    
    console.log('⚠️  Configuration des secrets Edge Functions via l\'API Supabase...');
    console.log('');
    console.log('📝 Note: L\'API Supabase Management pour les secrets Edge Functions');
    console.log('   nécessite un accès spécial. Voici les instructions manuelles :');
    console.log('');
    console.log('1. Allez sur: https://supabase.com/dashboard/project/' + projectId + '/settings/functions');
    console.log('2. Dans la section "Secrets", ajoutez:');
    console.log('');
    console.log('   Nom: STRIPE_SECRET_KEY');
    console.log('   Valeur: ' + STRIPE_SECRET_KEY);
    console.log('');
    console.log('   Nom: STRIPE_WEBHOOK_SECRET');
    console.log('   Valeur: ' + STRIPE_WEBHOOK_SECRET);
    console.log('');
    
    // Essayer d'utiliser l'API Supabase Management si disponible
    const managementApiKey = process.env.SUPABASE_MANAGEMENT_API_KEY;
    
    if (managementApiKey) {
      console.log('🔄 Tentative de configuration automatique via Management API...');
      
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${managementApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secrets: [
            {
              name: 'STRIPE_SECRET_KEY',
              value: STRIPE_SECRET_KEY,
            },
            {
              name: 'STRIPE_WEBHOOK_SECRET',
              value: STRIPE_WEBHOOK_SECRET,
            },
          ],
        }),
      });

      if (response.ok) {
        console.log('✅ Secrets configurés automatiquement !');
        return true;
      } else {
        const error = await response.text();
        console.log('⚠️  Configuration automatique échouée:', error);
        console.log('   Utilisez les instructions manuelles ci-dessus.');
      }
    } else {
      console.log('ℹ️  SUPABASE_MANAGEMENT_API_KEY non trouvée.');
      console.log('   Pour activer la configuration automatique, ajoutez cette clé dans .env');
      console.log('   (Vous pouvez la créer dans Supabase Dashboard → Settings → Access Tokens)');
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    return false;
  }
}

// Fonction pour générer les instructions du webhook Stripe
function generateStripeWebhookInstructions() {
  console.log('');
  console.log('🌐 Étape 2 : Configuration du webhook Stripe...');
  console.log('');
  console.log('📝 Instructions pour configurer le webhook dans Stripe Dashboard :');
  console.log('');
  console.log('1. Allez sur: https://dashboard.stripe.com/test/webhooks');
  console.log('2. Cliquez sur "Add endpoint"');
  console.log('3. Endpoint URL:');
  console.log('   https://' + projectId + '.supabase.co/functions/v1/stripe-webhooks');
  console.log('');
  console.log('4. Description: Supabase Edge Function - Webhooks');
  console.log('');
  console.log('5. Sélectionnez ces événements:');
  console.log('   ✅ checkout.session.completed');
  console.log('   ✅ payment_intent.succeeded');
  console.log('   ✅ customer.subscription.created (optionnel)');
  console.log('   ✅ customer.subscription.updated (optionnel)');
  console.log('   ✅ customer.subscription.deleted (optionnel)');
  console.log('   ✅ invoice.paid (optionnel)');
  console.log('   ✅ invoice.payment_failed (optionnel)');
  console.log('');
  console.log('6. Vérifiez que le "Signing secret" est:');
  console.log('   ' + STRIPE_WEBHOOK_SECRET);
  console.log('');
}

// Fonction principale
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CONFIGURATION AUTOMATIQUE STRIPE');
  console.log('═══════════════════════════════════════════════════════════');
  
  const secretsConfigured = await configureSupabaseSecrets();
  generateStripeWebhookInstructions();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  if (secretsConfigured) {
    console.log('✅ Secrets Supabase : Configurés automatiquement');
  } else {
    console.log('⚠️  Secrets Supabase : Configuration manuelle requise');
    console.log('   → Suivez les instructions ci-dessus');
  }
  
  console.log('⚠️  Webhook Stripe : Configuration manuelle requise');
  console.log('   → Suivez les instructions ci-dessus');
  console.log('');
  console.log('🧪 Après configuration, testez avec un paiement de test');
  console.log('   Carte de test: 4242 4242 4242 4242');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// Exécuter le script
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});


