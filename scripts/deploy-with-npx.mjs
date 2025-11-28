import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_TOKEN = 'sbp_cde65a8637aa3680b475cc189236b6fec950808d';
const PROJECT_REF = 'ewlozuwvrteopotfizcr';
const PROJECT_DIR = path.join(__dirname, '..');

process.env.SUPABASE_ACCESS_TOKEN = SUPABASE_TOKEN;

console.log('🚀 DÉPLOIEMENT AUTOMATIQUE VIA NPX\n');
console.log('='.repeat(80));

try {
  console.log('\n📦 Étape 1 : Vérification de npx...');
  execSync('which npx', { stdio: 'ignore' });
  console.log('✅ npx disponible\n');
} catch {
  console.error('❌ npx non trouvé');
  process.exit(1);
}

try {
  console.log('🔐 Étape 2 : Connexion à Supabase...');
  
  // Utiliser npx pour exécuter supabase sans installation globale
  const loginCmd = `npx supabase login --token ${SUPABASE_TOKEN}`;
  execSync(loginCmd, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN },
    cwd: PROJECT_DIR
  });
  
  console.log('✅ Connecté avec succès\n');
} catch (error) {
  console.error('❌ Erreur de connexion:', error.message);
  process.exit(1);
}

try {
  console.log('🔗 Étape 3 : Liaison du projet...');
  
  const linkCmd = `npx supabase link --project-ref ${PROJECT_REF}`;
  execSync(linkCmd, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN },
    cwd: PROJECT_DIR
  });
  
  console.log('✅ Projet lié\n');
} catch (error) {
  console.error('⚠️  Erreur de liaison (peut être déjà lié):', error.message);
  console.log('Continuons quand même...\n');
}

try {
  console.log('🚀 Étape 4 : Déploiement de l\'Edge Function...\n');
  
  const deployCmd = 'npx supabase functions deploy create-stripe-checkout';
  execSync(deployCmd, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: SUPABASE_TOKEN },
    cwd: PROJECT_DIR
  });
  
  console.log('\n✅ Edge Function déployée avec succès !\n');
  
  console.log('🧪 PROCHAINES ÉTAPES :');
  console.log('   1. Rafraîchissez votre navigateur (Cmd+R)');
  console.log('   2. Créez une entreprise');
  console.log('   3. Cliquez sur "Payer par carte bancaire"');
  console.log('   4. L\'erreur CORS devrait disparaître !\n');
  
} catch (error) {
  console.error('\n❌ Erreur lors du déploiement:', error.message);
  console.log('\n💡 Vérifiez :');
  console.log('   - Que le token est valide');
  console.log('   - Que vous avez les permissions nécessaires');
  console.log('   - Les logs ci-dessus pour plus de détails\n');
  process.exit(1);
}


