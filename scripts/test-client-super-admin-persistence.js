/**
 * Script de test pour reproduire le problème de persistance du rôle client_super_admin
 * 
 * Étapes:
 * 1. Activer le statut super_admin pour un client
 * 2. Vérifier que le rôle est bien dans utilisateurs
 * 3. Simuler une reconnexion en vérifiant à nouveau
 * 4. Identifier pourquoi le rôle disparaît
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

async function testClientSuperAdminPersistence(clientEmail) {
  console.log('\n🧪 TEST DE PERSISTANCE CLIENT_SUPER_ADMIN\n');
  console.log('='.repeat(70));
  console.log(`📧 Email client: ${clientEmail}`);
  console.log('='.repeat(70));

  try {
    // ÉTAPE 1: Trouver le client
    console.log('\n📋 ÉTAPE 1: Recherche du client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, nom, prenom')
      .ilike('email', `%${clientEmail}%`)
      .maybeSingle();

    if (clientError || !client) {
      console.error('❌ Client non trouvé:', clientError?.message);
      return;
    }

    console.log(`✅ Client trouvé: ${client.nom} ${client.prenom} (${client.id})`);

    // ÉTAPE 2: Trouver l'espace membre et user_id
    console.log('\n📋 ÉTAPE 2: Recherche de l\'espace membre...');
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('id, user_id, client_id')
      .eq('client_id', client.id)
      .maybeSingle();

    if (espaceError || !espace) {
      console.error('❌ Espace membre non trouvé:', espaceError?.message);
      return;
    }

    console.log(`✅ Espace membre trouvé: ${espace.id}`);
    console.log(`✅ User ID: ${espace.user_id}`);

    // ÉTAPE 3: Vérifier le rôle ACTUEL dans utilisateurs
    console.log('\n📋 ÉTAPE 3: Vérification du rôle actuel dans utilisateurs...');
    const { data: utilisateur, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, email, role, created_at, updated_at')
      .eq('id', espace.user_id)
      .maybeSingle();

    if (userError) {
      console.error('❌ Erreur lecture utilisateurs:', userError.message);
      return;
    }

    if (!utilisateur) {
      console.log('⚠️ PAS D\'ENREGISTREMENT dans utilisateurs - création nécessaire');
    } else {
      console.log(`✅ Enregistrement trouvé dans utilisateurs:`);
      console.log(`   Rôle actuel: ${utilisateur.role}`);
      console.log(`   Email: ${utilisateur.email}`);
      console.log(`   Dernière modification: ${utilisateur.updated_at}`);
    }

    // ÉTAPE 4: Activer le statut super_admin
    console.log('\n📋 ÉTAPE 4: Activation du statut super_admin...');
    const { data: toggleResult, error: toggleError } = await supabase.rpc(
      'toggle_client_super_admin',
      {
        p_client_id: client.id,
        p_is_super_admin: true
      }
    );

    if (toggleError) {
      console.error('❌ Erreur activation super_admin:', toggleError.message);
      return;
    }

    console.log(`✅ Résultat toggle:`, JSON.stringify(toggleResult, null, 2));

    // ÉTAPE 5: Vérifier que le rôle est bien dans utilisateurs APRÈS activation
    console.log('\n📋 ÉTAPE 5: Vérification du rôle APRÈS activation...');
    const { data: utilisateurAfter, error: userAfterError } = await supabase
      .from('utilisateurs')
      .select('id, email, role, created_at, updated_at')
      .eq('id', espace.user_id)
      .maybeSingle();

    if (userAfterError) {
      console.error('❌ Erreur lecture utilisateurs:', userAfterError.message);
      return;
    }

    if (!utilisateurAfter) {
      console.error('❌ PROBLÈME: Pas d\'enregistrement dans utilisateurs après activation!');
      return;
    }

    console.log(`✅ Rôle après activation: ${utilisateurAfter.role}`);
    
    if (utilisateurAfter.role === 'client_super_admin') {
      console.log('✅ Le rôle client_super_admin est bien présent!');
    } else {
      console.error(`❌ PROBLÈME: Le rôle devrait être 'client_super_admin' mais il est '${utilisateurAfter.role}'`);
      return;
    }

    // ÉTAPE 6: Tester la fonction check_my_super_admin_status (nécessite connexion client)
    console.log('\n📋 ÉTAPE 6: Test de la fonction check_my_super_admin_status...');
    console.log('   (nécessite connexion en tant que client - skip pour l\'instant)');

    // ÉTAPE 7: Simuler une "reconnexion" en vérifiant à nouveau le rôle
    console.log('\n📋 ÉTAPE 7: Simulation reconnexion - Vérification du rôle...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde
    
    const { data: utilisateurReconnect, error: userReconnectError } = await supabase
      .from('utilisateurs')
      .select('id, email, role, created_at, updated_at')
      .eq('id', espace.user_id)
      .maybeSingle();

    if (userReconnectError) {
      console.error('❌ Erreur lecture utilisateurs:', userReconnectError.message);
      return;
    }

    if (!utilisateurReconnect) {
      console.error('❌ PROBLÈME: Pas d\'enregistrement dans utilisateurs après simulation reconnexion!');
      return;
    }

    console.log(`✅ Rôle après simulation reconnexion: ${utilisateurReconnect.role}`);
    
    if (utilisateurReconnect.role === 'client_super_admin') {
      console.log('✅✅✅ SUCCÈS: Le rôle persiste après simulation reconnexion!');
    } else {
      console.error(`❌❌❌ PROBLÈME: Le rôle a changé de 'client_super_admin' à '${utilisateurReconnect.role}'`);
      console.error('   ⚠️  Quelque chose a écrasé le rôle entre l\'activation et maintenant!');
      
      // Chercher ce qui pourrait avoir modifié le rôle
      console.log('\n🔍 Recherche des fonctions/triggers qui pourraient modifier le rôle...');
      console.log('   Vérifiez les logs de la base de données pour voir ce qui s\'est passé.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ DU TEST:');
    console.log('='.repeat(70));
    console.log(`Client ID: ${client.id}`);
    console.log(`User ID: ${espace.user_id}`);
    console.log(`Rôle avant activation: ${utilisateur?.role || 'NON DÉFINI'}`);
    console.log(`Rôle après activation: ${utilisateurAfter?.role || 'NON DÉFINI'}`);
    console.log(`Rôle après reconnexion: ${utilisateurReconnect?.role || 'NON DÉFINI'}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

const clientEmail = process.argv[2];

if (!clientEmail) {
  console.error('❌ Usage: node scripts/test-client-super-admin-persistence.js <email_client>');
  process.exit(1);
}

testClientSuperAdminPersistence(clientEmail);




