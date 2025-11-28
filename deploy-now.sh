#!/bin/bash
# Script de déploiement automatique avec votre token

export SUPABASE_ACCESS_TOKEN="sbp_cde65a8637aa3680b475cc189236b6fec950808d"

echo ""
echo "🚀 DÉPLOIEMENT AUTOMATIQUE"
echo "=========================="
echo ""

# Vérifier si CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI non trouvé"
    echo ""
    echo "Installation requise :"
    echo "   sudo npm install -g supabase"
    echo ""
    exit 1
fi

# Se connecter
echo "🔐 Connexion à Supabase..."
supabase login --token "sbp_cde65a8637aa3680b475cc189236b6fec950808d"

# Aller dans le dossier
cd "/Users/user/Downloads/cursor"

# Lier le projet
echo ""
echo "🔗 Liaison du projet..."
supabase link --project-ref ewlozuwvrteopotfizcr

# Déployer
echo ""
echo "🚀 Déploiement de l'Edge Function..."
supabase functions deploy create-stripe-checkout

echo ""
echo "✅ Déploiement terminé !"
echo ""
