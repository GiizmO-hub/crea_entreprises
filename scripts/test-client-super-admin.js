/**
 * Script de test pour vérifier le statut client_super_admin
 * 
 * Usage: node scripts/test-client-super-admin.js <client_email>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testClientSuperAdmin(clientEmail) {
  console.log('🔍 Test du statut client_super_admin pour:', clientEmail);
  console.log('');

  try {
    // 1. Authentifier comme le client
    console.log('1️⃣ Authentification du client...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: clientEmail,
      password: prompt('Mot de passe du client: ') || 'Test123!',
    });

    if (authError) {
      console.error('❌ Erreur d\'authentification:', authError.message);
      return;
    }

    console.log('✅ Authentifié avec succès');
    console.log('   User ID:', authData.user.id);
    console.log('');

    // 2. Vérifier le rôle dans utilisateurs
    console.log('2️⃣ Vérification du rôle dans utilisateurs...');
    const { data: utilisateur, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, email, role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (userError) {
      console.error('❌ Erreur lecture utilisateurs:', userError.message);
    } else if (utilisateur) {
      console.log('✅ Rôle dans utilisateurs:', utilisateur.role);
      console.log('   Email:', utilisateur.email);
      if (utilisateur.role === 'client_super_admin') {
        console.log('   ✅ C\'est bien un client_super_admin!');
      } else {
        console.log('   ⚠️ Ce n\'est PAS un client_super_admin (rôle:', utilisateur.role + ')');
      }
    } else {
      console.log('⚠️ Pas d\'entrée dans utilisateurs');
    }
    console.log('');

    // 3. Vérifier l'espace membre
    console.log('3️⃣ Vérification de l\'espace membre...');
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, client_id, entreprise_id, actif')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (espaceError) {
      console.error('❌ Erreur lecture espace membre:', espaceError.message);
    } else if (espace) {
      console.log('✅ Espace membre trouvé');
      console.log('   Client ID:', espace.client_id);
      console.log('   Entreprise ID:', espace.entreprise_id);
      console.log('   Actif:', espace.actif);
    } else {
      console.log('⚠️ Pas d\'espace membre trouvé');
    }
    console.log('');

    // 4. Tester la fonction RPC check_my_super_admin_status
    console.log('4️⃣ Test de la fonction RPC check_my_super_admin_status...');
    const { data: isSuperAdmin, error: rpcError } = await supabase.rpc('check_my_super_admin_status');

    if (rpcError) {
      console.error('❌ Erreur RPC:', rpcError.message);
      console.error('   Code:', rpcError.code);
      console.error('   Details:', rpcError.details);
    } else {
      console.log('✅ Résultat RPC:', isSuperAdmin);
      if (isSuperAdmin === true) {
        console.log('   ✅ Le client EST détecté comme super_admin de son espace');
      } else {
        console.log('   ⚠️ Le client N\'EST PAS détecté comme super_admin de son espace');
      }
    }
    console.log('');

    // 5. Résumé
    console.log('📋 RÉSUMÉ:');
    console.log('   Rôle dans utilisateurs:', utilisateur?.role || 'N/A');
    console.log('   Résultat RPC:', isSuperAdmin === true ? '✅ OUI' : '❌ NON');
    console.log('   Espace membre:', espace ? '✅ OUI' : '❌ NON');
    
    if (utilisateur?.role === 'client_super_admin' && isSuperAdmin === true) {
      console.log('');
      console.log('✅ SUCCÈS: Le client est bien configuré comme client_super_admin!');
    } else {
      console.log('');
      console.log('⚠️ PROBLÈME: Le client n\'est pas correctement configuré.');
      if (utilisateur?.role !== 'client_super_admin') {
        console.log('   -> Le rôle devrait être "client_super_admin" mais c\'est:', utilisateur?.role || 'N/A');
      }
      if (isSuperAdmin !== true) {
        console.log('   -> La fonction RPC devrait retourner true mais retourne:', isSuperAdmin);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer l'email du client depuis les arguments de ligne de commande
const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/test-client-super-admin.js <client_email>');
  console.log('');
  console.log('Exemple:');
  console.log('  node scripts/test-client-super-admin.js client@example.com');
  process.exit(1);
}

testClientSuperAdmin(clientEmail);

