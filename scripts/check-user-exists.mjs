/**
 * Script pour vérifier si un utilisateur existe dans Supabase
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
  process.exit(1);
}

// Utiliser la service role key pour avoir accès à tous les utilisateurs
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node scripts/check-user-exists.mjs <email>');
  process.exit(1);
}

console.log('');
console.log('🔍 Recherche de l\'utilisateur:', email);
console.log('');

async function checkUser() {
  try {
    // Lister tous les utilisateurs (nécessite service role key)
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    // Chercher l'utilisateur par email
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ Utilisateur NON TROUVÉ');
      console.log('');
      console.log('💡 SOLUTIONS:');
      console.log('   1. Créez un compte via la page d\'inscription');
      console.log('   2. Ou créez l\'utilisateur dans Supabase Dashboard');
      console.log('');
      console.log('📧 Total d\'utilisateurs dans Supabase:', users.length);
      return;
    }
    
    console.log('✅ Utilisateur TROUVÉ !');
    console.log('');
    console.log('📋 Informations:');
    console.log('   → Email:', user.email);
    console.log('   → ID:', user.id);
    console.log('   → Créé le:', new Date(user.created_at).toLocaleString());
    console.log('   → Email confirmé:', user.email_confirmed_at ? '✅ Oui' : '❌ Non');
    console.log('   → Dernière connexion:', user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Jamais');
    console.log('');
    
    if (!user.email_confirmed_at) {
      console.log('⚠️  ATTENTION: Email non confirmé !');
      console.log('   → Cela peut empêcher la connexion');
      console.log('   → Vérifiez votre boîte mail pour le lien de confirmation');
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

checkUser();

