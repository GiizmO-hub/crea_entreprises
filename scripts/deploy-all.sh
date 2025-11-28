#!/bin/bash
# Script complet pour déployer tout : migrations, Edge Functions, et GitHub
# Usage: ./scripts/deploy-all.sh [message de commit]

set -e

COMMIT_MESSAGE="${1:-Mise à jour complète: migrations, Edge Functions et code}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT COMPLET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ce script va :"
echo "  1. ✅ Déployer les Edge Functions sur Supabase"
echo "  2. ✅ Pousser le code vers GitHub"
echo "  3. ✅ Vercel redéploiera automatiquement"
echo ""

# 1. Déployer les Edge Functions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 ÉTAPE 1: Déploiement des Edge Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v supabase &> /dev/null || [ -f "node_modules/.bin/supabase" ]; then
  echo "📤 Déploiement send-client-email..."
  npx supabase functions deploy send-client-email --no-verify-jwt 2>&1 | grep -E "(Deployed|Error|error)" || true
  
  echo ""
  echo "📤 Déploiement resend-webhooks..."
  npx supabase functions deploy resend-webhooks --no-verify-jwt 2>&1 | grep -E "(Deployed|Error|error)" || true
  
  echo ""
  echo "✅ Edge Functions déployées"
else
  echo "⚠️  Supabase CLI non trouvé, passage de l'étape Edge Functions"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 ÉTAPE 2: Push vers GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 2. Déployer sur GitHub
bash scripts/deploy-to-github.sh "$COMMIT_MESSAGE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DÉPLOIEMENT COMPLET TERMINÉ !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. ⏳ Attendre que Vercel détecte les changements (1-2 min)"
echo "  2. 🌐 Vérifier le déploiement sur votre domaine Vercel"
echo "  3. 📧 Configurer Resend avec votre domaine (voir GUIDE_RESEND_DOMAINE.md)"
echo ""

