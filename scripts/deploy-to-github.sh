#!/bin/bash
# Script pour déployer automatiquement sur GitHub
# Usage: ./scripts/deploy-to-github.sh [message de commit]

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT AUTOMATIQUE VERS GITHUB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo "❌ Erreur: Vous devez être à la racine du projet"
  exit 1
fi

# Vérifier que Git est initialisé
if [ ! -d ".git" ]; then
  echo "❌ Erreur: Git n'est pas initialisé"
  exit 1
fi

# Vérifier que le remote origin est configuré
if ! git remote | grep -q "origin"; then
  echo "❌ Erreur: Remote 'origin' non configuré"
  echo "Exécutez: git remote add origin git@github.com:GiizmO-hub/crea_entreprises.git"
  exit 1
fi

echo "📡 Remote configuré: $(git remote get-url origin)"
echo ""

# Récupérer le message de commit
COMMIT_MESSAGE="${1:-Mise à jour automatique du code}"

# Afficher le statut actuel
echo "📋 Statut actuel:"
git status --short
echo ""

# Vérifier s'il y a des changements
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ Aucun changement détecté, rien à commiter"
  exit 0
fi

# Ajouter tous les fichiers (sauf ceux dans .gitignore)
echo "📦 Ajout des fichiers..."
git add -A
echo ""

# Créer le commit
echo "💾 Création du commit..."
git commit -m "$COMMIT_MESSAGE

Déploiement automatique:
- Date: $(date '+%Y-%m-%d %H:%M:%S')
- Branche: $(git branch --show-current)
- Dernière modification: $(git log -1 --format='%h - %s' 2>/dev/null || echo 'Nouveau commit')
" || {
  echo "⚠️  Aucun changement à commiter (peut-être que tout est déjà commité)"
  exit 0
}
echo ""

# Récupérer la branche actuelle
CURRENT_BRANCH=$(git branch --show-current)

echo "📤 Push vers GitHub (branche: $CURRENT_BRANCH)..."
if git push origin "$CURRENT_BRANCH" 2>&1; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ DÉPLOIEMENT RÉUSSI !"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "🌐 Repository: https://github.com/GiizmO-hub/crea_entreprises"
  echo "📋 Branche: $CURRENT_BRANCH"
  echo ""
  echo "⚡ Vercel va automatiquement détecter les changements et redéployer"
  echo ""
else
  echo ""
  echo "❌ Erreur lors du push"
  echo ""
  echo "💡 Solutions possibles:"
  echo "   1. Vérifier votre authentification GitHub (SSH ou HTTPS)"
  echo "   2. Vérifier les permissions du dépôt"
  echo "   3. Essayer: git pull origin $CURRENT_BRANCH --rebase"
  exit 1
fi

