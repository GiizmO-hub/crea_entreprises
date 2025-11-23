#!/usr/bin/env node

/**
 * Script de test pour vérifier la création d'entreprise et d'espace membre
 * 
 * Ce script :
 * 1. Crée une entreprise
 * 2. Crée un client pour cette entreprise
 * 3. Crée un espace membre pour ce client
 * 4. Vérifie que tout fonctionne correctement
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Variable VITE_SUPABASE_URL ou SUPABASE_URL manquante');
  process.exit(1);
}

// Utiliser la service role key si disponible, sinon utiliser l'anon key
const keyToUse = supabaseServiceKey || supabaseAnonKey;

if (!keyToUse) {
  console.error('❌ Aucune clé Supabase trouvée (SERVICE_ROLE_KEY ou ANON_KEY)');
  console.error('   Variables disponibles:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

if (supabaseServiceKey) {
  console.log('✅ Utilisation de la SERVICE_ROLE_KEY (accès complet)');
} else {
  console.log('⚠️  Utilisation de l\'ANON_KEY (permissions limitées)');
  console.log('   Note: Certaines opérations pourraient nécessiter SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, keyToUse, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getSuperAdminUserId() {
  // Essayer de trouver le super admin
  const { data: users, error } = await supabase
    .from('utilisateurs')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)
    .single();

  if (!error && users) {
    return users.id;
  }

  // Sinon, chercher par email dans auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (!authError && authUsers?.users) {
    const superAdmin = authUsers.users.find(u => 
      u.email === 'meddecyril@icloud.com' ||
      u.user_metadata?.role === 'super_admin' ||
      u.app_metadata?.role === 'super_admin'
    );
    
    if (superAdmin) {
      return superAdmin.id;
    }
  }

  // Utiliser le premier utilisateur de la première entreprise
  const { data: entreprises } = await supabase
    .from('entreprises')
    .select('user_id')
    .limit(1)
    .single();

  if (entreprises?.user_id) {
    return entreprises.user_id;
  }

  throw new Error('Impossible de trouver un utilisateur super admin');
}

async function testCreateEntreprise() {
  console.log('\n📋 Étape 1: Création d\'une entreprise de test...');
  
  try {
    const superAdminId = await getSuperAdminUserId();
    console.log(`✅ Super admin trouvé: ${superAdminId}`);

    const timestamp = Date.now();
    const entrepriseData = {
      nom: `Entreprise Test ${timestamp}`,
      forme_juridique: 'SAS',
      siret: `123456789${timestamp.toString().slice(-5)}`,
      capital: 10000,
      email: `test-entreprise-${timestamp}@example.com`,
      telephone: '0123456789',
      adresse: '123 Rue de Test',
      code_postal: '75001',
      ville: 'Paris',
      user_id: superAdminId,
      statut: 'active'
    };

    const { data: entreprise, error } = await supabase
      .from('entreprises')
      .insert(entrepriseData)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors de la création de l\'entreprise:', error);
      throw error;
    }

    console.log(`✅ Entreprise créée avec succès: ${entreprise.id}`);
    console.log(`   Nom: ${entreprise.nom}`);
    return entreprise;
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'entreprise:', error.message);
    throw error;
  }
}

async function testCreateClient(entrepriseId) {
  console.log('\n📋 Étape 2: Création d\'un client pour l\'entreprise...');
  
  try {
    const timestamp = Date.now();
    const clientData = {
      entreprise_id: entrepriseId,
      nom: 'Client',
      prenom: 'Test',
      email: `client-test-${timestamp}@example.com`,
      telephone: '0987654321',
      ville: 'Lyon',
      code_postal: '69001',
      statut: 'actif',
      entreprise_nom: `Entreprise Client Test ${timestamp}`
    };

    const { data: client, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors de la création du client:', error);
      throw error;
    }

    console.log(`✅ Client créé avec succès: ${client.id}`);
    console.log(`   Email: ${client.email}`);
    return client;
  } catch (error) {
    console.error('❌ Erreur lors de la création du client:', error.message);
    throw error;
  }
}

async function testCreateEspaceMembre(client, entrepriseId) {
  console.log('\n📋 Étape 3: Création d\'un espace membre pour le client...');
  
  try {
    // Récupérer un plan actif
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('id, nom')
      .eq('actif', true)
      .limit(1)
      .single();

    if (plansError || !plans) {
      console.warn('⚠️  Aucun plan trouvé, création sans plan');
    }

    const planId = plans?.id || null;

    console.log(`   Utilisation du plan: ${plans?.nom || 'Aucun'}`);

    // Appeler la fonction RPC pour créer l'espace membre
    const { data: result, error } = await supabase.rpc('create_espace_membre_from_client', {
      p_client_id: client.id,
      p_entreprise_id: entrepriseId,
      p_password: null, // Génération automatique
      p_plan_id: planId,
      p_options_ids: []
    });

    if (error) {
      console.error('❌ Erreur lors de la création de l\'espace membre:', error);
      throw error;
    }

    if (!result || !result.success) {
      console.error('❌ Échec de la création de l\'espace membre:', result?.error || 'Erreur inconnue');
      throw new Error(result?.error || 'Erreur inconnue');
    }

    console.log('✅ Espace membre créé avec succès!');
    console.log(`   User ID: ${result.user_id}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Password: ${result.password ? '✅ Généré (' + result.password.substring(0, 3) + '...)' : '❌ Non disponible'}`);
    console.log(`   Message: ${result.message || 'Aucun message'}`);

    if (result.already_exists) {
      console.log('   ⚠️  Espace membre existait déjà');
    }

    return result;
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'espace membre:', error.message);
    throw error;
  }
}

async function verifyEspaceMembre(clientId) {
  console.log('\n📋 Étape 4: Vérification de l\'espace membre créé...');
  
  try {
    const { data: espace, error } = await supabase
      .from('espaces_membres_clients')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error || !espace) {
      console.error('❌ Espace membre non trouvé:', error?.message || 'Non trouvé');
      return false;
    }

    console.log('✅ Espace membre trouvé dans la base de données:');
    console.log(`   ID: ${espace.id}`);
    console.log(`   Actif: ${espace.actif ? '✅' : '❌'}`);
    console.log(`   Email: ${espace.email || 'Non défini'}`);
    console.log(`   User ID: ${espace.user_id || 'Non défini'}`);
    console.log(`   Abonnement ID: ${espace.abonnement_id || 'Aucun'}`);
    console.log(`   Doit changer password: ${espace.doit_changer_password ? '✅' : '❌'}`);

    // Vérifier que l'utilisateur existe dans auth.users
    if (espace.user_id) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(espace.user_id);
      
      if (!authError && authUser?.user) {
        console.log('✅ Utilisateur trouvé dans auth.users:');
        console.log(`   Email: ${authUser.user.email}`);
        console.log(`   Créé le: ${authUser.user.created_at}`);
        console.log(`   Email confirmé: ${authUser.user.email_confirmed_at ? '✅' : '❌'}`);
      } else {
        console.warn('⚠️  Utilisateur non trouvé dans auth.users');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    return false;
  }
}

async function cleanup(entrepriseId, clientId) {
  console.log('\n🧹 Nettoyage des données de test...');
  
  try {
    // Supprimer l'espace membre
    await supabase
      .from('espaces_membres_clients')
      .delete()
      .eq('client_id', clientId);

    // Supprimer le client
    await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    // Supprimer l'entreprise
    await supabase
      .from('entreprises')
      .delete()
      .eq('id', entrepriseId);

    console.log('✅ Données de test supprimées');
  } catch (error) {
    console.warn('⚠️  Erreur lors du nettoyage (peut être ignorée):', error.message);
  }
}

async function main() {
  console.log('🚀 Démarrage du test de création entreprise + espace membre\n');
  console.log('=' .repeat(60));

  let entreprise = null;
  let client = null;

  try {
    // 1. Créer une entreprise
    entreprise = await testCreateEntreprise();

    // 2. Créer un client
    client = await testCreateClient(entreprise.id);

    // 3. Créer un espace membre
    const espaceResult = await testCreateEspaceMembre(client, entreprise.id);

    // 4. Vérifier l'espace membre
    const verified = await verifyEspaceMembre(client.id);

    console.log('\n' + '='.repeat(60));
    if (verified && espaceResult.success) {
      console.log('\n✅ ✅ ✅ TEST RÉUSSI ✅ ✅ ✅');
      console.log('\nToutes les étapes ont été complétées avec succès:');
      console.log('  ✅ Entreprise créée');
      console.log('  ✅ Client créé');
      console.log('  ✅ Espace membre créé');
      console.log('  ✅ Vérification OK');
    } else {
      console.log('\n⚠️  TEST PARTIELLEMENT RÉUSSI');
      console.log('Certaines vérifications ont échoué');
    }

    // Nettoyage optionnel (décommentez pour supprimer les données de test)
    // await cleanup(entreprise.id, client.id);

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('\n❌ ❌ ❌ TEST ÉCHOUÉ ❌ ❌ ❌');
    console.error(`\nErreur: ${error.message}`);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);

