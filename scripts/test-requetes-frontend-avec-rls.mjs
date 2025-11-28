import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

// Créer un client avec ANON KEY (comme le frontend)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Créer un client avec SERVICE KEY pour obtenir le token de l'utilisateur
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testRequetes() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 TEST DES REQUÊTES FRONTEND AVEC RLS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Se connecter avec votre compte pour obtenir un token JWT
  console.log('1️⃣ CONNEXION AVEC VOTRE COMPTE');
  console.log('─────────────────────────────────────────────────────────────');
  
  const email = 'meddecyril@icloud.com';
  const password = '21052024_Aa!'; // À adapter si nécessaire
  
  const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Erreur de connexion:', authError.message);
    console.log('\n⚠️  Impossible de tester avec votre compte');
    console.log('   Testons directement avec service role pour voir les données...\n');
    
    // Test avec service role
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('📊 Test avec SERVICE ROLE (contourne RLS) :\n');
    
    const { data: entreprises, error: eError } = await supabaseService
      .from('entreprises')
      .select('id, nom')
      .limit(10);
    
    console.log(`✅ Entreprises: ${entreprises?.length || 0}`);
    if (entreprises) {
      entreprises.forEach(e => console.log(`   - ${e.nom}`));
    }
    
    const { data: clients, error: cError } = await supabaseService
      .from('clients')
      .select('id, nom, email')
      .limit(10);
    
    console.log(`\n✅ Clients: ${clients?.length || 0}`);
    if (clients) {
      clients.forEach(c => console.log(`   - ${c.nom} ${c.email}`));
    }
    
    return;
  }

  if (!authData?.session) {
    console.error('❌ Aucune session créée');
    return;
  }

  console.log('✅ Connexion réussie !');
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email: ${authData.user.email}`);
  console.log(`   Rôle: ${authData.user.user_metadata?.role || 'NON DÉFINI'}\n`);

  // 2. Tester les requêtes avec le token JWT (comme le frontend)
  console.log('2️⃣ TEST DES REQUÊTES AVEC VOTRE TOKEN JWT');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('   (Les RLS policies devraient filtrer automatiquement)\n');

  // Test entreprises
  const { data: entreprises, error: entreprisesError } = await supabaseAnon
    .from('entreprises')
    .select('id, nom, user_id')
    .limit(10);

  if (entreprisesError) {
    console.error(`❌ Erreur entreprises: ${entreprisesError.message}`);
    console.error(`   Code: ${entreprisesError.code}`);
    console.error(`   Détails: ${entreprisesError.details}`);
  } else {
    console.log(`✅ Entreprises accessibles: ${entreprises?.length || 0}`);
    if (entreprises && entreprises.length > 0) {
      entreprises.slice(0, 5).forEach(e => {
        console.log(`   - ${e.nom} (${e.id.substring(0, 8)}...)`);
      });
    } else {
      console.log(`   ⚠️  Aucune entreprise trouvée (RLS bloque peut-être)`);
    }
  }

  // Test clients
  const { data: clients, error: clientsError } = await supabaseAnon
    .from('clients')
    .select('id, nom, email, entreprise_id')
    .limit(10);

  if (clientsError) {
    console.error(`❌ Erreur clients: ${clientsError.message}`);
  } else {
    console.log(`\n✅ Clients accessibles: ${clients?.length || 0}`);
    if (clients && clients.length > 0) {
      clients.slice(0, 5).forEach(c => {
        console.log(`   - ${c.nom} (${c.email})`);
      });
    } else {
      console.log(`   ⚠️  Aucun client trouvé (RLS bloque peut-être)`);
    }
  }

  // Test factures
  const { data: factures, error: facturesError } = await supabaseAnon
    .from('factures')
    .select('id, numero, entreprise_id')
    .limit(10);

  if (facturesError) {
    console.error(`❌ Erreur factures: ${facturesError.message}`);
  } else {
    console.log(`\n✅ Factures accessibles: ${factures?.length || 0}`);
    if (factures && factures.length > 0) {
      factures.slice(0, 5).forEach(f => {
        console.log(`   - ${f.numero}`);
      });
    } else {
      console.log(`   ⚠️  Aucune facture trouvée (RLS bloque peut-être)`);
    }
  }

  // Test abonnements
  const { data: abonnements, error: abonnementsError } = await supabaseAnon
    .from('abonnements')
    .select('id, plan_id, entreprise_id')
    .limit(10);

  if (abonnementsError) {
    console.error(`❌ Erreur abonnements: ${abonnementsError.message}`);
  } else {
    console.log(`\n✅ Abonnements accessibles: ${abonnements?.length || 0}`);
    if (abonnements && abonnements.length > 0) {
      abonnements.slice(0, 5).forEach(a => {
        console.log(`   - Plan: ${a.plan_id}`);
      });
    } else {
      console.log(`   ⚠️  Aucun abonnement trouvé (RLS bloque peut-être)`);
    }
  }

  // 3. Tester is_platform_super_admin() avec votre token
  console.log('\n3️⃣ TEST DE is_platform_super_admin() AVEC VOTRE TOKEN');
  console.log('─────────────────────────────────────────────────────────────');

  const { data: isSuperAdmin, error: rpcError } = await supabaseAnon.rpc('is_platform_super_admin');

  if (rpcError) {
    console.error(`❌ Erreur RPC: ${rpcError.message}`);
  } else {
    console.log(`✅ is_platform_super_admin() = ${isSuperAdmin}`);
    if (isSuperAdmin) {
      console.log(`   ✅ Vous devriez voir TOUTES les données`);
    } else {
      console.log(`   ⚠️  Vous n'êtes pas détecté comme super_admin PLATEFORME`);
      console.log(`   → Vérifiez votre rôle dans auth.users.raw_user_meta_data->>'role'`);
    }
  }

  console.log('\n✅ Tests terminés !\n');
}

testRequetes().catch(console.error);

