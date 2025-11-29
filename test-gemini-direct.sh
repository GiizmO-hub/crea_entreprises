#!/bin/bash

# Test direct de l'API Gemini
echo "🧪 TEST DIRECT GEMINI API"
echo ""

# Récupérer la clé depuis Supabase
echo "📋 Récupération de la clé API depuis Supabase..."
GEMINI_KEY=$(npx supabase secrets list 2>/dev/null | grep GEMINI_API_KEY | head -1)

if [ -z "$GEMINI_KEY" ]; then
    echo "❌ Impossible de récupérer la clé depuis Supabase"
    echo "💡 Testez manuellement avec curl:"
    echo ""
    echo "curl -X POST \\"
    echo "  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=VOTRE_CLE' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"contents\":[{\"parts\":[{\"text\":\"Hello\"}]}]}'"
    exit 1
fi

echo "✅ Clé trouvée"
echo ""
echo "🧪 Test de l'API Gemini..."
echo ""

# Test simple
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Réponds en JSON: {\"test\": \"ok\"}"
      }]
    }],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 100,
      "responseMimeType": "application/json"
    }
  }' 2>&1

echo ""
echo ""
echo "✅ Test terminé"

