#!/bin/bash

# Script pour installer Stripe CLI manuellement

echo ""
echo "📦 INSTALLATION MANUELLE DE STRIPE CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Détecter l'architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    STRIPE_ARCH="arm64"
    echo "🔍 Architecture détectée : Apple Silicon (arm64)"
else
    STRIPE_ARCH="amd64"
    echo "🔍 Architecture détectée : Intel (amd64)"
fi

echo ""
echo "📋 Instructions d'installation :"
echo ""
echo "1. Ouvrir dans votre navigateur :"
echo "   https://github.com/stripe/stripe-cli/releases/latest"
echo ""
echo "2. Télécharger le fichier :"
echo "   stripe_*_darwin_${STRIPE_ARCH}.tar.gz"
echo ""
echo "3. Une fois téléchargé, exécutez ces commandes :"
echo ""
echo "   # Extraire l'archive"
echo "   tar -xzf ~/Downloads/stripe_*_darwin_${STRIPE_ARCH}.tar.gz"
echo ""
echo "   # Installer dans le projet"
echo "   mkdir -p node_modules/.bin"
echo "   cp stripe node_modules/.bin/stripe"
echo "   chmod +x node_modules/.bin/stripe"
echo ""
echo "   # Vérifier"
echo "   ./node_modules/.bin/stripe --version"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier si le fichier existe déjà dans Downloads
if ls ~/Downloads/stripe_*_darwin_${STRIPE_ARCH}.tar.gz 2>/dev/null | head -1; then
    DOWNLOADED_FILE=$(ls ~/Downloads/stripe_*_darwin_${STRIPE_ARCH}.tar.gz 2>/dev/null | head -1)
    echo "✅ Fichier trouvé dans Downloads : $DOWNLOADED_FILE"
    echo ""
    read -p "Voulez-vous installer maintenant ? (o/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[OoYy]$ ]]; then
        echo "📦 Extraction en cours..."
        cd ~/Downloads
        tar -xzf "$DOWNLOADED_FILE"
        
        if [ -f "stripe" ]; then
            echo "✅ Extraction réussie !"
            echo ""
            echo "📁 Installation dans le projet..."
            cd "$OLDPWD"
            mkdir -p node_modules/.bin
            cp ~/Downloads/stripe node_modules/.bin/stripe
            chmod +x node_modules/.bin/stripe
            
            echo "✅ Installation réussie !"
            echo ""
            ./node_modules/.bin/stripe --version
            echo ""
            echo "🎉 Stripe CLI installé avec succès !"
        else
            echo "❌ Fichier stripe non trouvé après extraction"
        fi
    fi
else
    echo "💡 Fichier non trouvé dans Downloads. Veuillez télécharger manuellement."
fi

