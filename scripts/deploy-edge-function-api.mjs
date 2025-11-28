import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        SUPABASE_SERVICE_ROLE_KEY = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 DÉPLOIEMENT AUTOMATIQUE VIA API\n');
console.log('='.repeat(80));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

// Extraire le project ref
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Impossible d\'extraire le project ref');
  process.exit(1);
}

console.log(`📋 Project Ref: ${projectRef}`);
console.log(`📋 Supabase URL: ${SUPABASE_URL}\n`);

// Lire le code de l'Edge Function
const functionPath = path.join(__dirname, '..', 'supabase', 'functions', 'create-stripe-checkout', 'index.ts');

if (!fs.existsSync(functionPath)) {
  console.error(`❌ Fichier Edge Function non trouvé: ${functionPath}`);
  process.exit(1);
}

const functionCode = fs.readFileSync(functionPath, 'utf8');
console.log(`✅ Code Edge Function lu (${functionCode.length} caractères)\n`);

// Tenter de déployer via l'API Management de Supabase
// Note: Supabase n'a pas d'API publique pour déployer les Edge Functions
// On doit utiliser le CLI ou le Dashboard

console.log('⚠️  Supabase ne permet pas le déploiement d\'Edge Functions via API');
console.log('📋 Utilisation de l\'approche alternative : Dashboard\n');

// Créer un fichier avec les instructions de copie
const instructionsPath = path.join(__dirname, '..', 'DEPLOY_INSTRUCTIONS.txt');
const instructions = `
═══════════════════════════════════════════════════════════════════════════════
  DÉPLOIEMENT EDGE FUNCTION - INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

⚠️  IMPORTANT : Le déploiement doit se faire via Supabase Dashboard

📋 ÉTAPES RAPIDES :

1. Ouvrez Supabase Dashboard :
   https://supabase.com/dashboard/project/${projectRef}/functions

2. Cliquez sur "Create new function"
   Nom : create-stripe-checkout

3. Copiez le code depuis :
   ${functionPath}

4. Collez dans l'éditeur du Dashboard

5. Cliquez sur "Deploy"

6. Configurez les secrets :
   Settings → Edge Functions → Secrets
   - STRIPE_SECRET_KEY = sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk
   - STRIPE_WEBHOOK_SECRET = whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef

7. Redéployez après configuration des secrets :
   Edge Functions → create-stripe-checkout → Deploy

═══════════════════════════════════════════════════════════════════════════════
  CODE À COPIER :
═══════════════════════════════════════════════════════════════════════════════

${functionCode}

═══════════════════════════════════════════════════════════════════════════════
`;

fs.writeFileSync(instructionsPath, instructions, 'utf8');
console.log(`✅ Instructions créées : ${instructionsPath}\n`);

// Essayer d'ouvrir le fichier dans l'éditeur
console.log('📋 OPTIONS DE DÉPLOIEMENT :\n');
console.log('Option 1 : Via Supabase Dashboard (RECOMMANDÉ)');
console.log(`   ${SUPABASE_URL.replace('/rest/v1', '/functions')}`);
console.log('   Voir DEPLOY_INSTRUCTIONS.txt pour le code à copier\n');

console.log('Option 2 : Via Supabase CLI');
console.log('   1. Installez : sudo npm install -g supabase');
console.log('   2. Connectez : supabase login');
console.log(`   3. Liez : supabase link --project-ref ${projectRef}`);
console.log('   4. Déployez : supabase functions deploy create-stripe-checkout\n');

console.log('📄 Code Edge Function prêt à copier dans :');
console.log(`   ${instructionsPath}\n`);


