/**
 * Script de diagnostic complet pour analyser les modules, options et abonnements
 * 
 * Analyse:
 * 1. Les modules dans modules_activation
 * 2. Les modules dans plans_modules pour chaque plan
 * 3. Les modules synchronisés dans espaces_membres_clients.modules_actifs
 * 4. Le mapping entre codes de modules et IDs de menu
 * 5. Les problèmes de synchronisation
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

async function diagnosticComplet(clientEmail) {
  console.log('\n🔍 DIAGNOSTIC COMPLET MODULES, OPTIONS ET ABONNEMENTS\n');
  console.log('='.repeat(80));
  console.log(`📧 Email client: ${clientEmail || 'TOUS LES CLIENTS'}`);
  console.log('='.repeat(80));

  try {
    // ==========================================
    // ÉTAPE 1: Analyser modules_activation
    // ==========================================
    console.log('\n📋 ÉTAPE 1: Modules disponibles dans modules_activation');
    console.log('-'.repeat(80));
    
    const { data: modulesActivation, error: modulesError } = await supabase
      .from('modules_activation')
      .select('*')
      .order('module_code');

    if (modulesError) {
      console.error('❌ Erreur lecture modules_activation:', modulesError.message);
    } else if (!modulesActivation || modulesActivation.length === 0) {
      console.log('⚠️ Aucun module dans modules_activation');
    } else {
      console.log(`✅ ${modulesActivation.length} module(s) trouvé(s):\n`);
      modulesActivation.forEach(mod => {
        console.log(`  📦 ${mod.module_code}`);
        console.log(`     Nom: ${mod.module_nom || 'N/A'}`);
        console.log(`     Actif: ${mod.actif ? '✅' : '❌'}`);
        console.log(`     Créé: ${mod.est_cree ? '✅' : '❌'}`);
        console.log('');
      });
    }

    // ==========================================
    // ÉTAPE 2: Analyser les plans et leurs modules
    // ==========================================
    console.log('\n📋 ÉTAPE 2: Plans d\'abonnement et leurs modules');
    console.log('-'.repeat(80));
    
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('*')
      .eq('actif', true)
      .order('ordre');

    if (plansError) {
      console.error('❌ Erreur lecture plans:', plansError.message);
    } else if (!plans || plans.length === 0) {
      console.log('⚠️ Aucun plan trouvé');
    } else {
      for (const plan of plans) {
        console.log(`\n  💳 Plan: ${plan.nom} (${plan.id})`);
        
        const { data: planModules, error: pmError } = await supabase
          .from('plans_modules')
          .select('module_code, inclus')
          .eq('plan_id', plan.id)
          .eq('inclus', true);

        if (pmError) {
          console.log(`     ❌ Erreur: ${pmError.message}`);
        } else if (!planModules || planModules.length === 0) {
          console.log(`     ⚠️ Aucun module inclus dans ce plan`);
        } else {
          console.log(`     ✅ ${planModules.length} module(s) inclus:`);
          planModules.forEach(pm => {
            console.log(`        - ${pm.module_code}`);
          });
        }
      }
    }

    // ==========================================
    // ÉTAPE 3: Analyser un client spécifique
    // ==========================================
    if (clientEmail) {
      console.log('\n📋 ÉTAPE 3: Analyse du client spécifique');
      console.log('-'.repeat(80));

      // Trouver le client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, email, nom, prenom, entreprise_id')
        .ilike('email', `%${clientEmail}%`)
        .maybeSingle();

      if (clientError || !client) {
        console.error('❌ Client non trouvé:', clientError?.message);
      } else {
        console.log(`✅ Client trouvé: ${client.nom} ${client.prenom} (${client.id})`);

        // Trouver l'espace membre
        const { data: espace, error: espaceError } = await supabase
          .from('espaces_membres_clients')
          .select('id, abonnement_id, modules_actifs')
          .eq('client_id', client.id)
          .maybeSingle();

        if (espaceError || !espace) {
          console.log('❌ Espace membre non trouvé:', espaceError?.message);
        } else {
          console.log(`✅ Espace membre trouvé: ${espace.id}`);
          console.log(`📋 Abonnement ID: ${espace.abonnement_id || 'NON DÉFINI'}`);

          // Analyser modules_actifs
          if (espace.modules_actifs) {
            console.log(`\n  📦 Modules actifs dans l'espace (${Object.keys(espace.modules_actifs).length}):`);
            Object.keys(espace.modules_actifs).forEach(code => {
              const val = espace.modules_actifs[code];
              const isActive = val === true || val === 'true' || val === 1;
              console.log(`     ${isActive ? '✅' : '❌'} ${code}: ${val} (${typeof val})`);
            });
          } else {
            console.log('⚠️ modules_actifs est vide ou null');
          }

          // Si abonnement existe, comparer avec les modules du plan
          if (espace.abonnement_id) {
            const { data: abonnement, error: aboError } = await supabase
              .from('abonnements')
              .select('plan_id, statut')
              .eq('id', espace.abonnement_id)
              .maybeSingle();

            if (aboError || !abonnement) {
              console.log('\n  ❌ Abonnement non trouvé:', aboError?.message);
            } else {
              console.log(`\n  💳 Abonnement trouvé: ${abonnement.statut}`);
              console.log(`  📋 Plan ID: ${abonnement.plan_id}`);

              if (abonnement.plan_id) {
                const { data: planModules, error: pmError } = await supabase
                  .from('plans_modules')
                  .select('module_code, inclus')
                  .eq('plan_id', abonnement.plan_id)
                  .eq('inclus', true);

                if (pmError) {
                  console.log(`  ❌ Erreur lecture modules plan: ${pmError.message}`);
                } else if (!planModules || planModules.length === 0) {
                  console.log(`  ⚠️ Aucun module dans le plan`);
                } else {
                  console.log(`\n  📦 Modules inclus dans le plan (${planModules.length}):`);
                  const modulesPlan = planModules.map(pm => pm.module_code);
                  modulesPlan.forEach(code => console.log(`     ✅ ${code}`));

                  // Comparer avec modules_actifs
                  const modulesActifs = espace.modules_actifs || {};
                  const modulesActifsList = Object.keys(modulesActifs).filter(code => {
                    const val = modulesActifs[code];
                    return val === true || val === 'true' || val === 1;
                  });

                  console.log(`\n  🔍 COMPARAISON:`);
                  console.log(`     Modules dans le plan: ${modulesPlan.length}`);
                  console.log(`     Modules dans modules_actifs: ${modulesActifsList.length}`);

                  const manquants = modulesPlan.filter(code => !modulesActifsList.includes(code));
                  const enTrop = modulesActifsList.filter(code => !modulesPlan.includes(code));

                  if (manquants.length > 0) {
                    console.log(`\n  ⚠️ MODULES DU PLAN NON SYNCHRONISÉS:`);
                    manquants.forEach(code => {
                      console.log(`     ❌ ${code} (dans le plan mais PAS dans modules_actifs)`);
                    });
                  }

                  if (enTrop.length > 0) {
                    console.log(`\n  ℹ️  MODULES EN TROP (pas dans le plan):`);
                    enTrop.forEach(code => {
                      console.log(`     ⚠️  ${code}`);
                    });
                  }

                  if (manquants.length === 0 && enTrop.length === 0) {
                    console.log(`\n  ✅ PARFAIT: Tous les modules du plan sont synchronisés!`);
                  }
                }
              }
            }
          } else {
            console.log('\n  ⚠️ Pas d\'abonnement associé à l\'espace membre');
            console.log('  💡 Il faut créer un abonnement pour synchroniser les modules');
          }
        }
      }
    }

    // ==========================================
    // ÉTAPE 4: Mapping des codes de modules
    // ==========================================
    console.log('\n📋 ÉTAPE 4: Mapping des codes de modules vers IDs de menu');
    console.log('-'.repeat(80));
    
    const moduleCodeToMenuId = {
      'dashboard': 'dashboard',
      'tableau_de_bord': 'dashboard',
      'tableau-de-bord': 'dashboard',
      'mon_entreprise': 'entreprises',
      'mon-entreprise': 'entreprises',
      'entreprises': 'entreprises',
      'clients': 'clients',
      'gestion_clients': 'clients',
      'gestion-clients': 'clients',
      'gestion-des-clients': 'clients',
      'gestion_des_clients': 'clients',
      'facturation': 'factures',
      'factures': 'factures',
      'documents': 'documents',
      'gestion_documents': 'documents',
      'gestion-documents': 'documents',
      'gestion-de-documents': 'documents',
      'gestion_de_documents': 'documents',
      'gestion-equipe': 'gestion-equipe',
      'gestion_equipe': 'gestion-equipe',
      'gestion-projets': 'gestion-projets',
      'gestion_projets': 'gestion-projets',
      'comptabilite': 'comptabilite',
      'comptabilité': 'comptabilite',
      'finance': 'finance',
      'finances': 'finance',
      'collaborateurs': 'collaborateurs',
      'gestion-collaborateurs': 'collaborateurs',
      'gestion_des_collaborateurs': 'collaborateurs',
      'gestion-des-collaborateurs': 'collaborateurs',
      'parametres': 'settings',
      'paramètres': 'settings',
      'settings': 'settings',
    };

    console.log('\n  📝 Mapping disponible (codes de modules → IDs de menu):');
    Object.entries(moduleCodeToMenuId).forEach(([code, menuId]) => {
      console.log(`     ${code} → ${menuId}`);
    });

    // ==========================================
    // ÉTAPE 5: Vérifier tous les clients sans abonnement
    // ==========================================
    console.log('\n📋 ÉTAPE 5: Clients sans abonnement');
    console.log('-'.repeat(80));
    
    const { data: espacesSansAbonnement, error: espacesError } = await supabase
      .from('espaces_membres_clients')
      .select('id, client_id, abonnement_id')
      .is('abonnement_id', null)
      .limit(10);

    if (espacesError) {
      console.error('❌ Erreur:', espacesError.message);
    } else if (!espacesSansAbonnement || espacesSansAbonnement.length === 0) {
      console.log('✅ Tous les espaces ont un abonnement');
    } else {
      console.log(`⚠️ ${espacesSansAbonnement.length} espace(s) sans abonnement`);
      console.log('  💡 Ces espaces ne peuvent pas avoir de modules synchronisés depuis un plan');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DIAGNOSTIC TERMINÉ');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

const clientEmail = process.argv[2] || null;

diagnosticComplet(clientEmail);

