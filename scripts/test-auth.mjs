/**
 * Script de test et diagnostic de l'authentification
 * Vérifie si un utilisateur peut se connecter avec ses identifiants
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Charger les variables d'environnement
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔐 DIAGNOSTIC D\'AUTHENTIFICATION');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📍 URL Supabase:', supabaseUrl.substring(0, 30) + '...');
console.log('');

// Demander les identifiants à l'utilisateur
const args = process.argv.slice(2);
let email = args[0];
let password = args[1];

if (!email || !password) {
  console.log('💡 Usage: node scripts/test-auth.mjs <email> <password>');
  console.log('');
  console.log('Ou entrez vos identifiants maintenant :');
  console.log('');
  process.exit(1);
}

console.log('🔐 Tentative de connexion pour:', email);
console.log('');

// Test 1: Vérifier si l'utilisateur existe
async function testAuth() {
  try {
    console.log('1️⃣  Test de connexion avec les identifiants fournis...');
    console.log('');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('❌ ERREUR DE CONNEXION:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.status || 'N/A');
      console.error('');
      
      // Messages d'aide selon le type d'erreur
      if (error.message.includes('Invalid login credentials')) {
        console.log('💡 SOLUTIONS POSSIBLES:');
        console.log('');
        console.log('   1. Vérifiez que l\'email est correct');
        console.log('   2. Vérifiez que le mot de passe est correct');
        console.log('   3. L\'utilisateur n\'existe peut-être pas dans Supabase');
        console.log('');
        console.log('   → Pour créer un compte, utilisez la page d\'inscription');
        console.log('   → Ou créez l\'utilisateur dans Supabase Dashboard → Authentication → Users');
      } else if (error.message.includes('Email not confirmed')) {
        console.log('💡 Votre email n\'a pas été confirmé');
        console.log('   → Vérifiez votre boîte mail pour le lien de confirmation');
      } else if (error.message.includes('Too many requests')) {
        console.log('💡 Trop de tentatives de connexion');
        console.log('   → Attendez quelques minutes avant de réessayer');
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
      console.log('');
      
      // Vérifier la session
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        console.log('✅ Session active créée');
      }
      
      // Déconnexion
      await supabase.auth.signOut();
      console.log('🔄 Déconnexion effectuée');
    }
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    console.error('   Stack:', err.stack);
  }
}

// Lancer le test
testAuth();

