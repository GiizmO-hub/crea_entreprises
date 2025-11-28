/**
 * Script pour déboguer le statut client_super_admin
 * Affiche comment le statut est stocké et récupéré
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugClientSuperAdmin(clientEmail) {
  console.log('\n🔍 DEBUG STATUT CLIENT_SUPER_ADMIN\n');
  console.log('='.repeat(70));
  console.log(`📧 Email client: ${clientEmail}`);
  console.log('='.repeat(70));

  try {
    // 1. Trouver le client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, nom, prenom')
      .ilike('email', `%${clientEmail}%`)
      .maybeSingle();

    if (clientError || !client) {
      console.error('❌ Client non trouvé:', clientError?.message);
      return;
    }

    console.log(`\n✅ Client trouvé:`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Nom: ${client.nom} ${client.prenom}`);

    // 2. Trouver l'espace membre
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, user_id, client_id')
      .eq('client_id', client.id)
      .maybeSingle();

    if (espaceError || !espace) {
      console.error('❌ Espace membre non trouvé:', espaceError?.message);
      return;
    }

    console.log(`\n✅ Espace membre trouvé:`);
    console.log(`   ID: ${espace.id}`);
    console.log(`   User ID: ${espace.user_id}`);

    // 3. Vérifier dans utilisateurs
    if (espace.user_id) {
      const { data: utilisateur, error: userError } = await supabase
        .from('utilisateurs')
        .select('id, email, role, created_at, updated_at')
        .eq('id', espace.user_id)
        .maybeSingle();

      if (userError) {
        console.error('❌ Erreur lecture utilisateurs:', userError.message);
      } else if (!utilisateur) {
        console.log('\n⚠️ PAS D\'ENREGISTREMENT DANS utilisateurs');
        console.log('   C\'est probablement le problème !');
      } else {
        console.log(`\n✅ Enregistrement dans utilisateurs:`);
        console.log(`   ID: ${utilisateur.id}`);
        console.log(`   Email: ${utilisateur.email}`);
        console.log(`   Rôle: ${utilisateur.role}`);
        console.log(`   Créé: ${utilisateur.created_at}`);
        console.log(`   Modifié: ${utilisateur.updated_at}`);
        console.log(`\n   🔍 Statut client_super_admin: ${utilisateur.role === 'client_super_admin' ? '✅ OUI' : '❌ NON'}`);
      }
    }

    // 4. Vérifier dans auth.users
    if (espace.user_id) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(espace.user_id);
      
      if (authError) {
        console.log('\n⚠️ Impossible de lire auth.users (besoin service_role_key)');
      } else if (authUser?.user) {
        console.log(`\n✅ Utilisateur auth.users:`);
        console.log(`   ID: ${authUser.user.id}`);
        console.log(`   Email: ${authUser.user.email}`);
        console.log(`   Metadata role: ${authUser.user.user_metadata?.role || 'NON DÉFINI'}`);
      }
    }

    // 5. Tester la fonction RPC
    console.log('\n🔍 Test fonction RPC check_my_super_admin_status...');
    console.log('   (nécessite connexion en tant que client)');

    console.log('\n' + '='.repeat(70));
    console.log('📋 RÉSUMÉ:');
    console.log('='.repeat(70));
    console.log('Le statut client_super_admin est stocké dans:');
    console.log('  ✅ Table: utilisateurs');
    console.log('  ✅ Colonne: role');
    console.log('  ✅ Valeur: "client_super_admin"');
    console.log('\nSi l\'enregistrement n\'existe pas dans utilisateurs,');
    console.log('le statut ne peut pas persister !');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/debug-client-super-admin.js <email_client>');
  process.exit(1);
}

debugClientSuperAdmin(clientEmail);




