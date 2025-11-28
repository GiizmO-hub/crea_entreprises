#!/bin/bash

# Script final d'application automatique de la migration
# Utilise psql si disponible, sinon guide l'utilisateur

set -e

DB_PASSWORD="${SUPABASE_DB_PASSWORD:-oigfYelQfUZHHTnU}"
PROJECT_REF="ewlozuwvrteopotfizcr"
SQL_FILE="APPLY_LAST_MIGRATION_NOW.sql"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Trouver psql
PSQL_CMD=""
if command -v psql &> /dev/null; then
  PSQL_CMD="psql"
elif [ -f "/opt/homebrew/opt/postgresql@15/bin/psql" ]; then
  PSQL_CMD="/opt/homebrew/opt/postgresql@15/bin/psql"
  export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
fi

if [ -z "$PSQL_CMD" ]; then
  echo "❌ psql non trouvé"
  echo ""
  echo "🔧 Installation de PostgreSQL..."
  brew install postgresql@15 || {
    echo ""
    echo "⚠️  Installation automatique échouée"
    echo ""
    echo "💡 SOLUTION ALTERNATIVE (2 MINUTES):"
    echo ""
    echo "1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new"
    echo "2. Ouvrez: $SQL_FILE"
    echo "3. Copiez tout → Collez → RUN"
    exit 1
  }
  
  PSQL_CMD="/opt/homebrew/opt/postgresql@15/bin/psql"
  export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
fi

echo "✅ psql trouvé: $PSQL_CMD"
echo ""

# Connection string
CONN_STRING="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"

echo "🔌 Connexion à PostgreSQL..."
echo "📤 Application de la migration..."
echo ""

# Appliquer le SQL
export PGPASSWORD="$DB_PASSWORD"

$PSQL_CMD "$CONN_STRING" -f "$SQL_FILE" 2>&1 | grep -v "^NOTICE:" | grep -v "^$" || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ MIGRATION APPLIQUÉE !"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérification
echo "🔍 Vérification des plans..."
$PSQL_CMD "$CONN_STRING" -c "SELECT COUNT(*) as count FROM plans_abonnement WHERE actif = true;" 2>&1 | grep -v "^NOTICE:"

echo ""
echo "✅ Terminé !"

