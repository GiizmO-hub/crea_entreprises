#!/usr/bin/env node
/**
 * Script de diagnostic complet pour les modules d'un client
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticClient(email = null) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC COMPLET : MODULES CLIENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver le client par email ou récupérer tous les clients avec abonnements
    let clientEmail = email;
    let clientId = null;
    let userId = null;

    if (clientEmail) {
      console.log(`📋 Recherche du client: ${clientEmail}...\n`);
      
      // Rechercher via la table clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, email')
        .ilike('email', `%${clientEmail}%`)
        .limit(1);
      
      if (clients && clients.length > 0) {
        clientId = clients[0].id;
        console.log(`   ✅ Client trouvé: ${clients[0].id}`);
        
        // Trouver l'espace membre
        const { data: espace } = await supabase
          .from('espaces_membres_clients')
          .select('user_id')
          .eq('client_id', clientId)
          .limit(1)
          .maybeSingle();
        
        if (espace?.user_id) {
          userId = espace.user_id;
          console.log(`   ✅ User ID trouvé: ${userId}`);
        }
      }
    } else {
      // Récupérer le premier client avec un abonnement
      console.log('📋 Recherche d\'un client avec abonnement...\n');
      
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, nom, prenom, email, statut')
        .eq('statut', 'actif')
        .limit(1);
      
      if (clientsError || !clients || clients.length === 0) {
        throw new Error('Aucun client trouvé');
      }
      
      const client = clients[0];
      clientId = client.id;
      clientEmail = client.email;
      console.log(`   ✅ Client trouvé: ${client.nom} ${client.prenom} (${client.email})`);
      
      // Trouver l'utilisateur auth
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers.users.find(u => u.email === clientEmail);
      if (authUser) {
        userId = authUser.id;
        console.log(`   ✅ Utilisateur auth trouvé: ${userId}`);
      }
    }

    if (!userId && clientId) {
      // Trouver via l'espace membre
      const { data: espace } = await supabase
        .from('espaces_membres_clients')
        .select('user_id')
        .eq('client_id', clientId)
        .limit(1)
        .single();
      
      if (espace?.user_id) {
        userId = espace.user_id;
        console.log(`   ✅ User ID depuis espace membre: ${userId}`);
      }
    }

    if (!userId) {
      throw new Error('Impossible de trouver l\'utilisateur');
    }

    // 2. Vérifier l'espace membre
    console.log('\n📋 ÉTAPE 2: Vérification de l\'espace membre...\n');
    
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('*, client:clients(*), entreprise:entreprises(*)')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (espaceError) {
      throw new Error(`Erreur espace membre: ${espaceError.message}`);
    }
    
    if (!espace) {
      console.error('   ❌ Aucun espace membre trouvé pour cet utilisateur !');
      return false;
    }
    
    console.log(`   ✅ Espace membre trouvé:`);
    console.log(`      → ID: ${espace.id}`);
    console.log(`      → Client ID: ${espace.client_id}`);
    console.log(`      → Entreprise ID: ${espace.entreprise_id}`);
    console.log(`      → Statut: ${espace.statut_compte || 'N/A'}`);
    console.log(`      → Actif: ${espace.actif}`);
    console.log(`      → Modules actifs:`, JSON.stringify(espace.modules_actifs || {}, null, 2));
    
    // 3. Vérifier l'abonnement
    console.log('\n📋 ÉTAPE 3: Vérification de l\'abonnement...\n');
    
    const { data: abonnement, error: aboError } = await supabase
      .from('abonnements')
      .select('*, plan:plans_abonnement(*)')
      .eq('client_id', userId)
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (aboError) {
      console.error(`   ❌ Erreur abonnement: ${aboError.message}`);
    } else if (!abonnement) {
      console.error('   ❌ Aucun abonnement actif trouvé !');
    } else {
      console.log(`   ✅ Abonnement actif trouvé:`);
      console.log(`      → Plan: ${abonnement.plan?.nom || 'N/A'}`);
      console.log(`      → Plan ID: ${abonnement.plan_id}`);
      console.log(`      → Statut: ${abonnement.statut}`);
      
      // 4. Vérifier les modules du plan
      console.log('\n📋 ÉTAPE 4: Modules disponibles dans le plan...\n');
      
      const { data: planModules, error: pmError } = await supabase
        .from('plan_modules')
        .select('module_code, module_nom, activer')
        .eq('plan_id', abonnement.plan_id)
        .eq('activer', true);
      
      if (pmError) {
        console.error(`   ❌ Erreur plan_modules: ${pmError.message}`);
      } else {
        console.log(`   ✅ ${planModules?.length || 0} module(s) activé(s) dans le plan:\n`);
        planModules?.forEach(m => {
          console.log(`      → ${m.module_code} (${m.module_nom || 'N/A'})`);
        });
      }
      
      // 5. Comparer avec modules_actifs dans l'espace membre
      console.log('\n📋 ÉTAPE 5: Comparaison modules plan vs modules_actifs...\n');
      
      const modulesPlan = new Set(planModules?.map(m => m.module_code) || []);
      const modulesActifs = new Set(Object.keys(espace.modules_actifs || {}).filter(k => espace.modules_actifs[k] === true));
      
      const modulesManquants = [...modulesPlan].filter(m => !modulesActifs.has(m));
      const modulesEnTrop = [...modulesActifs].filter(m => !modulesPlan.has(m));
      
      if (modulesManquants.length > 0) {
        console.error(`   ❌ ${modulesManquants.length} module(s) manquant(s) dans modules_actifs:\n`);
        modulesManquants.forEach(m => {
          console.error(`      → ${m}`);
        });
        console.log('');
      } else {
        console.log(`   ✅ Tous les modules du plan sont présents dans modules_actifs\n`);
      }
      
      if (modulesEnTrop.length > 0) {
        console.log(`   ℹ️  ${modulesEnTrop.length} module(s) supplémentaire(s) dans modules_actifs (modules de base):\n`);
        modulesEnTrop.forEach(m => {
          console.log(`      → ${m}`);
        });
        console.log('');
      }
      
      // 6. Vérifier les droits super admin
      console.log('\n📋 ÉTAPE 6: Vérification des droits super admin...\n');
      
      const { data: utilisateur, error: userError } = await supabase
        .from('utilisateurs')
        .select('role, is_protected')
        .eq('id', userId)
        .maybeSingle();
      
      if (userError || !utilisateur) {
        console.error(`   ⚠️  Utilisateur non trouvé dans utilisateurs`);
      } else {
        console.log(`   ✅ Utilisateur trouvé:`);
        console.log(`      → Rôle: ${utilisateur.role || 'N/A'}`);
        console.log(`      → Protégé: ${utilisateur.is_protected || false}`);
      }
      
      // Vérifier auth.users metadata
      const { data: authUserMeta } = await supabase.auth.admin.getUserById(userId);
      if (authUserMeta?.user?.raw_user_meta_data) {
        console.log(`   ✅ Metadata auth:`);
        console.log(`      → Rôle: ${authUserMeta.user.raw_user_meta_data.role || 'N/A'}`);
        console.log(`      → Type: ${authUserMeta.user.raw_user_meta_data.type || 'N/A'}`);
        console.log(`      → is_client_super_admin: ${authUserMeta.user.raw_user_meta_data.is_client_super_admin || false}`);
      }
      
      // 7. Test de synchronisation
      console.log('\n📋 ÉTAPE 7: Test de synchronisation des modules...\n');
      
      if (espace.client_id && abonnement.plan_id) {
        console.log('   🔄 Tentative de synchronisation...');
        
        const { data: syncResult, error: syncError } = await supabase.rpc('sync_client_modules_from_plan', {
          p_client_id: espace.client_id,
          p_plan_id: abonnement.plan_id
        });
        
        if (syncError) {
          console.error(`   ❌ Erreur synchronisation: ${syncError.message}`);
        } else {
          console.log(`   ✅ Synchronisation réussie !`);
          console.log(`      → Résultat:`, JSON.stringify(syncResult, null, 2));
          
          // Re-vérifier les modules
          const { data: espaceAfter } = await supabase
            .from('espaces_membres_clients')
            .select('modules_actifs')
            .eq('id', espace.id)
            .single();
          
          if (espaceAfter?.modules_actifs) {
            const modulesApresSync = Object.keys(espaceAfter.modules_actifs).filter(k => espaceAfter.modules_actifs[k] === true);
            console.log(`   ✅ Modules après sync: ${modulesApresSync.length}`);
            console.log(`      → ${modulesApresSync.join(', ')}`);
          }
        }
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  📊 DIAGNOSTIC TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERREUR lors du diagnostic:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    return false;
  }
}

// Récupérer l'email en argument si fourni
const email = process.argv[2] || null;

diagnosticClient(email).then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

