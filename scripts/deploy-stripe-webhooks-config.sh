#!/bin/bash

# Script de déploiement de la configuration pour stripe-webhooks
# Ce script déploie l'Edge Function avec la configuration verify_jwt = false

set -e

echo ""
echo "🚀 DÉPLOIEMENT DE LA CONFIGURATION STRIPE-WEBHOOKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Erreur : Le fichier supabase/config.toml n'existe pas."
    echo "   Assurez-vous d'exécuter ce script depuis la racine du projet."
    exit 1
fi

echo "✅ Fichier de configuration trouvé : supabase/config.toml"
echo ""

# Vérifier le contenu de la configuration
echo "📋 Configuration actuelle :"
cat supabase/config.toml | grep -A 2 "stripe-webhooks" || echo "⚠️  Configuration stripe-webhooks non trouvée"
echo ""

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Erreur : Supabase CLI n'est pas installé."
    echo "   Installez-le avec : npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI trouvé"
echo ""

# Vérifier que l'utilisateur est connecté à Supabase
echo "🔐 Vérification de la connexion à Supabase..."
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Vous n'êtes peut-être pas connecté à Supabase."
    echo "   Connectez-vous avec : supabase login"
    echo ""
    read -p "Continuer quand même ? (o/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Connexion à Supabase vérifiée"
echo ""

# Déployer la fonction
echo "📦 Déploiement de l'Edge Function stripe-webhooks..."
echo "   (La configuration verify_jwt = false sera appliquée automatiquement)"
echo ""

if supabase functions deploy stripe-webhooks; then
    echo ""
    echo "✅✅✅ DÉPLOIEMENT RÉUSSI ✅✅✅"
    echo ""
    echo "📋 Vérifications à faire :"
    echo "   1. Tester l'URL dans le navigateur (ne doit plus afficher 401)"
    echo "   2. Tester avec Stripe Dashboard → 'Envoyer des événements de test'"
    echo "   3. Vérifier dans Supabase Dashboard → Edge Functions → stripe-webhooks"
    echo ""
    echo "🎯 La fonction stripe-webhooks accepte maintenant les webhooks Stripe !"
else
    echo ""
    echo "❌ Erreur lors du déploiement"
    echo ""
    echo "💡 Alternative : Configurez manuellement dans Supabase Dashboard :"
    echo "   1. Ouvrir : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr"
    echo "   2. Edge Functions → stripe-webhooks"
    echo "   3. Désactiver 'Verify JWT'"
    exit 1
fi

