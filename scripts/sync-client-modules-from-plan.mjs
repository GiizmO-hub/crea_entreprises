import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncClientModules(email) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 SYNCHRONISATION DES MODULES POUR : ${email}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // 1. Trouver l'utilisateur
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error(`❌ Utilisateur non trouvé : ${email}`);
      return;
    }

    console.log(`✅ Utilisateur trouvé : ${user.id}`);

    // 2. Trouver l'espace membre client
    const { data: espaceClient, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('*, abonnements(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (espaceError || !espaceClient) {
      console.error(`❌ Espace membre client non trouvé`);
      return;
    }

    console.log(`✅ Espace membre client trouvé`);
    console.log(`   Modules actuels :`, espaceClient.modules_actifs);

    // 3. Récupérer l'abonnement
    const { data: abonnement, error: abonnementError } = await supabase
      .from('abonnements')
      .select('*, plans_abonnement(*)')
      .eq('client_id', espaceClient.client_id)
      .eq('actif', true)
      .maybeSingle();

    if (abonnementError || !abonnement) {
      console.error(`❌ Abonnement actif non trouvé`);
      return;
    }

    console.log(`✅ Abonnement trouvé : ${abonnement.plans_abonnement.nom}`);

    // 4. Récupérer les modules du plan
    const { data: planModules, error: modulesError } = await supabase
      .from('plan_modules')
      .select('*')
      .eq('plan_id', abonnement.plan_id);

    if (modulesError) throw modulesError;

    console.log(`✅ Modules du plan : ${planModules.length} modules`);

    // 5. Construire le nouvel objet modules_actifs
    const nouveauxModules = {};
    
    planModules.forEach(mod => {
      const codeModule = mod.module_code || mod.module_id;
      const estActif = mod.actif === true || mod.actif === 'true' || mod.actif === 1;
      if (estActif && codeModule) {
        nouveauxModules[codeModule] = true;
      }
    });

    // Ajouter les modules de base
    nouveauxModules.dashboard = true;
    nouveauxModules.entreprises = true;
    nouveauxModules.settings = true;

    console.log(`\n📦 Nouveaux modules à activer :`, nouveauxModules);

    // 6. Synchroniser
    const { error: updateError } = await supabase
      .from('espaces_membres_clients')
      .update({ modules_actifs: nouveauxModules })
      .eq('id', espaceClient.id);

    if (updateError) throw updateError;

    console.log(`\n✅ Modules synchronisés avec succès !`);
    console.log(`   ${Object.keys(nouveauxModules).length} modules activés\n`);

  } catch (error) {
    console.error('❌ Erreur :', error.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'groupemclem@gmail.com';
syncClientModules(email);
