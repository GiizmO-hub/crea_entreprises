#!/bin/bash

# Script de déploiement automatique de l'Edge Function
# Suit la méthodologie : CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD

set -e

echo ""
echo "🚀 DÉPLOIEMENT AUTOMATIQUE - Edge Function create-stripe-checkout"
echo "=================================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Étape 1 : Vérifier Supabase CLI
echo "📦 ÉTAPE 1 : Vérification de Supabase CLI"
echo "----------------------------------------"

if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI installé${NC}"
    supabase --version
else
    echo -e "${YELLOW}⚠️  Supabase CLI non trouvé${NC}"
    echo ""
    echo "Installation de Supabase CLI..."
    echo ""
    
    # Essayer avec npm (peut nécessiter sudo)
    if npm install -g supabase 2>/dev/null; then
        echo -e "${GREEN}✅ Supabase CLI installé${NC}"
    else
        echo -e "${RED}❌ Installation échouée (permissions requises)${NC}"
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

# Étape 2 : Vérifier la connexion
echo "🔐 ÉTAPE 2 : Vérification de la connexion"
echo "----------------------------------------"

if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✅ Connecté à Supabase${NC}"
else
    echo -e "${YELLOW}⚠️  Connexion requise${NC}"
    echo ""
    echo "Exécution de : supabase login"
    echo ""
    supabase login
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Échec de la connexion${NC}"
        exit 1
    fi
fi

echo ""

# Étape 3 : Lire le project ref depuis .env
echo "📋 ÉTAPE 3 : Lecture de la configuration"
echo "----------------------------------------"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    exit 1
fi

SUPABASE_URL=$(grep -E "^VITE_SUPABASE_URL=|^SUPABASE_URL=" .env | head -1 | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_URL non trouvé dans .env${NC}"
    exit 1
fi

PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's|https\?://\([^.]*\)\.supabase\.co|\1|p')

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Impossible d'extraire le project ref${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Project Ref: $PROJECT_REF${NC}"
echo ""

# Étape 4 : Lier le projet
echo "🔗 ÉTAPE 4 : Liaison du projet"
echo "----------------------------------------"

if supabase status &> /dev/null; then
    echo -e "${GREEN}✅ Projet déjà lié${NC}"
else
    echo "Liaison du projet..."
    supabase link --project-ref "$PROJECT_REF"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Échec de la liaison${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Projet lié${NC}"
fi

echo ""

# Étape 5 : Déployer l'Edge Function
echo "🚀 ÉTAPE 5 : Déploiement de l'Edge Function"
echo "----------------------------------------"

if [ ! -d "supabase/functions/create-stripe-checkout" ]; then
    echo -e "${RED}❌ Dossier Edge Function non trouvé${NC}"
    exit 1
fi

echo "Déploiement de create-stripe-checkout..."
echo ""

supabase functions deploy create-stripe-checkout

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Edge Function déployée avec succès !${NC}"
    echo ""
    echo "📝 PROCHAINES ÉTAPES IMPORTANTES :"
    echo ""
    echo "1️⃣  Configurez les secrets dans Supabase Dashboard :"
    echo "   Settings → Edge Functions → Secrets"
    echo ""
    echo "2️⃣  Ajoutez ces secrets :"
    echo "   - STRIPE_SECRET_KEY = sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk"
    echo "   - STRIPE_WEBHOOK_SECRET = whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef"
    echo ""
    echo "3️⃣  Redéployez après configuration des secrets :"
    echo "   supabase functions deploy create-stripe-checkout"
    echo ""
    echo "4️⃣  Testez dans le navigateur !"
    echo ""
else
    echo -e "${RED}❌ Échec du déploiement${NC}"
    echo ""
    echo "💡 Voir DEPLOY_EDGE_FUNCTION_NOW.md pour déploiement manuel"
    exit 1
fi


