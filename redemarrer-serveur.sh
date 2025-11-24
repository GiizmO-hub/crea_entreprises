#!/bin/bash
echo "🛑 Arrêt des processus en cours..."
pkill -f "vite|node.*dev" 2>/dev/null
sleep 2
echo "🚀 Redémarrage du serveur..."
npm run dev
