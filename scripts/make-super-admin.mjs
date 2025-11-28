/**
 * Script pour donner les droits super_admin à un utilisateur
 * et le protéger contre la suppression
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'meddecyril@icloud.com';
const userId = 'a20797f9-3578-4a3b-83aa-967d78fd62b4';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  👑 ATTRIBUTION DES DROITS SUPER_ADMIN');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📧 Email:', email);
console.log('🆔 User ID:', userId);
console.log('');

async function makeSuperAdmin() {
  try {
    console.log('1️⃣  Recherche de l\'utilisateur dans auth.users...');
    
    // Vérifier que l'utilisateur existe
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erreur lors de la recherche:', listError.message);
      return;
    }
    
    const user = users.find(u => u.email === email || u.id === userId);
    
    if (!user) {
      console.error('❌ Utilisateur non trouvé !');
      return;
    }
    
    console.log('✅ Utilisateur trouvé:', user.email);
    console.log('   ID:', user.id);
    console.log('');
    
    const actualUserId = user.id;
    
    // Étape 1: Mettre à jour les métadonnées dans auth.users
    console.log('2️⃣  Mise à jour des métadonnées dans auth.users...');
    
    const { error: metadataError } = await supabase.auth.admin.updateUserById(actualUserId, {
      user_metadata: {
        role: 'super_admin',
        is_platform_super_admin: true,
        is_protected: true, // Protection contre suppression
        is_creator: true // Marquer comme créateur de l'application
      },
      app_metadata: {
        role: 'super_admin',
        is_platform_super_admin: true,
        is_protected: true
      }
    });
    
    if (metadataError) {
      console.error('❌ Erreur mise à jour métadonnées:', metadataError.message);
    } else {
      console.log('✅ Métadonnées mises à jour dans auth.users');
    }
    
    console.log('');
    
    // Étape 2: Créer/mettre à jour l'utilisateur dans la table utilisateurs
    console.log('3️⃣  Vérification de la table utilisateurs...');
    
    // Vérifier si la table utilisateurs existe et si l'utilisateur y est
    const { data: existingUser, error: selectError } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('id', actualUserId)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = table doesn't exist
      console.error('❌ Erreur vérification table utilisateurs:', selectError.message);
      console.log('   → La table utilisateurs n\'existe peut-être pas');
    } else if (existingUser) {
      console.log('✅ Utilisateur trouvé dans la table utilisateurs');
      console.log('   Rôle actuel:', existingUser.role || 'non défini');
      console.log('');
      
      console.log('4️⃣  Mise à jour du rôle dans utilisateurs...');
      
      const { error: updateError } = await supabase
        .from('utilisateurs')
        .update({
          role: 'super_admin',
          statut: 'active'
        })
        .eq('id', actualUserId);
      
      if (updateError) {
        console.error('❌ Erreur mise à jour rôle:', updateError.message);
      } else {
        console.log('✅ Rôle mis à jour dans utilisateurs → super_admin');
      }
    } else {
      console.log('⚠️  Utilisateur non trouvé dans utilisateurs');
      console.log('   → Tentative de création...');
      
      const { error: insertError } = await supabase
        .from('utilisateurs')
        .insert({
          id: actualUserId,
          email: email,
          role: 'super_admin',
          statut: 'active',
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('❌ Erreur création utilisateur:', insertError.message);
        console.log('   → La table utilisateurs a peut-être une structure différente');
      } else {
        console.log('✅ Utilisateur créé dans utilisateurs avec rôle super_admin');
      }
    }
    
    console.log('');
    
    // Résumé final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ ATTRIBUTION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 RÉSUMÉ:');
    console.log('   → Utilisateur:', email);
    console.log('   → Rôle: super_admin');
    console.log('   → Protection: Activée');
    console.log('   → Créateur: Oui');
    console.log('');
    console.log('🎉 Vous avez maintenant tous les droits super_admin !');
    console.log('');
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    console.error('   Stack:', err.stack);
  }
}

makeSuperAdmin();

