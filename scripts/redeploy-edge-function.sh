#!/bin/bash

# Script de redéploiement rapide de l'Edge Function create-stripe-checkout

set -e

echo ""
echo "🚀 REDÉPLOIEMENT - Edge Function create-stripe-checkout"
echo "========================================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Vérifier si Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI non trouvé"
    echo ""
    echo "💡 Installez-le avec :"
    echo "   sudo npm install -g supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI détecté"
echo ""

# Vérifier si on est connecté
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Non connecté à Supabase"
    echo "🔐 Connexion requise..."
    echo ""
    supabase login
    
    if [ $? -ne 0 ]; then
        echo "❌ Échec de la connexion"
        exit 1
    fi
fi

echo "✅ Connecté à Supabase"
echo ""

# Vérifier si le projet est lié
if ! supabase status &> /dev/null; then
    echo "⚠️  Projet non lié"
    echo "🔗 Liaison du projet..."
    echo ""
    supabase link --project-ref ewlozuwvrteopotfizcr
    
    if [ $? -ne 0 ]; then
        echo "❌ Échec de la liaison"
        exit 1
    fi
fi

echo "✅ Projet lié"
echo ""

# Redéployer l'Edge Function
echo "🚀 Redéploiement de create-stripe-checkout..."
echo ""

supabase functions deploy create-stripe-checkout

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Edge Function redéployée avec succès !"
    echo ""
    echo "🧪 PROCHAINE ÉTAPE :"
    echo "   Testez dans le navigateur :"
    echo "   1. Rafraîchissez la page (Cmd+R)"
    echo "   2. Créez une entreprise"
    echo "   3. Cliquez sur 'Payer par carte bancaire'"
    echo "   4. L'erreur CORS devrait disparaître !"
    echo ""
else
    echo ""
    echo "❌ Échec du redéploiement"
    echo ""
    echo "💡 Vérifiez :"
    echo "   - Que vous êtes connecté : supabase login"
    echo "   - Que le projet est lié : supabase link --project-ref ewlozuwvrteopotfizcr"
    echo "   - Les logs ci-dessus pour plus de détails"
    exit 1
fi


