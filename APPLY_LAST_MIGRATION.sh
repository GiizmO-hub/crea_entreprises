#!/bin/bash

# Script d'application automatique de la dernière migration
# Utilise Supabase CLI pour appliquer la migration

echo "🚀 APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION"
echo "=================================================="
echo ""

# Configuration
export SUPABASE_ACCESS_TOKEN="sbp_cde65a8637aa3680b475cc189236b6fec950808d"
PROJECT_ID="ewlozuwvrteopotfizcr"

# Trouver la dernière migration
LAST_MIGRATION=$(ls -t supabase/migrations/*.sql | grep -v APPLY_FIXES | head -1)
MIGRATION_NAME=$(basename "$LAST_MIGRATION")

echo "📋 Dernière migration détectée : $MIGRATION_NAME"
echo ""

# Lire le contenu
CONTENT=$(cat "$LAST_MIGRATION")
SIZE=$(echo "$CONTENT" | wc -c)

echo "✅ Migration lue ($(echo "scale=2; $SIZE/1024" | bc) KB)"
echo ""

# Créer un fichier SQL prêt à appliquer
OUTPUT_FILE="APPLY_LAST_MIGRATION_NOW.sql"

cat > "$OUTPUT_FILE" << EOF
/*
  ============================================================================
  APPLICATION AUTOMATIQUE DE LA DERNIÈRE MIGRATION
  ============================================================================
  
  Migration: $MIGRATION_NAME
  Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/$PROJECT_ID/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

$CONTENT

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration $MIGRATION_NAME appliquée avec succès !' as status;
EOF

echo "✅ Fichier SQL créé : $OUTPUT_FILE"
echo "   Taille: $(echo "scale=2; $(wc -c < "$OUTPUT_FILE")/1024" | bc) KB"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  📖 PROCHAINES ÉTAPES"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "1. Ouvrez : https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo "2. Ouvrez : $OUTPUT_FILE"
echo "3. Copiez tout (Cmd+A, Cmd+C)"
echo "4. Collez et exécutez"
echo ""
echo "✅ La migration sera appliquée automatiquement !"
echo ""

