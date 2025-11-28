#!/usr/bin/env node
/**
 * Script pour vérifier et configurer le webhook Stripe
 * Vérifie les secrets, génère les instructions de configuration
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
const STRIPE_WEBHOOK_SECRET = 'whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef';

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL non trouvé !');
  process.exit(1);
}

const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = match ? match[1] : null;
const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/stripe-webhooks`;

console.log('\n🔧 CONFIGURATION WEBHOOK STRIPE - VÉRIFICATION COMPLÈTE\n');
console.log('═'.repeat(80));

console.log('\n📋 INFORMATIONS SUPABASE :\n');
console.log(`   URL Supabase: ${supabaseUrl}`);
console.log(`   Project Ref: ${projectRef}`);
console.log(`\n🔗 URL du webhook :\n`);
console.log(`   ${webhookUrl}\n`);

console.log('═'.repeat(80));
console.log('\n🔑 CONFIGURATION DES SECRETS\n');

console.log('\n1️⃣  SUPABASE DASHBOARD → Settings → Edge Functions → Secrets\n');
console.log('   Ajouter/Mettre à jour le secret suivant :\n');
console.log(`   📌 Nom : STRIPE_WEBHOOK_SECRET`);
console.log(`   📌 Valeur : ${STRIPE_WEBHOOK_SECRET}\n`);

console.log('   ⚠️  IMPORTANT : Ce secret doit correspondre au "Signing secret" dans Stripe Dashboard\n');

console.log('═'.repeat(80));
console.log('\n🔗 CONFIGURATION STRIPE DASHBOARD\n');

console.log('\n1. Ouvrir Stripe Dashboard → Developers → Webhooks\n');
console.log('2. Cliquer sur "+ Ajouter un endpoint" (ou modifier l\'endpoint existant)\n');
console.log(`3. URL du point de terminaison : ${webhookUrl}\n`);
console.log('4. Sélectionner les événements :\n');
console.log('   ✅ checkout.session.completed\n');
console.log('5. Cliquer sur "Ajouter un endpoint"\n');
console.log(`6. Copier le "Signing secret" (doit être : ${STRIPE_WEBHOOK_SECRET})\n`);
console.log('7. S\'assurer que ce secret correspond à celui dans Supabase\n');

console.log('═'.repeat(80));
console.log('\n🔓 DÉSACTIVER L\'AUTHENTIFICATION (IMPORTANT !)\n');

console.log('⚠️  PROBLÈME IDENTIFIÉ : Erreur 401 "Missing authorization header"\n');
console.log('   → Supabase bloque les webhooks car ils n\'ont pas d\'en-tête d\'autorisation\n');
console.log('   → Solution : Désactiver l\'authentification pour cette fonction\n\n');

console.log('📝 ÉTAPES :\n');
console.log('   1. Ouvrir Supabase Dashboard → Edge Functions → stripe-webhooks\n');
console.log('   2. Chercher "Verify JWT" ou "Authentication" ou "Autorisations"\n');
console.log('   3. DÉSACTIVER cette option\n');
console.log('   4. OU aller dans Settings → Edge Functions → Autorisations\n');
console.log('   5. Rendre la fonction stripe-webhooks "Publique"\n');

console.log('═'.repeat(80));
console.log('\n🧪 TEST DU WEBHOOK\n');

console.log('1. Déployer l\'Edge Function mise à jour :\n');
console.log('   supabase functions deploy stripe-webhooks\n');
console.log('   OU via Dashboard → Edge Functions → stripe-webhooks → Deploy\n\n');

console.log('2. Effectuer un paiement de test :\n');
console.log('   - Créer une entreprise\n');
console.log('   - Choisir paiement Stripe\n');
console.log('   - Payer avec carte test : 4242 4242 4242 4242\n\n');

console.log('3. Vérifier dans Stripe Dashboard → Webhooks → Logs :\n');
console.log('   ✅ Statut doit être 200 OK (au lieu de 401)\n');
console.log('   ✅ L\'événement checkout.session.completed doit être envoyé\n\n');

console.log('4. Vérifier dans Supabase Dashboard → Edge Functions → Logs :\n');
console.log('   ✅ Les logs doivent montrer "🔔 [WEBHOOK] Checkout completed"\n');
console.log('   ✅ Le workflow doit se compléter (abonnement créé, etc.)\n');

console.log('═'.repeat(80));
console.log('\n📊 RÉSUMÉ DE LA CONFIGURATION\n');

console.log('✅ Code corrigé (ne vérifie plus l\'auth Supabase)');
console.log('✅ Signature Stripe utilisée comme authentification');
console.log('⚠️  À FAIRE : Désactiver l\'auth dans Supabase Dashboard');
console.log('⚠️  À FAIRE : Vérifier que STRIPE_WEBHOOK_SECRET est configuré');
console.log('⚠️  À FAIRE : Déployer l\'Edge Function mise à jour');

console.log('\n' + '═'.repeat(80) + '\n');

