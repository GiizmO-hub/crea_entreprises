import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_TOKEN = 'sbp_cde65a8637aa3680b475cc189236b6fec950808d';
const PROJECT_REF = 'ewlozuwvrteopotfizcr';

console.log('🚀 DÉPLOIEMENT AUTOMATIQUE VIA API\n');
console.log('='.repeat(80));

// Lire le code de l'Edge Function
const functionPath = path.join(__dirname, '..', 'supabase', 'functions', 'create-stripe-checkout', 'index.ts');

if (!fs.existsSync(functionPath)) {
  console.error(`❌ Fichier Edge Function non trouvé: ${functionPath}`);
  process.exit(1);
}

const functionCode = fs.readFileSync(functionPath, 'utf8');
console.log(`✅ Code Edge Function lu (${functionCode.length} caractères)\n`);

// Essayer de déployer via l'API Management de Supabase
// Note: Supabase n'expose pas d'API publique pour déployer les Edge Functions
// Mais on peut créer un script qui utilise le CLI via child_process si installé

console.log('⚠️  Supabase nécessite le CLI pour déployer les Edge Functions\n');
console.log('📋 OPTIONS DISPONIBLES :\n');

console.log('OPTION 1 : Installation du CLI puis déploiement automatique');
console.log('   Exécutez ces commandes :\n');
console.log('   sudo npm install -g supabase');
console.log(`   export SUPABASE_ACCESS_TOKEN=${SUPABASE_TOKEN}`);
console.log('   supabase login --token ' + SUPABASE_TOKEN);
console.log('   cd ' + path.join(__dirname, '..'));
console.log('   supabase link --project-ref ' + PROJECT_REF);
console.log('   supabase functions deploy create-stripe-checkout\n');

console.log('OPTION 2 : Déploiement via Dashboard');
console.log('   https://supabase.com/dashboard/project/' + PROJECT_REF + '/functions\n');

// Créer un script shell exécutable avec toutes les commandes
const deployScript = `#!/bin/bash
# Script de déploiement automatique avec votre token

export SUPABASE_ACCESS_TOKEN="${SUPABASE_TOKEN}"

echo ""
echo "🚀 DÉPLOIEMENT AUTOMATIQUE"
echo "=========================="
echo ""

# Vérifier si CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI non trouvé"
    echo ""
    echo "Installation requise :"
    echo "   sudo npm install -g supabase"
    echo ""
    exit 1
fi

# Se connecter
echo "🔐 Connexion à Supabase..."
supabase login --token "${SUPABASE_TOKEN}"

# Aller dans le dossier
cd "${path.join(__dirname, '..')}"

# Lier le projet
echo ""
echo "🔗 Liaison du projet..."
supabase link --project-ref ${PROJECT_REF}

# Déployer
echo ""
echo "🚀 Déploiement de l'Edge Function..."
supabase functions deploy create-stripe-checkout

echo ""
echo "✅ Déploiement terminé !"
echo ""
`;

const scriptPath = path.join(__dirname, '..', 'deploy-now.sh');
fs.writeFileSync(scriptPath, deployScript, 'utf8');
fs.chmodSync(scriptPath, 0o755);

console.log(`✅ Script créé : ${scriptPath}\n`);
console.log('📋 Pour déployer automatiquement :\n');
console.log('   1. Installez le CLI : sudo npm install -g supabase');
console.log('   2. Exécutez : ./deploy-now.sh\n');

// Créer aussi un fichier avec le code à copier pour le Dashboard
const dashboardCode = `
═══════════════════════════════════════════════════════════════════
  CODE À COPIER DANS SUPABASE DASHBOARD
═══════════════════════════════════════════════════════════════════

URL : https://supabase.com/dashboard/project/${PROJECT_REF}/functions

Instructions :
1. Cliquez sur "Create new function"
2. Nom : create-stripe-checkout
3. Copiez le code ci-dessous
4. Collez dans l'éditeur
5. Cliquez sur "Deploy"

═══════════════════════════════════════════════════════════════════

${functionCode}

═══════════════════════════════════════════════════════════════════
`;

const dashboardPath = path.join(__dirname, '..', 'CODE_POUR_DASHBOARD.txt');
fs.writeFileSync(dashboardPath, dashboardCode, 'utf8');

console.log(`✅ Code pour Dashboard : ${dashboardPath}\n`);


