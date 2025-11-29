import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userEmail = 'groupemclem@gmail.com';

console.log(`\n🔍 Vérification du rôle pour: ${userEmail}\n`);

async function checkUserRole() {
  try {
    // 1. Trouver l'utilisateur par email
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erreur liste users:', usersError);
      return;
    }
    
    const user = users.users.find(u => u.email === userEmail);
    
    if (!user) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé`);
      return;
    }
    
    console.log(`✅ Utilisateur trouvé: ${user.id}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`\n📋 raw_user_meta_data:`, JSON.stringify(user.user_metadata, null, 2));
    console.log(`📋 raw_app_meta_data:`, JSON.stringify(user.app_metadata, null, 2));
    
    const role = user.user_metadata?.role || user.app_metadata?.role;
    console.log(`\n🎭 Rôle détecté: ${role || 'AUCUN'}`);
    
    // 2. Vérifier dans la table utilisateurs
    const { data: utilisateur, error: utilisateurError } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (utilisateurError) {
      console.error('❌ Erreur lecture utilisateurs:', utilisateurError);
    } else if (utilisateur) {
      console.log(`\n📊 Dans table utilisateurs:`);
      console.log(`   - ID: ${utilisateur.id}`);
      console.log(`   - Email: ${utilisateur.email}`);
      console.log(`   - Rôle: ${utilisateur.role || 'AUCUN'}`);
    } else {
      console.log(`\n⚠️ Pas d'entrée dans table utilisateurs`);
    }
    
    // 3. Vérifier espace membre client
    const { data: espaceClient, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('*, entreprises(nom)')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (espaceError) {
      console.error('❌ Erreur lecture espace client:', espaceError);
    } else if (espaceClient) {
      console.log(`\n👤 Espace membre client trouvé:`);
      console.log(`   - ID: ${espaceClient.id}`);
      console.log(`   - Entreprise: ${espaceClient.entreprises?.nom || 'N/A'}`);
      console.log(`   - Entreprise ID: ${espaceClient.entreprise_id}`);
    } else {
      console.log(`\n✅ Pas d'espace membre client (normal pour Super Admin plateforme)`);
    }
    
    // 4. Tester la fonction is_platform_super_admin
    console.log(`\n🧪 Test de is_platform_super_admin()...`);
    
    // Pour tester en tant qu'admin, on doit utiliser un token utilisateur
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });
    
    if (authError) {
      console.error('❌ Erreur génération lien:', authError);
    } else {
      console.log('✅ Lien généré (mais fonction RPC nécessite session utilisateur)');
    }
    
    // 5. Compter les entreprises
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (entreprisesError) {
      console.error('❌ Erreur lecture entreprises:', entreprisesError);
    } else {
      console.log(`\n📦 Entreprises dans la base (10 premières):`);
      if (entreprises && entreprises.length > 0) {
        entreprises.forEach((e, i) => {
          console.log(`   ${i + 1}. ${e.nom} (ID: ${e.id}, User: ${e.user_id})`);
        });
      } else {
        console.log(`   ⚠️ Aucune entreprise trouvée`);
      }
    }
    
    // Résumé
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 RÉSUMÉ:`);
    console.log(`   - Rôle dans auth.users: ${role || 'AUCUN'}`);
    console.log(`   - Rôle dans utilisateurs: ${utilisateur?.role || 'N/A'}`);
    console.log(`   - A un espace client: ${espaceClient ? 'OUI' : 'NON'}`);
    console.log(`   - Nombre d'entreprises: ${entreprises?.length || 0}`);
    console.log(`\n💡 POUR ÊTRE SUPER ADMIN PLATEFORME:`);
    console.log(`   Le rôle doit être "super_admin" dans auth.users.raw_user_meta_data->>'role'`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

checkUserRole();

