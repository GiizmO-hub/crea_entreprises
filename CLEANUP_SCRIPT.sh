#!/bin/bash

# Script de nettoyage des fichiers inutiles au root
# Crée un dossier archive et déplace les fichiers

echo "🧹 Nettoyage du projet..."
echo ""

# Créer les dossiers d'archive
mkdir -p archive/migrations archive/docs 2>/dev/null

# Déplacer les fichiers SQL (sauf APPLY_LAST_MIGRATION_NOW.sql)
echo "📦 Déplacement des fichiers SQL..."
mv -f *.sql archive/migrations/ 2>/dev/null
mv -f archive/migrations/APPLY_LAST_MIGRATION_NOW.sql . 2>/dev/null || true
mv -f archive/migrations/README.md archive/docs/ 2>/dev/null || true

# Déplacer les fichiers de documentation .md (sauf README.md principal)
echo "📚 Déplacement des fichiers de documentation..."
for file in *.md; do
  if [ "$file" != "README.md" ] && [ "$file" != "ANALYSE_ET_CORRECTIONS_COMPLÈTES.md" ]; then
    mv -f "$file" archive/docs/ 2>/dev/null || true
  fi
done

# Déplacer les fichiers .txt et .html inutiles
echo "📄 Déplacement des fichiers texte..."
mv -f *.txt archive/docs/ 2>/dev/null || true
mv -f *.html archive/docs/ 2>/dev/null || true

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "📁 Fichiers déplacés vers archive/"
echo "📋 Fichiers conservés au root:"
echo "   - README.md"
echo "   - ANALYSE_ET_CORRECTIONS_COMPLÈTES.md"
echo "   - APPLY_LAST_MIGRATION_NOW.sql (si existe)"
echo ""

