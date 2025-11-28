/**
 * Script pour créer un utilisateur directement dans Supabase
 * Utilise l'API Admin de Supabase (nécessite SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  console.error('');
  console.error('💡 Pour obtenir la SERVICE_ROLE_KEY:');
  console.error('   1. Allez sur https://supabase.com/dashboard');
  console.error('   2. Sélectionnez votre projet');
  console.error('   3. Allez dans Settings → API');
  console.error('   4. Copiez la "service_role" key (pas la "anon" key)');
  console.error('   5. Ajoutez-la dans votre .env : SUPABASE_SERVICE_ROLE_KEY=...');
  process.exit(1);
}

// Utiliser la service role key pour avoir les droits admin
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'meddecyril@icloud.com';
const password = '21052024_Aa!';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  👤 CRÉATION D\'UTILISATEUR DIRECTE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📧 Email:', email);
console.log('🔐 Mot de passe: ********');
console.log('');

async function createUser() {
  try {
    console.log('1️⃣  Vérification si l\'utilisateur existe déjà...');
    
    // Vérifier si l'utilisateur existe déjà
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erreur lors de la vérification:', listError.message);
      return;
    }
    
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
      console.log('⚠️  L\'utilisateur existe déjà !');
      console.log('');
      console.log('📋 Informations existantes:');
      console.log('   → Email:', existingUser.email);
      console.log('   → ID:', existingUser.id);
      console.log('   → Créé le:', new Date(existingUser.created_at).toLocaleString());
      console.log('   → Email confirmé:', existingUser.email_confirmed_at ? '✅ Oui' : '❌ Non');
      console.log('');
      
      // Proposer de mettre à jour le mot de passe
      console.log('💡 Voulez-vous mettre à jour le mot de passe ?');
      console.log('   → Utilisez Supabase Dashboard → Authentication → Users');
      console.log('   → Trouvez l\'utilisateur → 3 points → "Reset password"');
      return;
    }
    
    console.log('✅ L\'utilisateur n\'existe pas, création...');
    console.log('');
    
    console.log('2️⃣  Création de l\'utilisateur...');
    
    // Créer l'utilisateur avec auto-confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmer l'email
      user_metadata: {
        role: 'user' // Rôle par défaut
      }
    });
    
    if (error) {
      console.error('❌ ERREUR lors de la création:', error.message);
      console.error('   Code:', error.status || error.code || 'N/A');
      console.error('');
      
      // Détails de l'erreur
      if (error.message) {
        console.error('   Message complet:', error.message);
      }
      
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        console.log('💡 L\'utilisateur existe déjà.');
        console.log('   → Essayez de vous connecter directement');
      } else if (error.message?.includes('Password')) {
        console.log('💡 Erreur de mot de passe. Vérifiez qu\'il respecte les exigences:');
        console.log('   → Minimum 6 caractères');
      } else if (error.message?.includes('Database error')) {
        console.log('💡 Erreur de base de données.');
        console.log('   → Cela peut être dû à un problème de connexion ou de structure DB');
        console.log('   → Recommandation: Créez l\'utilisateur via Supabase Dashboard');
        console.log('   → Dashboard → Authentication → Users → Add user');
      }
      return;
    }
    
    if (data?.user) {
      console.log('✅ UTILISATEUR CRÉÉ AVEC SUCCÈS !');
      console.log('');
      console.log('📋 Informations créées:');
      console.log('   → Email:', data.user.email);
      console.log('   → ID:', data.user.id);
      console.log('   → Créé le:', new Date(data.user.created_at).toLocaleString());
      console.log('   → Email confirmé: ✅ Oui (auto-confirmé)');
      console.log('');
      console.log('🎉 Vous pouvez maintenant vous connecter avec:');
      console.log('   → Email: meddecyril@icloud.com');
      console.log('   → Mot de passe: 21052024_Aa!');
      console.log('');
    }
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    console.error('   Stack:', err.stack);
  }
}

createUser();

