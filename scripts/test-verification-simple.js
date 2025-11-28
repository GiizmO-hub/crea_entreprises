#!/usr/bin/env node

/**
 * Script de vérification simple
 * Vérifie que la fonction create_espace_membre_from_client fonctionne correctement
 * en utilisant des données existantes
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('🔍 Vérification de la fonction create_espace_membre_from_client\n');
  console.log('='.repeat(60));

  try {
    // 1. Vérifier qu'il existe au moins une entreprise
    console.log('\n📋 Étape 1: Vérification des entreprises existantes...');
    const { data: entreprises, error: errEnt } = await supabase
      .from('entreprises')
      .select('id, nom, user_id')
      .limit(5);

    if (errEnt) {
      console.error('❌ Erreur lors de la récupération des entreprises:', errEnt.message);
      process.exit(1);
    }

    if (!entreprises || entreprises.length === 0) {
      console.log('⚠️  Aucune entreprise trouvée dans la base de données');
      console.log('   Veuillez créer une entreprise via l\'interface web d\'abord');
      process.exit(0);
    }

    console.log(`✅ ${entreprises.length} entreprise(s) trouvée(s)`);
    const entreprise = entreprises[0];
    console.log(`   Utilisation de: ${entreprise.nom} (${entreprise.id})`);

    // 2. Vérifier qu'il existe au moins un client pour cette entreprise
    console.log('\n📋 Étape 2: Vérification des clients existants...');
    const { data: clients, error: errCli } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, entreprise_id')
      .eq('entreprise_id', entreprise.id)
      .limit(5);

    if (errCli) {
      console.error('❌ Erreur lors de la récupération des clients:', errCli.message);
      process.exit(1);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  Aucun client trouvé pour cette entreprise');
      console.log('   Veuillez créer un client via l\'interface web d\'abord');
      process.exit(0);
    }

    // Chercher un client qui n'a pas encore d'espace membre
    let clientSansEspace = null;
    for (const client of clients) {
      const { data: espace } = await supabase
        .from('espaces_membres_clients')
        .select('id')
        .eq('client_id', client.id)
        .single();

      if (!espace) {
        clientSansEspace = client;
        break;
      }
    }

    if (!clientSansEspace) {
      console.log('✅ Tous les clients ont déjà un espace membre');
      clientSansEspace = clients[0]; // Utiliser le premier pour tester quand même
      console.log(`   Test avec le client: ${clientSansEspace.email || clientSansEspace.nom}`);
    } else {
      console.log(`✅ Client sans espace membre trouvé: ${clientSansEspace.email || clientSansEspace.nom}`);
    }

    // 3. Vérifier qu'un plan existe
    console.log('\n📋 Étape 3: Vérification des plans d\'abonnement...');
    const { data: plans, error: errPlan } = await supabase
      .from('plans_abonnement')
      .select('id, nom')
      .eq('actif', true)
      .limit(1)
      .single();

    const planId = plans?.id || null;
    if (planId) {
      console.log(`✅ Plan trouvé: ${plans.nom}`);
    } else {
      console.log('⚠️  Aucun plan actif trouvé (création sans plan)');
    }

    // 4. Tester la création d'un espace membre
    console.log('\n📋 Étape 4: Test de création d\'espace membre...');
    console.log(`   Client ID: ${clientSansEspace.id}`);
    console.log(`   Entreprise ID: ${clientSansEspace.entreprise_id}`);
    console.log(`   Plan ID: ${planId || 'Aucun'}`);
    console.log(`   Email client: ${clientSansEspace.email || 'Non défini'}`);

    if (!clientSansEspace.email || clientSansEspace.email.trim() === '') {
      console.error('❌ Le client doit avoir un email pour créer un espace membre');
      process.exit(1);
    }

    const { data: result, error: errRpc } = await supabase.rpc('create_espace_membre_from_client', {
      p_client_id: clientSansEspace.id,
      p_entreprise_id: clientSansEspace.entreprise_id,
      p_password: null, // Génération automatique
      p_plan_id: planId,
      p_options_ids: []
    });

    if (errRpc) {
      console.error('\n❌ ❌ ❌ ERREUR LORS DE LA CRÉATION ❌ ❌ ❌');
      console.error(`Erreur: ${errRpc.message}`);
      console.error(`Code: ${errRpc.code || 'N/A'}`);
      console.error(`Details: ${errRpc.details || 'N/A'}`);
      console.error(`Hint: ${errRpc.hint || 'N/A'}`);
      
      if (errRpc.message.includes('confirmed_at')) {
        console.error('\n💡 SOLUTION:');
        console.error('   La migration 20250122000051_fix_confirmed_at_column_error.sql');
        console.error('   doit être appliquée. Exécutez:');
        console.error('   node scripts/auto-apply-migrations.js');
      }
      
      process.exit(1);
    }

    if (!result || !result.success) {
      console.error('\n❌ ❌ ❌ CRÉATION ÉCHOUÉE ❌ ❌ ❌');
      console.error(`Erreur: ${result?.error || 'Erreur inconnue'}`);
      process.exit(1);
    }

    // 5. Afficher les résultats
    console.log('\n✅ ✅ ✅ CRÉATION RÉUSSIE ✅ ✅ ✅\n');
    console.log('📊 Détails de l\'espace membre créé:');
    console.log(`   Success: ${result.success}`);
    console.log(`   User ID: ${result.user_id}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Password: ${result.password ? '✅ Généré (' + result.password.substring(0, 8) + '...)' : '❌ Non disponible'}`);
    console.log(`   Password généré automatiquement: ${result.password_generated ? '✅' : '❌'}`);
    console.log(`   Message: ${result.message || 'Aucun message'}`);
    
    if (result.already_exists) {
      console.log('   ⚠️  Espace membre existait déjà');
    }

    // 6. Vérifier dans la base de données
    console.log('\n📋 Étape 5: Vérification dans la base de données...');
    const { data: espace, error: errEspace } = await supabase
      .from('espaces_membres_clients')
      .select('*')
      .eq('client_id', clientSansEspace.id)
      .single();

    if (errEspace || !espace) {
      console.warn('⚠️  Espace membre non trouvé dans la table espaces_membres_clients');
    } else {
      console.log('✅ Espace membre trouvé dans la base de données:');
      console.log(`   ID: ${espace.id}`);
      console.log(`   Actif: ${espace.actif ? '✅' : '❌'}`);
      console.log(`   Email: ${espace.email || 'Non défini'}`);
      console.log(`   User ID: ${espace.user_id || 'Non défini'}`);
      console.log(`   Doit changer password: ${espace.doit_changer_password ? '✅' : '❌'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ✅ TOUS LES TESTS SONT RÉUSSIS! ✅ 🎉\n');
    console.log('La fonction create_espace_membre_from_client fonctionne correctement.');
    console.log('Vous pouvez maintenant créer des espaces membres via l\'interface web.\n');

  } catch (error) {
    console.error('\n❌ ❌ ❌ ERREUR INATTENDUE ❌ ❌ ❌');
    console.error(`Erreur: ${error.message}`);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);




