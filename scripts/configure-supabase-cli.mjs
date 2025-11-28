import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_TOKEN = 'sbp_cde65a8637aa3680b475cc189236b6fec950808d';
const PROJECT_REF = 'ewlozuwvrteopotfizcr';

console.log('🔐 CONFIGURATION DU CLI SUPABASE\n');
console.log('='.repeat(80));

// Étape 1 : Vérifier/Installer Supabase CLI
console.log('\n📦 ÉTAPE 1 : Vérification de Supabase CLI\n');

let hasSupabaseCLI = false;
try {
  execSync('which supabase', { stdio: 'ignore' });
  hasSupabaseCLI = true;
  const version = execSync('supabase --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Supabase CLI installé : ${version}\n`);
} catch {
  console.log('⚠️  Supabase CLI non trouvé');
  console.log('📥 Installation requise...\n');
  console.log('💡 Exécutez : sudo npm install -g supabase\n');
  console.log('   Ou : brew install supabase/tap/supabase\n');
  process.exit(1);
}

// Étape 2 : Configurer le token
console.log('🔐 ÉTAPE 2 : Configuration du token\n');

try {
  console.log('Configuration du token Supabase...');
  
  // Méthode 1 : Via variable d'environnement et login
  process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_TOKEN;
  
  // Essayer de se connecter avec le token
  execSync(`supabase login --token ${SUPABASE_TOKEN}`, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN }
  });
  
  console.log('✅ Token configuré avec succès\n');
} catch (error) {
  console.error('❌ Erreur lors de la configuration du token:', error.message);
  console.log('\n💡 Configuration manuelle requise :');
  console.log(`   export SUPABASE_ACCESS_TOKEN=${SUPABASE_TOKEN}`);
  console.log(`   supabase login --token ${SUPABASE_TOKEN}\n`);
  process.exit(1);
}

// Étape 3 : Vérifier la connexion
console.log('✅ ÉTAPE 3 : Vérification de la connexion\n');

try {
  const projects = execSync('supabase projects list', {
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN },
    stdio: 'pipe'
  });
  
  console.log('✅ Connecté à Supabase\n');
  console.log('Projets disponibles :');
  console.log(projects);
} catch (error) {
  console.error('⚠️  Impossible de lister les projets:', error.message);
  console.log('\n💡 Le token peut être valide mais la vérification a échoué');
  console.log('   Continuons quand même...\n');
}

// Étape 4 : Lier le projet
console.log('🔗 ÉTAPE 4 : Liaison du projet\n');

const projectDir = path.join(__dirname, '..');

try {
  // Vérifier si déjà lié
  try {
    const status = execSync('supabase status', {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN }
    });
    
    if (status.includes('Linked') || status.includes(PROJECT_REF)) {
      console.log('✅ Projet déjà lié\n');
    }
  } catch {
    console.log('Liaison du projet...');
    execSync(`supabase link --project-ref ${PROJECT_REF}`, {
      cwd: projectDir,
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN }
    });
    console.log('✅ Projet lié avec succès\n');
  }
} catch (error) {
  console.error('❌ Erreur lors de la liaison:', error.message);
  console.log('\n💡 Liaison manuelle requise :');
  console.log(`   cd ${projectDir}`);
  console.log(`   export SUPABASE_ACCESS_TOKEN=${SUPABASE_TOKEN}`);
  console.log(`   supabase link --project-ref ${PROJECT_REF}\n`);
  process.exit(1);
}

// Étape 5 : Déployer l'Edge Function
console.log('🚀 ÉTAPE 5 : Déploiement de l\'Edge Function\n');

try {
  console.log('Déploiement de create-stripe-checkout...\n');
  
  execSync('supabase functions deploy create-stripe-checkout', {
    cwd: projectDir,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN }
  });
  
  console.log('\n✅ Edge Function déployée avec succès !\n');
  
  console.log('🧪 PROCHAINES ÉTAPES :');
  console.log('   1. Rafraîchissez votre navigateur (Cmd+R)');
  console.log('   2. Créez une entreprise');
  console.log('   3. Cliquez sur "Payer par carte bancaire"');
  console.log('   4. L\'erreur CORS devrait disparaître !\n');
  
} catch (error) {
  console.error('\n❌ Erreur lors du déploiement:', error.message);
  console.log('\n💡 Déploiement manuel requis :');
  console.log(`   cd ${projectDir}`);
  console.log(`   export SUPABASE_ACCESS_TOKEN=${SUPABASE_TOKEN}`);
  console.log('   supabase functions deploy create-stripe-checkout\n');
  process.exit(1);
}


