#!/bin/bash

# Script d'application automatique de migration
# Utilise Supabase CLI pour appliquer la migration

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 APPLICATION AUTOMATIQUE DE MIGRATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Supabase CLI ou npx non trouvé !"
    exit 1
fi

echo "✅ Supabase CLI disponible"
echo ""

# Lier le projet (si pas déjà lié)
echo "🔗 Liaison du projet Supabase..."
echo "   Project ID: ewlozuwvrteopotfizcr"
echo ""
echo "⚠️  Vous devrez entrer votre token Supabase"
echo "   Récupérez-le ici: https://supabase.com/dashboard/account/tokens"
echo ""
read -p "Avez-vous votre token Supabase ? (o/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo ""
    echo "📋 Récupérez votre token:"
    echo "   1. Allez sur: https://supabase.com/dashboard/account/tokens"
    echo "   2. Créez un nouveau token (nom: 'cli-token')"
    echo "   3. Copiez le token"
    echo "   4. Relancez ce script"
    exit 1
fi

# Copier le fichier dans migrations si nécessaire
if [ ! -f "supabase/migrations/$(date +%Y%m%d)_fix_complete_workflow.sql" ]; then
    echo "📄 Copie du fichier SQL dans migrations..."
    mkdir -p supabase/migrations
    cp APPLY_LAST_MIGRATION_NOW.sql "supabase/migrations/$(date +%Y%m%d%H%M%S)_fix_complete_workflow.sql"
    echo "✅ Fichier copié"
    echo ""
fi

# Lier le projet
echo "🔗 Liaison du projet..."
npx supabase link --project-ref ewlozuwvrteopotfizcr || {
    echo "⚠️  Projet peut-être déjà lié, continuons..."
}

echo ""
echo "📤 Application de la migration..."
echo ""

# Appliquer la migration
npx supabase db push || {
    echo ""
    echo "❌ Erreur lors de l'application"
    echo ""
    echo "💡 Solution alternative:"
    echo "   1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new"
    echo "   2. Ouvrez le fichier: APPLY_LAST_MIGRATION_NOW.sql"
    echo "   3. Copiez/Coller et exécutez"
    exit 1
}

echo ""
echo "✅ Migration appliquée avec succès !"
echo ""

