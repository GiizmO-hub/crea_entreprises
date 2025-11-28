/**
 * Script alternatif : Création d'utilisateur via signUp (méthode normale)
 * Puis confirmation via Admin API
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const email = 'meddecyril@icloud.com';
const password = '21052024_Aa!';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  👤 CRÉATION D\'UTILISATEUR (MÉTHODE ALTERNATIVE)');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

async function createUserAlternative() {
  try {
    // Méthode 1 : Créer via Admin API avec moins de paramètres
    console.log('1️⃣  Tentative avec Admin API simplifiée...');
    
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    if (!createError && userData?.user) {
      console.log('✅ UTILISATEUR CRÉÉ AVEC SUCCÈS !');
      console.log('');
      console.log('📋 Informations:');
      console.log('   → Email:', userData.user.email);
      console.log('   → ID:', userData.user.id);
      console.log('   → Email confirmé: ✅ Oui');
      console.log('');
      console.log('🎉 Vous pouvez maintenant vous connecter !');
      return;
    }
    
    // Si erreur, vérifier si c'est parce qu'il existe déjà
    if (createError?.message?.includes('already')) {
      console.log('⚠️  L\'utilisateur semble exister déjà.');
      console.log('');
      console.log('💡 Vérifions dans la liste des utilisateurs...');
      
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find(u => u.email === email);
      
      if (existing) {
        console.log('✅ Utilisateur trouvé dans la base !');
        console.log('   → Email:', existing.email);
        console.log('   → ID:', existing.id);
        console.log('   → Email confirmé:', existing.email_confirmed_at ? '✅ Oui' : '❌ Non');
        console.log('');
        console.log('🎉 Vous pouvez vous connecter avec ces identifiants !');
        
        // Si l'email n'est pas confirmé, le confirmer
        if (!existing.email_confirmed_at) {
          console.log('');
          console.log('2️⃣  Confirmation de l\'email...');
          const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
            email_confirm: true
          });
          
          if (!updateError) {
            console.log('✅ Email confirmé avec succès !');
          }
        }
        
        // Mettre à jour le mot de passe si nécessaire
        console.log('');
        console.log('3️⃣  Mise à jour du mot de passe...');
        const { error: pwdError } = await supabase.auth.admin.updateUserById(existing.id, {
          password: password
        });
        
        if (!pwdError) {
          console.log('✅ Mot de passe mis à jour !');
        } else {
          console.log('⚠️  Erreur mise à jour mot de passe:', pwdError.message);
        }
      }
    } else {
      console.error('❌ Erreur lors de la création:', createError?.message || 'Erreur inconnue');
      console.log('');
      console.log('💡 Solution alternative:');
      console.log('   → Créez l\'utilisateur via Supabase Dashboard');
      console.log('   → Authentication → Users → Add user');
    }
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
  }
}

createUserAlternative();

