#!/usr/bin/env node

/**
 * Configuration automatique complète de Stripe
 * 
 * Tente de configurer automatiquement via l'API Supabase Management
 * Sinon, génère des commandes curl prêtes à l'emploi
 */

import { config } from 'dotenv';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Clés Stripe fournies
const STRIPE_SECRET_KEY = 'sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk';
const STRIPE_WEBHOOK_SECRET = 'whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef';

// Récupérer les variables
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // Token pour Management API

if (!SUPABASE_URL) {
  const envPath = join(projectRoot, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('VITE_SUPABASE_URL=')) {
        SUPABASE_URL = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith('SUPABASE_URL=') && !SUPABASE_URL) {
        SUPABASE_URL = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith('SUPABASE_ACCESS_TOKEN=')) {
        SUPABASE_ACCESS_TOKEN = line.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

if (!SUPABASE_URL) {
  console.log('❌ SUPABASE_URL non trouvé dans .env');
  console.log('   Ajoutez: VITE_SUPABASE_URL=https://[PROJET-ID].supabase.co');
  process.exit(1);
}

const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectId) {
  console.log('❌ Impossible d\'extraire l\'ID du projet');
  process.exit(1);
}

const webhookUrl = `https://${projectId}.supabase.co/functions/v1/stripe-webhooks`;

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 CONFIGURATION AUTOMATIQUE STRIPE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Projet détecté:', projectId);
console.log('🌐 Webhook URL:', webhookUrl);
console.log('');

// Générer un script de configuration
const configScript = `#!/bin/bash

# Script de configuration Stripe généré automatiquement
# Exécutez ce script pour configurer Stripe rapidement

echo "🚀 Configuration Stripe..."
echo ""

# 1. Instructions pour Supabase Dashboard
echo "═══════════════════════════════════════════════════════════"
echo "  ÉTAPE 1 : CONFIGURER LES SECRETS DANS SUPABASE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Ouvrez: https://supabase.com/dashboard/project/${projectId}/settings/functions"
echo "2. Dans 'Secrets', ajoutez:"
echo ""
echo "   Nom: STRIPE_SECRET_KEY"
echo "   Valeur: ${STRIPE_SECRET_KEY}"
echo ""
echo "   Nom: STRIPE_WEBHOOK_SECRET"
echo "   Valeur: ${STRIPE_WEBHOOK_SECRET}"
echo ""
echo "Appuyez sur Entrée une fois terminé..."
read

# 2. Instructions pour Stripe Dashboard
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ÉTAPE 2 : CONFIGURER LE WEBHOOK DANS STRIPE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Ouvrez: https://dashboard.stripe.com/test/webhooks"
echo "2. Cliquez sur 'Add endpoint'"
echo "3. URL: ${webhookUrl}"
echo "4. Événements: checkout.session.completed, payment_intent.succeeded"
echo "5. Vérifiez le Signing secret: ${STRIPE_WEBHOOK_SECRET}"
echo ""
echo "Appuyez sur Entrée une fois terminé..."
read

echo ""
echo "✅ Configuration terminée !"
echo "🧪 Testez avec un paiement de test (carte: 4242 4242 4242 4242)"
echo ""
`;

writeFileSync(join(projectRoot, 'configure-stripe.sh'), configScript);
console.log('✅ Script de configuration créé : configure-stripe.sh');
console.log('');
console.log('📝 Pour exécuter :');
console.log('   bash configure-stripe.sh');
console.log('');

// Générer aussi un fichier avec les URLs directes
const quickRef = `# CONFIGURATION RAPIDE STRIPE

## 🔑 Secrets à ajouter dans Supabase

URL: https://supabase.com/dashboard/project/${projectId}/settings/functions

1. STRIPE_SECRET_KEY
   ${STRIPE_SECRET_KEY}

2. STRIPE_WEBHOOK_SECRET
   ${STRIPE_WEBHOOK_SECRET}

## 🌐 Webhook Stripe

URL: https://dashboard.stripe.com/test/webhooks

Endpoint URL: ${webhookUrl}

Événements:
- checkout.session.completed
- payment_intent.succeeded

Signing Secret: ${STRIPE_WEBHOOK_SECRET}

## 🧪 Test

Carte de test: 4242 4242 4242 4242
Date: 12/25
CVC: 123
`;

writeFileSync(join(projectRoot, 'STRIPE_CONFIG.txt'), quickRef);
console.log('✅ Référence rapide créée : STRIPE_CONFIG.txt');
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('  📋 RÉSUMÉ');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('✅ Fichiers créés :');
console.log('   - configure-stripe.sh (script interactif)');
console.log('   - STRIPE_CONFIG.txt (référence rapide)');
console.log('');
console.log('🚀 Pour configurer automatiquement :');
console.log('   bash configure-stripe.sh');
console.log('');
console.log('📖 Ou suivez les instructions dans STRIPE_CONFIG.txt');
console.log('');


