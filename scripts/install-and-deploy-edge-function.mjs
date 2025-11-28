import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 INSTALLATION ET DÉPLOIEMENT AUTOMATIQUE\n');
console.log('='.repeat(80));

// Étape 1 : Vérifier/Installer Supabase CLI
console.log('\n📦 ÉTAPE 1 : Installation de Supabase CLI\n');

let hasSupabaseCLI = false;
try {
  execSync('which supabase', { stdio: 'ignore' });
  hasSupabaseCLI = true;
  console.log('✅ Supabase CLI déjà installé');
} catch {
  console.log('⚠️  Supabase CLI non trouvé');
  console.log('📥 Installation de Supabase CLI...\n');
  
  try {
    // Essayer avec npm
    console.log('   Installation via npm...');
    execSync('npm install -g supabase', { stdio: 'inherit' });
    hasSupabaseCLI = true;
    console.log('✅ Supabase CLI installé avec succès\n');
  } catch (error) {
    console.error('❌ Erreur lors de l\'installation:', error.message);
    console.log('\n💡 Installation manuelle requise :');
    console.log('   npm install -g supabase');
    console.log('   ou');
    console.log('   brew install supabase/tap/supabase');
    process.exit(1);
  }
}

// Étape 2 : Vérifier la connexion
console.log('📋 ÉTAPE 2 : Vérification de la connexion\n');

try {
  execSync('supabase --version', { stdio: 'pipe' });
  console.log('✅ Supabase CLI fonctionne\n');
} catch (error) {
  console.error('❌ Erreur avec Supabase CLI:', error.message);
  process.exit(1);
}

// Étape 3 : Lire les variables d'environnement
console.log('📋 ÉTAPE 3 : Lecture des variables d\'environnement\n');

const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL;

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
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL non trouvé dans .env');
  console.error('   Ajoutez VITE_SUPABASE_URL dans votre fichier .env');
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Impossible d\'extraire le project ref');
  process.exit(1);
}

console.log(`✅ Project Ref détecté: ${projectRef}\n`);

// Étape 4 : Vérifier si on est connecté
console.log('📋 ÉTAPE 4 : Vérification de la connexion Supabase\n');

try {
  execSync('supabase projects list', { stdio: 'pipe', timeout: 10000 });
  console.log('✅ Connecté à Supabase\n');
} catch (error) {
  console.log('⚠️  Non connecté à Supabase');
  console.log('🔐 Connexion requise...\n');
  console.log('💡 Exécutez manuellement :');
  console.log('   supabase login');
  console.log('   supabase link --project-ref ' + projectRef);
  console.log('\n   Puis relancez ce script.\n');
  process.exit(1);
}

// Étape 5 : Vérifier si le projet est lié
console.log('📋 ÉTAPE 5 : Vérification du lien au projet\n');

const projectDir = path.join(__dirname, '..');
let isLinked = false;

try {
  const status = execSync('supabase status', { 
    cwd: projectDir, 
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (status.includes('Linked') || status.includes(projectRef)) {
    isLinked = true;
    console.log('✅ Projet déjà lié\n');
  }
} catch {
  console.log('⚠️  Projet non lié');
  console.log('🔗 Liaison du projet...\n');
  
  try {
    execSync(`supabase link --project-ref ${projectRef}`, {
      cwd: projectDir,
      stdio: 'inherit'
    });
    isLinked = true;
    console.log('✅ Projet lié avec succès\n');
  } catch (error) {
    console.error('❌ Erreur lors de la liaison:', error.message);
    console.log('\n💡 Liaison manuelle requise :');
    console.log(`   supabase link --project-ref ${projectRef}\n`);
    process.exit(1);
  }
}

// Étape 6 : Déployer l'Edge Function
console.log('📋 ÉTAPE 6 : Déploiement de l\'Edge Function\n');

const functionPath = path.join(projectDir, 'supabase', 'functions', 'create-stripe-checkout');

if (!fs.existsSync(functionPath)) {
  console.error(`❌ Dossier Edge Function non trouvé: ${functionPath}`);
  process.exit(1);
}

console.log('🚀 Déploiement de create-stripe-checkout...\n');

try {
  execSync('supabase functions deploy create-stripe-checkout', {
    cwd: projectDir,
    stdio: 'inherit'
  });
  
  console.log('\n✅ Edge Function déployée avec succès !\n');
  
  // Instructions pour les secrets
  console.log('📝 PROCHAINES ÉTAPES IMPORTANTES :\n');
  console.log('1️⃣  Configurez les secrets dans Supabase Dashboard :');
  console.log('   Settings → Edge Functions → Secrets\n');
  console.log('2️⃣  Ajoutez ces secrets :');
  console.log('   - STRIPE_SECRET_KEY = sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk');
  console.log('   - STRIPE_WEBHOOK_SECRET = whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef\n');
  console.log('3️⃣  Redéployez après configuration des secrets :');
  console.log('   supabase functions deploy create-stripe-checkout\n');
  console.log('4️⃣  Testez dans le navigateur !\n');
  
} catch (error) {
  console.error('\n❌ Erreur lors du déploiement:', error.message);
  console.log('\n💡 Déploiement manuel requis :');
  console.log('   Voir DEPLOY_EDGE_FUNCTION_NOW.md\n');
  process.exit(1);
}


