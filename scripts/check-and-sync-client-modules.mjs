import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

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

async function checkAndSyncClient(email) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 VÉRIFICATION ET SYNCHRONISATION : ${email}`);
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
      .select('*, clients(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (espaceError || !espaceClient) {
      console.error(`❌ Espace membre client non trouvé`);
      return;
    }

    console.log(`✅ Espace membre client trouvé`);
    console.log(`   Modules actuels :`, JSON.stringify(espaceClient.modules_actifs, null, 2));

    // 3. Trouver l'abonnement actif
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

    console.log(`\n✅ Modules du plan (${planModules.length} modules) :`);
    const modulesActifs = {};
    planModules.forEach(mod => {
      const estActif = mod.actif === true || mod.activer === true || mod.inclus === true;
      if (estActif) {
        const code = mod.module_code || mod.module_id;
        if (code) {
          modulesActifs[code] = true;
          modulesActifs[code.replace(/_/g, '-')] = true;
          modulesActifs[code.replace(/-/g, '_')] = true;
          console.log(`   ✅ ${code}`);
        }
      }
    });

    // Modules de base
    modulesActifs.dashboard = true;
    modulesActifs.tableau_de_bord = true;
    modulesActifs.entreprises = true;
    modulesActifs.mon_entreprise = true;
    modulesActifs.settings = true;
    modulesActifs.parametres = true;

    console.log(`\n📦 Modules à activer :`, Object.keys(modulesActifs));

    // 5. Synchroniser
    const { error: updateError } = await supabase
      .from('espaces_membres_clients')
      .update({ modules_actifs: modulesActifs })
      .eq('id', espaceClient.id);

    if (updateError) throw updateError;

    console.log(`\n✅ Modules synchronisés avec succès !`);
    console.log(`   ${Object.keys(modulesActifs).length} modules activés\n`);

  } catch (error) {
    console.error('❌ Erreur :', error.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'groupemclem@gmail.com';
checkAndSyncClient(email);
