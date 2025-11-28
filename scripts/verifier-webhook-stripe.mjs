#!/usr/bin/env node
/**
 * Script pour vérifier la configuration du webhook Stripe
 * Génère l'URL du webhook et les instructions de configuration
 */

import { readFileSync, existsSync } from 'fs';
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

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL non trouvé !');
  process.exit(1);
}

// Extraire le project ref de l'URL
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = match ? match[1] : null;

if (!projectRef) {
  console.error('❌ Impossible d\'extraire le project ref de l\'URL Supabase');
  process.exit(1);
}

const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/stripe-webhooks`;

console.log('\n🔗 CONFIGURATION DU WEBHOOK STRIPE\n');
console.log('═'.repeat(80));
console.log('\n📋 INFORMATIONS SUPABASE :\n');
console.log(`   URL Supabase: ${supabaseUrl}`);
console.log(`   Project Ref: ${projectRef}`);
console.log(`\n🔗 URL DU WEBHOOK À CONFIGURER DANS STRIPE :\n`);
console.log(`   ${webhookUrl}\n`);
console.log('═'.repeat(80));
console.log('\n📝 INSTRUCTIONS DE CONFIGURATION :\n');
console.log('1. Ouvrir Stripe Dashboard → Developers → Webhooks');
console.log('2. Cliquer sur "+ Ajouter un endpoint" (ou "Add endpoint")');
console.log(`3. Coller cette URL : ${webhookUrl}`);
console.log('4. Sélectionner les événements suivants :');
console.log('   ✅ checkout.session.completed');
console.log('5. Cliquer sur "Ajouter un endpoint"');
console.log('6. Copier le "Signing secret" (commence par whsec_)');
console.log('7. Aller dans Supabase Dashboard → Settings → Edge Functions → Secrets');
console.log('8. Ajouter/Mettre à jour le secret :');
console.log('   - Nom: STRIPE_WEBHOOK_SECRET');
console.log('   - Valeur: [le Signing secret copié]');
console.log('\n═'.repeat(80));
console.log('\n🧪 TEST DU WEBHOOK :\n');
console.log('1. Effectuer un paiement de test');
console.log('2. Vérifier dans Stripe Dashboard → Webhooks → [Votre endpoint] → Logs');
console.log('   - L\'événement checkout.session.completed doit être envoyé');
console.log('   - Le statut doit être 200 OK');
console.log('3. Vérifier dans Supabase Dashboard → Edge Functions → Logs');
console.log('   - Les logs doivent montrer "🔔 [WEBHOOK] Checkout completed"');
console.log('\n' + '═'.repeat(80) + '\n');

