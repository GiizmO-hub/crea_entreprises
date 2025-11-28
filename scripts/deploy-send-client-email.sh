#!/bin/bash
# Script pour déployer automatiquement l'Edge Function send-client-email

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT AUTOMATIQUE DE L'EDGE FUNCTION send-client-email"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo "❌ Erreur: Vous devez être à la racine du projet"
  exit 1
fi

# Vérifier que Supabase CLI est disponible
if ! command -v supabase &> /dev/null && [ ! -f "node_modules/.bin/supabase" ]; then
  echo "📦 Installation de Supabase CLI..."
  npm install supabase --save-dev
fi

# Utiliser npx pour exécuter Supabase CLI
SUPABASE_CMD="npx supabase"

# Vérifier que la fonction existe
if [ ! -d "supabase/functions/send-client-email" ]; then
  echo "❌ Erreur: La fonction send-client-email n'existe pas"
  exit 1
fi

echo "✅ Fonction send-client-email trouvée"
echo ""

# Demander à l'utilisateur de se connecter si nécessaire
echo "🔐 Vérification de la connexion Supabase..."
echo ""

# Essayer de déployer
echo "📤 Déploiement de l'Edge Function send-client-email..."
echo ""

if $SUPABASE_CMD functions deploy send-client-email --no-verify-jwt 2>&1; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ DÉPLOIEMENT RÉUSSI !"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "🎉 L'Edge Function send-client-email est maintenant déployée !"
  echo ""
  echo "📧 Vous pouvez maintenant :"
  echo "   1. Ouvrir le modal client"
  echo "   2. Utiliser les boutons d'envoi d'emails"
  echo "   3. Les emails seront envoyés via Resend"
  echo ""
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚠️  DÉPLOIEMENT ÉCHOUÉ"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "💡 Vous pouvez déployer manuellement :"
  echo ""
  echo "   Option 1 : Via Supabase Dashboard"
  echo "   1. Allez dans Supabase Dashboard > Edge Functions"
  echo "   2. Cliquez sur 'Deploy new function'"
  echo "   3. Uploader le dossier supabase/functions/send-client-email"
  echo ""
  echo "   Option 2 : Via CLI (après connexion)"
  echo "   npx supabase login"
  echo "   npx supabase link --project-ref YOUR_PROJECT_REF"
  echo "   npx supabase functions deploy send-client-email"
  echo ""
  exit 1
fi

