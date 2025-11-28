import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifierEtCorriger() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION ET CORRECTION DE VOTRE RÔLE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Vérifier votre compte
  console.log('1️⃣ VÉRIFICATION DE VOTRE COMPTE');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Erreur:', usersError);
    return;
  }

  const votreCompte = users.users.find(u => u.email === 'meddecyril@icloud.com');
  
  if (!votreCompte) {
    console.error('❌ Compte meddecyril@icloud.com non trouvé !');
    return;
  }

  console.log(`✅ Email: ${votreCompte.email}`);
  console.log(`✅ ID: ${votreCompte.id}`);
  const roleActuel = votreCompte.user_metadata?.role;
  console.log(`📋 Rôle actuel: ${roleActuel || 'NON DÉFINI'}`);

  // 2. Vérifier si c'est super_admin
  if (roleActuel === 'super_admin') {
    console.log(`\n✅ Vous êtes déjà super_admin PLATEFORME !`);
    console.log(`   Les RLS policies devraient permettre l'accès à toutes les données.`);
  } else {
    console.log(`\n⚠️  Votre rôle n'est PAS 'super_admin'`);
    console.log(`   Rôle actuel: ${roleActuel || 'AUCUN'}`);
    console.log(`\n🔧 Correction du rôle...`);
    
    // Mettre à jour le rôle
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      votreCompte.id,
      {
        user_metadata: {
          ...votreCompte.user_metadata,
          role: 'super_admin'
        }
      }
    );

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour: ${updateError.message}`);
    } else {
      console.log(`✅ Rôle mis à jour avec succès !`);
      console.log(`   Nouveau rôle: ${updatedUser.user.user_metadata?.role}`);
    }
  }

  // 3. Vérifier aussi dans la table utilisateurs
  console.log('\n2️⃣ VÉRIFICATION DANS LA TABLE utilisateurs');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: utilisateur, error: utilisateurError } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('id', votreCompte.id)
    .maybeSingle();

  if (utilisateurError) {
    console.log(`⚠️  Erreur lors de la lecture: ${utilisateurError.message}`);
  } else if (utilisateur) {
    console.log(`✅ Entrée trouvée dans utilisateurs`);
    console.log(`   Rôle: ${utilisateur.role || 'NON DÉFINI'}`);
    console.log(`   Is protected: ${utilisateur.is_protected || false}`);
    
    if (utilisateur.role !== 'super_admin') {
      console.log(`\n🔧 Mise à jour du rôle dans utilisateurs...`);
      const { error: updateUtilError } = await supabase
        .from('utilisateurs')
        .update({ 
          role: 'super_admin',
          is_protected: true
        })
        .eq('id', votreCompte.id);

      if (updateUtilError) {
        console.error(`❌ Erreur mise à jour utilisateurs: ${updateUtilError.message}`);
      } else {
        console.log(`✅ Rôle mis à jour dans utilisateurs !`);
      }
    }
  } else {
    console.log(`⚠️  Aucune entrée dans utilisateurs, création...`);
    const { error: insertError } = await supabase
      .from('utilisateurs')
      .insert({
        id: votreCompte.id,
        email: votreCompte.email,
        role: 'super_admin',
        is_protected: true,
        is_creator: true
      });

    if (insertError) {
      console.error(`❌ Erreur création utilisateur: ${insertError.message}`);
    } else {
      console.log(`✅ Entrée créée dans utilisateurs !`);
    }
  }

  // 4. Vérifier les requêtes maintenant
  console.log('\n3️⃣ TEST DES REQUÊTES APRÈS CORRECTION');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('   (Note: Utilise service role, test réel nécessite re-connexion)\n');

  const { count: countEntreprises } = await supabase
    .from('entreprises')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Entreprises disponibles: ${countEntreprises || 0}`);

  const { count: countClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Clients disponibles: ${countClients || 0}`);

  const { count: countFactures } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Factures disponibles: ${countFactures || 0}`);

  const { count: countAbonnements } = await supabase
    .from('abonnements')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Abonnements disponibles: ${countAbonnements || 0}`);

  console.log('\n✅ Vérification terminée !\n');
  console.log('📋 PROCHAINES ÉTAPES :');
  console.log('   1. Déconnectez-vous de l\'application');
  console.log('   2. Reconnectez-vous pour recharger les métadonnées');
  console.log('   3. Les données devraient maintenant s\'afficher');
  console.log('');
}

verifierEtCorriger().catch(console.error);

