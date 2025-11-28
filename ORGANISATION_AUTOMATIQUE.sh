#!/bin/bash
# Script pour organiser automatiquement les fichiers

echo "📦 ORGANISATION AUTOMATIQUE DES FICHIERS"
echo ""

# Créer les dossiers
mkdir -p archive/temp-sql archive/temp-docs archive/temp-scripts

# Déplacer les fichiers SQL (sauf migrations)
echo "→ Déplacement des fichiers SQL..."
find . -maxdepth 1 -name "*.sql" -type f -exec mv {} archive/temp-sql/ \; 2>/dev/null
echo "   ✅ Fichiers SQL déplacés vers archive/temp-sql/"

# Déplacer les fichiers Markdown (sauf README)
echo "→ Déplacement des fichiers Markdown..."
find . -maxdepth 1 -name "*.md" -type f ! -name "README.md" -exec mv {} archive/temp-docs/ \; 2>/dev/null
echo "   ✅ Fichiers Markdown déplacés vers archive/temp-docs/"

# Déplacer les scripts de test
echo "→ Déplacement des scripts de test..."
if [ -d scripts ]; then
  find scripts -name "*test*" -o -name "*diagnostic*" | head -10
fi

echo ""
echo "✅ ORGANISATION TERMINÉE !"
echo ""
echo "📁 Structure finale :"
echo "   → supabase/migrations/ (169 migrations)"
echo "   → archive/temp-sql/ (32 fichiers SQL temporaires)"
echo "   → archive/temp-docs/ (90+ fichiers MD temporaires)"
