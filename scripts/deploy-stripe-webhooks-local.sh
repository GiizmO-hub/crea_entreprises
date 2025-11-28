#!/bin/bash

# Script de déploiement de stripe-webhooks avec Supabase CLI installé localement
# Utilise npx pour exécuter Supabase CLI sans installation globale

set -e

echo ""
echo "🚀 DÉPLOIEMENT STRIPE-WEBHOOKS (CLI Local)"
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

# Vérifier que Supabase CLI est disponible (localement ou via npx)
if [ ! -f "node_modules/.bin/supabase" ] && ! command -v npx &> /dev/null; then
    echo "❌ Erreur : Supabase CLI n'est pas disponible."
    echo "   Installation en cours..."
    npm install supabase --save-dev
fi

echo "✅ Supabase CLI disponible"
echo ""

# Vérifier la connexion à Supabase
echo "🔐 Vérification de la connexion à Supabase..."
if ! npx supabase projects list &> /dev/null; then
    echo "⚠️  Vous n'êtes peut-être pas connecté à Supabase."
    echo ""
    echo "🔑 Connexion à Supabase..."
    echo "   (Une fenêtre du navigateur va s'ouvrir pour vous authentifier)"
    echo ""
    npx supabase login
    echo ""
fi

echo "✅ Connexion à Supabase vérifiée"
echo ""

# Vérifier que le projet est lié
echo "🔗 Vérification du lien avec le projet..."
PROJECT_REF="ewlozuwvrteopotfizcr"

if ! npx supabase link --project-ref "$PROJECT_REF" --password "" 2>&1 | grep -q "Linked\|already linked"; then
    echo "⚠️  Le projet n'est pas encore lié."
    echo ""
    echo "🔗 Liaison du projet..."
    echo "   Project ref: $PROJECT_REF"
    echo ""
    npx supabase link --project-ref "$PROJECT_REF"
    echo ""
fi

echo "✅ Projet lié"
echo ""

# Afficher la configuration actuelle
echo "📋 Configuration à déployer :"
cat supabase/config.toml | grep -A 2 "stripe-webhooks" || echo "⚠️  Configuration stripe-webhooks non trouvée"
echo ""

# Déployer la fonction
echo "📦 Déploiement de l'Edge Function stripe-webhooks..."
echo "   (La configuration verify_jwt = false sera appliquée automatiquement)"
echo ""

if npx supabase functions deploy stripe-webhooks; then
    echo ""
    echo "✅✅✅ DÉPLOIEMENT RÉUSSI ✅✅✅"
    echo ""
    echo "📋 Vérifications à faire :"
    echo "   1. Tester l'URL dans le navigateur (ne doit plus afficher 401)"
    echo "      https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks"
    echo ""
    echo "   2. Tester avec Stripe Dashboard → 'Envoyer des événements de test'"
    echo ""
    echo "   3. Vérifier dans Supabase Dashboard → Edge Functions → stripe-webhooks"
    echo ""
    echo "🎯 La fonction stripe-webhooks accepte maintenant les webhooks Stripe !"
else
    echo ""
    echo "❌ Erreur lors du déploiement"
    echo ""
    echo "💡 Alternative : Configurez manuellement dans Supabase Dashboard :"
    echo "   1. Ouvrir : https://supabase.com/dashboard/project/$PROJECT_REF"
    echo "   2. Edge Functions → stripe-webhooks"
    echo "   3. Désactiver 'Verify JWT'"
    exit 1
fi

