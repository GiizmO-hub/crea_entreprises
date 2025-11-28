#!/bin/bash

# Script de configuration Stripe généré automatiquement
# Exécutez ce script pour configurer Stripe rapidement

echo "🚀 Configuration Stripe..."
echo ""

# 1. Instructions pour Supabase Dashboard
echo "═══════════════════════════════════════════════════════════"
echo "  ÉTAPE 1 : CONFIGURER LES SECRETS DANS SUPABASE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/functions"
echo "2. Dans 'Secrets', ajoutez:"
echo ""
echo "   Nom: STRIPE_SECRET_KEY"
echo "   Valeur: sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk"
echo ""
echo "   Nom: STRIPE_WEBHOOK_SECRET"
echo "   Valeur: whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef"
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
echo "3. URL: https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks"
echo "4. Événements: checkout.session.completed, payment_intent.succeeded"
echo "5. Vérifiez le Signing secret: whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef"
echo ""
echo "Appuyez sur Entrée une fois terminé..."
read

echo ""
echo "✅ Configuration terminée !"
echo "🧪 Testez avec un paiement de test (carte: 4242 4242 4242 4242)"
echo ""
