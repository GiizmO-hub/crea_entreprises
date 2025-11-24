#!/bin/bash
# Script pour corriger toutes les erreurs TypeScript critiques

echo "🔧 Correction des imports useAuth..."
find src/pages src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|from '../contexts/AuthContext'|from '../hooks/useAuth'|g" {} +
find src/pages src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|from '../../contexts/AuthContext'|from '../../hooks/useAuth'|g" {} +
find src/pages src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|from '../../../contexts/AuthContext'|from '../../../hooks/useAuth'|g" {} +

echo "✅ Corrections terminées"
