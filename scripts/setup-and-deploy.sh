#!/bin/bash

# Script complet : Installation CLI + Configuration Token + Déploiement

set -e

SUPABASE_TOKEN="sbp_cde65a8637aa3680b475cc189236b6fec950808d"
PROJECT_REF="ewlozuwvrteopotfizcr"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "🚀 INSTALLATION ET CONFIGURATION COMPLÈTE"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Étape 1 : Installer Supabase CLI
echo "📦 ÉTAPE 1 : Installation de Supabase CLI"
echo "------------------------------------------"

if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI déjà installé${NC}"
    supabase --version
else
    echo -e "${YELLOW}⚠️  Installation de Supabase CLI...${NC}"
    echo ""
    
    # Essayer npm global (nécessite sudo)
    if sudo npm install -g supabase 2>/dev/null; then
        echo -e "${GREEN}✅ Supabase CLI installé${NC}"
    else
        echo -e "${RED}❌ Installation échouée${NC}"
        echo ""
        echo "💡 Exécutez manuellement :"
        echo "   sudo npm install -g supabase"
        echo "   ou"
        echo "   brew install supabase/tap/supabase"
        echo ""
        echo "Puis relancez ce script."
        exit 1
    fi
fi

echo ""

# Étape 2 : Configurer le token
echo "🔐 ÉTAPE 2 : Configuration du token"
echo "------------------------------------"

export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"

echo "Token configuré dans la variable d'environnement"
echo "Connexion à Supabase..."

if supabase login --token "$SUPABASE_TOKEN" 2>/dev/null; then
    echo -e "${GREEN}✅ Connecté avec succès${NC}"
else
    echo -e "${YELLOW}⚠️  Tentative de connexion alternative...${NC}"
    # Alternative : utiliser la variable d'environnement directement
    echo "Token configuré : SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"
fi

echo ""

# Étape 3 : Vérifier la connexion
echo "✅ ÉTAPE 3 : Vérification de la connexion"
echo "------------------------------------------"

if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✅ Connexion vérifiée${NC}"
    supabase projects list | head -5
else
    echo -e "${YELLOW}⚠️  Impossible de vérifier (peut être normal)${NC}"
    echo "Continuons quand même..."
fi

echo ""

# Étape 4 : Lier le projet
echo "🔗 ÉTAPE 4 : Liaison du projet"
echo "-------------------------------"

cd "$PROJECT_DIR"

if supabase status &> /dev/null; then
    echo -e "${GREEN}✅ Projet déjà lié${NC}"
else
    echo "Liaison du projet..."
    if supabase link --project-ref "$PROJECT_REF" 2>/dev/null; then
        echo -e "${GREEN}✅ Projet lié${NC}"
    else
        echo -e "${RED}❌ Échec de la liaison${NC}"
        echo ""
        echo "💡 Liaison manuelle :"
        echo "   cd $PROJECT_DIR"
        echo "   export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"
        echo "   supabase link --project-ref $PROJECT_REF"
        exit 1
    fi
fi

echo ""

# Étape 5 : Déployer l'Edge Function
echo "🚀 ÉTAPE 5 : Déploiement de l'Edge Function"
echo "--------------------------------------------"

echo "Déploiement de create-stripe-checkout..."
echo ""

if supabase functions deploy create-stripe-checkout; then
    echo ""
    echo -e "${GREEN}✅ Edge Function déployée avec succès !${NC}"
    echo ""
    echo "🧪 PROCHAINES ÉTAPES :"
    echo "   1. Rafraîchissez votre navigateur (Cmd+R)"
    echo "   2. Créez une entreprise"
    echo "   3. Cliquez sur 'Payer par carte bancaire'"
    echo "   4. L'erreur CORS devrait disparaître !"
    echo ""
else
    echo -e "${RED}❌ Échec du déploiement${NC}"
    echo ""
    echo "💡 Déploiement manuel :"
    echo "   cd $PROJECT_DIR"
    echo "   export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"
    echo "   supabase functions deploy create-stripe-checkout"
    exit 1
fi


