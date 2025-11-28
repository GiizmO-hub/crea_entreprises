/**
 * Script simple de test de connexion sans SERVICE_ROLE_KEY
 * Utilise uniquement la clé anonyme
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'meddecyril@icloud.com';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔐 TEST DE CONNEXION');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📧 Email:', email);
console.log('');

console.log('💡 Pour tester la connexion, vous devez fournir le mot de passe.');
console.log('');
console.log('Usage:');
console.log('  node scripts/test-connexion-simple.mjs <mot_de_passe>');
console.log('');
console.log('Ou testez directement dans l\'application et regardez les logs dans la console du navigateur (F12).');
console.log('');

const password = process.argv[2];

if (!password) {
  console.log('⚠️  Aucun mot de passe fourni.');
  console.log('');
  console.log('📋 PROCHAINES ÉTAPES:');
  console.log('');
  console.log('1. Essayez de vous connecter dans l\'application');
  console.log('2. Ouvrez la console du navigateur (F12)');
  console.log('3. Regardez les messages qui s\'affichent:');
  console.log('   → "🔐 Tentative de connexion pour: meddecyril@icloud.com"');
  console.log('   → "❌ Erreur connexion: ..." ou "✅ Connexion réussie"');
  console.log('');
  console.log('4. Partagez-moi le message d\'erreur exact');
  process.exit(0);
}

console.log('🔐 Tentative de connexion...');
console.log('');

async function testConnection() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('❌ ERREUR DE CONNEXION:');
      console.error('   Message:', error.message);
      console.error('');
      
      if (error.message.includes('Invalid login credentials')) {
        console.log('💡 SOLUTIONS POSSIBLES:');
        console.log('');
        console.log('   1. Vérifiez que le mot de passe est correct');
        console.log('   2. L\'utilisateur n\'existe peut-être pas dans Supabase');
        console.log('');
        console.log('   → Pour créer un compte, utilisez la page d\'inscription');
        console.log('   → Ou créez l\'utilisateur dans Supabase Dashboard');
      }
      return;
    }

    if (data?.user) {
      console.log('✅ CONNEXION RÉUSSIE !');
      console.log('');
      console.log('📋 Informations utilisateur:');
      console.log('   → Email:', data.user.email);
      console.log('   → ID:', data.user.id);
      console.log('   → Créé le:', new Date(data.user.created_at).toLocaleString());
      console.log('');
      console.log('🎉 L\'authentification fonctionne correctement !');
      
      await supabase.auth.signOut();
      console.log('🔄 Déconnexion effectuée');
    }
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
  }
}

testConnection();

