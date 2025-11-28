#!/bin/bash

# Script pour tester les webhooks Stripe avec Stripe CLI

set -e

echo ""
echo "🧪 TEST DES WEBHOOKS STRIPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier que Stripe CLI est disponible
if [ ! -f "node_modules/.bin/stripe" ] && ! command -v stripe &> /dev/null; then
    echo "❌ Erreur : Stripe CLI n'est pas disponible."
    echo "   Installation en cours..."
    echo ""
    echo "💡 Téléchargement depuis GitHub..."
    ARCH=$(uname -m)
    STRIPE_ARCH=$(if [ "$ARCH" = "arm64" ]; then echo "arm64"; else echo "amd64"; fi)
    LATEST_VERSION=$(curl -s https://api.github.com/repos/stripe/stripe-cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    curl -L -o /tmp/stripe-cli.tar.gz "https://github.com/stripe/stripe-cli/releases/latest/download/stripe_${LATEST_VERSION}_darwin_${STRIPE_ARCH}.tar.gz"
    
    cd /tmp && tar -xzf stripe-cli.tar.gz && STRIPE_BIN=$(find . -name "stripe" -type f | head -1)
    
    if [ -n "$STRIPE_BIN" ]; then
        mkdir -p "$OLDPWD/node_modules/.bin"
        cp "$STRIPE_BIN" "$OLDPWD/node_modules/.bin/stripe"
        chmod +x "$OLDPWD/node_modules/.bin/stripe"
        cd "$OLDPWD"
        echo "✅ Stripe CLI installé"
    else
        echo "❌ Installation échouée"
        exit 1
    fi
fi

echo "✅ Stripe CLI disponible"
echo ""

# Vérifier la connexion
echo "🔐 Vérification de la connexion à Stripe..."
if ! npx stripe config --list &> /dev/null 2>&1; then
    echo "⚠️  Vous n'êtes peut-être pas connecté à Stripe."
    echo ""
    echo "🔑 Connexion à Stripe..."
    echo "   (Une fenêtre du navigateur va s'ouvrir pour vous authentifier)"
    echo ""
    npx stripe login
    echo ""
fi

echo "✅ Connecté à Stripe"
echo ""

# URL de l'endpoint
SUPABASE_ENDPOINT="https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks"

echo "📋 Configuration :"
echo "   Endpoint : $SUPABASE_ENDPOINT"
echo ""

# Menu interactif
echo "🎯 Que voulez-vous faire ?"
echo ""
echo "   1. Forwarder les webhooks vers Supabase (en continu)"
echo "   2. Déclencher un événement checkout.session.completed de test"
echo "   3. Voir les événements récents"
echo "   4. Voir les logs en temps réel"
echo ""

read -p "Choix (1-4) : " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "📡 Forward des webhooks vers Supabase..."
        echo "   (Appuyez sur Ctrl+C pour arrêter)"
        echo ""
        echo "💡 Le secret de signature sera affiché. Utilisez-le pour tester localement."
        echo ""
        npx stripe listen --forward-to "$SUPABASE_ENDPOINT"
        ;;
    2)
        echo ""
        echo "🔔 Déclenchement d'un événement checkout.session.completed..."
        echo ""
        npx stripe trigger checkout.session.completed
        echo ""
        echo "✅ Événement déclenché ! Vérifiez dans Supabase Dashboard → Edge Functions → stripe-webhooks → Logs"
        ;;
    3)
        echo ""
        echo "📋 Événements récents (10 derniers) :"
        echo ""
        npx stripe events list --limit 10
        ;;
    4)
        echo ""
        echo "📡 Logs en temps réel..."
        echo "   (Appuyez sur Ctrl+C pour arrêter)"
        echo ""
        npx stripe listen --print
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

