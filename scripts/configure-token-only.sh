#!/bin/bash

# Configuration rapide du token et commandes de déploiement

SUPABASE_TOKEN="sbp_cde65a8637aa3680b475cc189236b6fec950808d"
PROJECT_REF="ewlozuwvrteopotfizcr"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "🔐 CONFIGURATION DU TOKEN SUPABASE"
echo "===================================="
echo ""

# Ajouter le token à la session actuelle
export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"

# Ajouter au fichier de configuration shell si possible
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
fi

if [ -n "$SHELL_CONFIG" ]; then
    # Vérifier si le token n'est pas déjà dans le fichier
    if ! grep -q "SUPABASE_ACCESS_TOKEN" "$SHELL_CONFIG"; then
        echo "" >> "$SHELL_CONFIG"
        echo "# Supabase Access Token" >> "$SHELL_CONFIG"
        echo "export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN" >> "$SHELL_CONFIG"
        echo "✅ Token ajouté à $SHELL_CONFIG"
    else
        echo "✅ Token déjà présent dans $SHELL_CONFIG"
        # Mettre à jour le token
        sed -i '' "s|export SUPABASE_ACCESS_TOKEN=.*|export SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN|" "$SHELL_CONFIG"
        echo "✅ Token mis à jour"
    fi
fi

echo ""
echo "✅ Token configuré pour cette session :"
echo "   SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN"
echo ""

echo "📋 COMMANDES À EXÉCUTER :"
echo ""
echo "1. Installer Supabase CLI (si pas déjà fait) :"
echo "   sudo npm install -g supabase"
echo ""

echo "2. Se connecter avec le token :"
echo "   supabase login --token $SUPABASE_TOKEN"
echo ""

echo "3. Aller dans le dossier du projet :"
echo "   cd $PROJECT_DIR"
echo ""

echo "4. Lier le projet :"
echo "   supabase link --project-ref $PROJECT_REF"
echo ""

echo "5. Déployer l'Edge Function :"
echo "   supabase functions deploy create-stripe-checkout"
echo ""

echo "════════════════════════════════════════════════════════════"
echo ""
echo "💡 ASTUCE : Le token est maintenant dans votre shell"
echo "   Les commandes ci-dessus devraient fonctionner directement !"
echo ""


