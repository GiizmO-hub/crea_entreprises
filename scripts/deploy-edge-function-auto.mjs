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

console.log('🚀 DÉPLOIEMENT AUTOMATIQUE DE L\'EDGE FUNCTION\n');
console.log('='.repeat(80));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  console.error('\n💡 Ajoutez-les dans votre fichier .env');
  process.exit(1);
}

// Lire le code de l'Edge Function
const functionPath = path.join(__dirname, '..', 'supabase', 'functions', 'create-stripe-checkout', 'index.ts');

if (!fs.existsSync(functionPath)) {
  console.error(`❌ Fichier Edge Function non trouvé: ${functionPath}`);
  process.exit(1);
}

const functionCode = fs.readFileSync(functionPath, 'utf8');
console.log(`✅ Code Edge Function lu (${functionCode.length} caractères)\n`);

// Extraire le project ref de l'URL
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Impossible d\'extraire le project ref de SUPABASE_URL');
  console.error(`   URL: ${SUPABASE_URL}`);
  process.exit(1);
}

console.log(`📋 Project Ref: ${projectRef}`);
console.log(`📋 Supabase URL: ${SUPABASE_URL}\n`);

// Vérifier si Supabase CLI est disponible
import { execSync } from 'child_process';

let hasSupabaseCLI = false;
try {
  execSync('which supabase', { stdio: 'ignore' });
  hasSupabaseCLI = true;
} catch {
  hasSupabaseCLI = false;
}

if (hasSupabaseCLI) {
  console.log('✅ Supabase CLI détecté\n');
  console.log('📦 Tentative de déploiement via CLI...\n');
  
  try {
    // Vérifier si on est lié au projet
    try {
      execSync('supabase status', { stdio: 'ignore', cwd: path.join(__dirname, '..') });
    } catch {
      console.log('⚠️  Projet non lié. Tentative de liaison...');
      console.log(`   Project Ref: ${projectRef}`);
      console.log('\n💡 Vous devrez peut-être lier le projet manuellement:');
      console.log(`   supabase link --project-ref ${projectRef}\n`);
    }
    
    // Déployer l'Edge Function
    console.log('🚀 Déploiement de create-stripe-checkout...');
    const output = execSync('supabase functions deploy create-stripe-checkout', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log(output);
    console.log('\n✅ Edge Function déployée avec succès via CLI !\n');
    
    // Instructions pour les secrets
    console.log('📝 PROCHAINES ÉTAPES :');
    console.log('   1. Configurez les secrets dans Supabase Dashboard :');
    console.log('      Settings → Edge Functions → Secrets');
    console.log('   2. Ajoutez :');
    console.log('      - STRIPE_SECRET_KEY = sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk');
    console.log('      - STRIPE_WEBHOOK_SECRET = whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef');
    console.log('   3. Redéployez après configuration des secrets :');
    console.log('      supabase functions deploy create-stripe-checkout');
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement CLI:', error.message);
    console.log('\n📋 DÉPLOIEMENT MANUEL REQUIS :');
    console.log('   Voir DEPLOY_EDGE_FUNCTION_NOW.md pour les instructions détaillées');
  }
} else {
  console.log('⚠️  Supabase CLI non trouvé\n');
  console.log('📋 DÉPLOIEMENT MANUEL REQUIS :\n');
  console.log('Option 1 : Installer Supabase CLI puis redémarrer ce script');
  console.log('   npm install -g supabase');
  console.log('   supabase login');
  console.log('   supabase link --project-ref ' + projectRef);
  console.log('   supabase functions deploy create-stripe-checkout\n');
  
  console.log('Option 2 : Déployer via Supabase Dashboard');
  console.log('   1. Allez sur https://supabase.com/dashboard');
  console.log('   2. Sélectionnez votre projet');
  console.log('   3. Edge Functions → Create new function');
  console.log('   4. Nom : create-stripe-checkout');
  console.log('   5. Copiez le code depuis :');
  console.log(`      ${functionPath}`);
  console.log('   6. Collez dans l\'éditeur et cliquez sur Deploy\n');
  
  console.log('📖 Guide complet : DEPLOY_EDGE_FUNCTION_NOW.md\n');
}


