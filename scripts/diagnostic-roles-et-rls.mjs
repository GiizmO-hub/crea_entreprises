import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnostic() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC RÔLES ET RLS POLICIES');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Vérifier votre compte
  console.log('1️⃣ VÉRIFICATION DE VOTRE COMPTE');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Erreur récupération utilisateurs:', usersError);
    return;
  }

  const votreCompte = users.users.find(u => u.email === 'meddecyril@icloud.com');
  
  if (!votreCompte) {
    console.error('❌ Compte meddecyril@icloud.com non trouvé !');
    return;
  }

  console.log('✅ Votre compte trouvé:');
  console.log(`   ID: ${votreCompte.id}`);
  console.log(`   Email: ${votreCompte.email}`);
  console.log(`   Role dans raw_user_meta_data: ${votreCompte.user_metadata?.role || 'NON DÉFINI'}`);
  console.log(`   Raw user meta data:`, JSON.stringify(votreCompte.user_metadata, null, 2));

  // 2. Tester is_platform_super_admin()
  console.log('\n2️⃣ TEST DE is_platform_super_admin()');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc('is_platform_super_admin');
  
  if (rpcError) {
    console.error('❌ Erreur appel is_platform_super_admin:', rpcError);
  } else {
    console.log(`✅ is_platform_super_admin() = ${isSuperAdmin}`);
  }

  // 3. Tester les requêtes avec RLS
  console.log('\n3️⃣ TEST DES REQUÊTES AVEC RLS');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Test entreprises
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('id, nom, user_id')
    .limit(10);

  if (entreprisesError) {
    console.error('❌ Erreur chargement entreprises:', entreprisesError);
  } else {
    console.log(`✅ Entreprises chargées: ${entreprises?.length || 0}`);
    if (entreprises && entreprises.length > 0) {
      console.log('   Exemples:', entreprises.slice(0, 3).map(e => ({ id: e.id, nom: e.nom })));
    }
  }

  // Test clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, nom, prenom, entreprise_id')
    .limit(10);

  if (clientsError) {
    console.error('❌ Erreur chargement clients:', clientsError);
  } else {
    console.log(`✅ Clients chargés: ${clients?.length || 0}`);
    if (clients && clients.length > 0) {
      console.log('   Exemples:', clients.slice(0, 3).map(c => ({ id: c.id, nom: c.nom })));
    }
  }

  // Test factures
  const { data: factures, error: facturesError } = await supabase
    .from('factures')
    .select('id, numero, entreprise_id')
    .limit(10);

  if (facturesError) {
    console.error('❌ Erreur chargement factures:', facturesError);
  } else {
    console.log(`✅ Factures chargées: ${factures?.length || 0}`);
    if (factures && factures.length > 0) {
      console.log('   Exemples:', factures.slice(0, 3).map(f => ({ id: f.id, numero: f.numero })));
    }
  }

  // Test abonnements
  const { data: abonnements, error: abonnementsError } = await supabase
    .from('abonnements')
    .select('id, plan_id, entreprise_id')
    .limit(10);

  if (abonnementsError) {
    console.error('❌ Erreur chargement abonnements:', abonnementsError);
  } else {
    console.log(`✅ Abonnements chargés: ${abonnements?.length || 0}`);
    if (abonnements && abonnements.length > 0) {
      console.log('   Exemples:', abonnements.slice(0, 3).map(a => ({ id: a.id, plan_id: a.plan_id })));
    }
  }

  // 4. Vérifier les RLS policies
  console.log('\n4️⃣ VÉRIFICATION DES RLS POLICIES');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: policies, error: policiesError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename IN ('entreprises', 'clients', 'factures', 'abonnements')
        ORDER BY tablename, policyname;
      `
    });

  if (policiesError) {
    console.log('⚠️ Impossible de récupérer les policies (normal, utilisez service role)');
  } else {
    console.log(`✅ ${policies?.length || 0} policies trouvées`);
  }

  console.log('\n✅ Diagnostic terminé !\n');
}

diagnostic().catch(console.error);

