#!/usr/bin/env node
/**
 * Script pour tester le workflow complet de création d'entreprise avec paiement
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWorkflow() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST WORKFLOW COMPLET CRÉATION ENTREPRISE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Se connecter avec un utilisateur
    const email = process.env.TEST_EMAIL || 'meddecyril@icloud.com';
    const password = process.env.TEST_PASSWORD || '21052024_Aa!';

    console.log(`🔐 Connexion avec: ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('❌ Erreur de connexion:', authError.message);
      process.exit(1);
    }

    console.log('✅ Connexion réussie !\n');

    // 2. Récupérer un plan
    console.log('📋 Récupération des plans...');
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('id, nom, prix_mensuel')
      .eq('actif', true)
      .limit(1);

    if (plansError || !plans || plans.length === 0) {
      console.error('❌ Erreur récupération plans:', plansError);
      return;
    }

    const plan = plans[0];
    console.log(`✅ Plan sélectionné: ${plan.nom} (${plan.prix_mensuel}€/mois)\n`);

    // 3. Créer une entreprise avec le workflow complet
    const entrepriseNom = `Test Workflow ${Date.now()}`;
    console.log('🏢 Création de l\'entreprise...');
    console.log(`   Nom: ${entrepriseNom}`);
    console.log(`   Plan: ${plan.nom}\n`);

    const { data: result, error: creationError } = await supabase.rpc('create_complete_entreprise_automated', {
      p_nom_entreprise: entrepriseNom,
      p_forme_juridique: 'SARL',
      p_siret: null,
      p_email_entreprise: `test-${Date.now()}@example.com`,
      p_telephone_entreprise: '0100000000',
      p_adresse: '123 Rue Test',
      p_code_postal: '75001',
      p_ville: 'Paris',
      p_capital: 1000,
      p_rcs: null,
      p_site_web: null,
      p_email_client: `client-${Date.now()}@example.com`,
      p_nom_client: 'Test',
      p_prenom_client: 'Workflow',
      p_telephone_client: '0100000001',
      p_adresse_client: '456 Rue Client',
      p_code_postal_client: '75002',
      p_ville_client: 'Paris',
      p_password_client: 'Test1234!',
      p_plan_id: plan.id,
      p_options_ids: null,
      p_creer_client_super_admin: true,
      p_envoyer_email: false,
    });

    if (creationError) {
      console.error('❌ Erreur création entreprise:', creationError);
      return;
    }

    if (!result || !result.success) {
      console.error('❌ Échec création entreprise:', result?.error);
      return;
    }

    console.log('✅ Entreprise créée avec succès !');
    console.log(`   Entreprise ID: ${result.entreprise_id || 'N/A'}`);
    console.log(`   Client ID: ${result.client_id || 'N/A'}`);
    console.log(`   Paiement ID: ${result.paiement_id || 'N/A'}`);
    console.log('');

    if (!result.paiement_id) {
      console.log('⚠️  Pas de paiement créé (peut-être que le plan n\'a pas de montant)');
      return;
    }

    // 4. Vérifier l'état du paiement
    console.log('📊 Vérification de l\'état du paiement...');
    const { data: paiement, error: paiementError } = await supabase
      .from('paiements')
      .select('*')
      .eq('id', result.paiement_id)
      .single();

    if (paiementError) {
      console.error('❌ Erreur récupération paiement:', paiementError);
      return;
    }

    console.log(`   Statut: ${paiement.statut}`);
    console.log(`   Montant: ${paiement.montant_ttc}€`);
    
    if (paiement.notes) {
      const notes = typeof paiement.notes === 'string' ? JSON.parse(paiement.notes) : paiement.notes;
      console.log(`   Entreprise ID dans notes: ${notes.entreprise_id || 'N/A'}`);
      console.log(`   Client ID dans notes: ${notes.client_id || 'N/A'}`);
      console.log(`   Plan ID dans notes: ${notes.plan_id || 'N/A'}`);
    }
    console.log('');

    // 5. Simuler la validation du paiement (comme le ferait PaymentSuccess ou le webhook)
    console.log('🔄 Simulation de la validation du paiement...\n');
    const { data: validationResult, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: result.paiement_id,
      p_stripe_payment_id: `test_stripe_${Date.now()}`
    });

    if (validationError) {
      console.error('❌ ERREUR lors de la validation:');
      console.error(`   Code: ${validationError.code}`);
      console.error(`   Message: ${validationError.message}`);
      console.error(`   Détails: ${validationError.details || 'N/A'}`);
      console.error(`   Hint: ${validationError.hint || 'N/A'}`);
      return;
    }

    console.log('✅ Résultat de la validation:');
    console.log(JSON.stringify(validationResult, null, 2));
    console.log('');

    if (validationResult && validationResult.success) {
      console.log('🎉 ✅ WORKFLOW COMPLET RÉUSSI !');
      console.log(`   → Facture ID: ${validationResult.facture_id || 'N/A'}`);
      console.log(`   → Abonnement ID: ${validationResult.abonnement_id || 'N/A'}`);
      console.log(`   → Espace membre ID: ${validationResult.espace_membre_id || 'N/A'}`);
    } else {
      console.log('⚠️  WORKFLOW PARTIEL OU ERREUR:');
      console.log(`   → Erreur: ${validationResult?.error || 'N/A'}`);
    }

    // 6. Vérifier que tout a été créé
    console.log('\n📊 Vérification finale de l\'état...\n');
    
    if (result.entreprise_id) {
      const { data: entreprise } = await supabase
        .from('entreprises')
        .select('id, nom, statut')
        .eq('id', result.entreprise_id)
        .single();
      
      console.log(`Entreprise: ${entreprise ? `${entreprise.nom} (${entreprise.statut})` : '❌ NON TROUVÉE'}`);
    }

    if (result.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, nom, prenom, email')
        .eq('id', result.client_id)
        .single();
      
      const clientName = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : null;
      console.log(`Client: ${client ? `${clientName} (${client.email})` : '❌ NON TROUVÉ'}`);
    }

    if (result.entreprise_id) {
      const { data: factures } = await supabase
        .from('factures')
        .select('id, numero, statut')
        .eq('entreprise_id', result.entreprise_id)
        .limit(1);
      
      console.log(`Facture: ${factures && factures.length > 0 ? `${factures[0].numero} (${factures[0].statut})` : '❌ NON TROUVÉE'}`);
    }

    if (result.client_id) {
      const { data: abonnements } = await supabase
        .from('abonnements')
        .select('id, statut')
        .eq('client_id', result.client_id)
        .limit(1);
      
      console.log(`Abonnement: ${abonnements && abonnements.length > 0 ? `${abonnements[0].id} (${abonnements[0].statut})` : '❌ NON TROUVÉ'}`);
    }

    if (result.client_id) {
      const { data: espaces } = await supabase
        .from('espaces_membres_clients')
        .select('id, statut_compte, actif')
        .eq('client_id', result.client_id)
        .limit(1);
      
      console.log(`Espace membre: ${espaces && espaces.length > 0 ? `${espaces[0].id} (${espaces[0].statut_compte})` : '❌ NON TROUVÉ'}`);
    }

    console.log('\n✅ Test terminé !\n');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
}

testWorkflow();

