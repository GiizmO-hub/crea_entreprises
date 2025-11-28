#!/usr/bin/env node
/**
 * Script de test pour le workflow complet de création d'entreprise
 * 
 * Teste:
 * 1. Création d'entreprise avec plan
 * 2. Vérification du paiement créé
 * 3. Vérification des notes du paiement
 * 4. Simulation du paiement Stripe
 * 5. Vérification de la création automatique (facture, abonnement, espace client)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   → VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   → SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testCreateEntrepriseWorkflow() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST WORKFLOW CRÉATION ENTREPRISE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer les plans disponibles
    console.log('📋 ÉTAPE 1: Récupération des plans d\'abonnement...');
    const { data: plans, error: plansError } = await supabase
      .from('plans_abonnement')
      .select('id, nom, prix_mensuel')
      .eq('actif', true)
      .order('prix_mensuel', { ascending: true })
      .limit(1);

    if (plansError) {
      throw new Error(`Erreur récupération plans: ${plansError.message}`);
    }

    if (!plans || plans.length === 0) {
      throw new Error('Aucun plan d\'abonnement actif trouvé !');
    }

    const plan = plans[0];
    console.log(`✅ Plan sélectionné: ${plan.nom} - ${plan.prix_mensuel}€/mois\n`);

    // 2. Créer une entreprise avec plan
    console.log('🏢 ÉTAPE 2: Création de l\'entreprise avec plan...');
    const testEmail = `test-${Date.now()}@example.com`;
    
    const { data: result, error: createError } = await supabase.rpc('create_complete_entreprise_automated', {
      p_nom_entreprise: `Test Entreprise ${Date.now()}`,
      p_forme_juridique: 'SARL',
      p_email_client: testEmail,
      p_nom_client: 'Test',
      p_prenom_client: 'Client',
      p_plan_id: plan.id,
      p_creer_client_super_admin: true
    });

    if (createError) {
      console.error('❌ Erreur création entreprise:', createError);
      throw createError;
    }

    if (!result || !result.success) {
      console.error('❌ Échec création entreprise:', result);
      throw new Error(result.error || 'Erreur inconnue');
    }

    console.log('✅ Entreprise créée avec succès !');
    console.log(`   → Entreprise ID: ${result.entreprise_id}`);
    console.log(`   → Client ID: ${result.client_id}`);
    console.log(`   → Paiement ID: ${result.paiement_id}`);
    console.log(`   → Montant TTC: ${result.montant_ttc}€\n`);

    if (!result.paiement_id) {
      throw new Error('❌ Aucun paiement créé alors qu\'un plan a été sélectionné !');
    }

    // 3. Vérifier le paiement créé
    console.log('💳 ÉTAPE 3: Vérification du paiement créé...');
    const { data: paiement, error: paiementError } = await supabase
      .from('paiements')
      .select('*')
      .eq('id', result.paiement_id)
      .single();

    if (paiementError || !paiement) {
      throw new Error(`Paiement non trouvé: ${paiementError?.message}`);
    }

    console.log('✅ Paiement trouvé !');
    console.log(`   → Statut: ${paiement.statut}`);
    console.log(`   → Montant TTC: ${paiement.montant_ttc}€`);
    console.log(`   → Notes: ${paiement.notes}\n`);

    // 4. Vérifier les notes du paiement
    console.log('📝 ÉTAPE 4: Vérification des notes du paiement...');
    let notesJson;
    try {
      notesJson = typeof paiement.notes === 'string' 
        ? JSON.parse(paiement.notes)
        : paiement.notes;
    } catch (e) {
      throw new Error(`Erreur parsing notes: ${e.message}`);
    }

    if (!notesJson.plan_id) {
      throw new Error('❌ plan_id manquant dans les notes du paiement !');
    }
    if (!notesJson.entreprise_id) {
      throw new Error('❌ entreprise_id manquant dans les notes du paiement !');
    }

    console.log('✅ Notes du paiement valides !');
    console.log(`   → Plan ID: ${notesJson.plan_id}`);
    console.log(`   → Entreprise ID: ${notesJson.entreprise_id}`);
    console.log(`   → Client ID: ${notesJson.client_id || 'N/A'}\n`);

    // 5. Simuler la validation du paiement
    console.log('✅ ÉTAPE 5: Simulation validation paiement...');
    const { data: validationResult, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: result.paiement_id,
      p_stripe_payment_id: `test_stripe_${Date.now()}`
    });

    if (validationError) {
      console.error('❌ Erreur validation paiement:', validationError);
      throw validationError;
    }

    if (!validationResult || !validationResult.success) {
      console.error('❌ Échec validation paiement:', validationResult);
      throw new Error(validationResult.error || 'Erreur inconnue');
    }

    console.log('✅ Paiement validé avec succès !');
    console.log(`   → Facture ID: ${validationResult.facture_id}`);
    console.log(`   → Abonnement ID: ${validationResult.abonnement_id}`);
    console.log(`   → Espace membre ID: ${validationResult.espace_membre_id}\n`);

    // 6. Vérifier la facture créée
    console.log('📄 ÉTAPE 6: Vérification de la facture...');
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', validationResult.facture_id)
      .single();

    if (factureError || !facture) {
      throw new Error(`Facture non trouvée: ${factureError?.message}`);
    }

    console.log('✅ Facture créée !');
    console.log(`   → Numéro: ${facture.numero}`);
    console.log(`   → Statut: ${facture.statut}`);
    console.log(`   → Montant TTC: ${facture.montant_ttc}€\n`);

    // 7. Vérifier l'abonnement créé
    console.log('📦 ÉTAPE 7: Vérification de l\'abonnement...');
    const { data: abonnement, error: abonnementError } = await supabase
      .from('abonnements')
      .select('*')
      .eq('id', validationResult.abonnement_id)
      .single();

    if (abonnementError || !abonnement) {
      throw new Error(`Abonnement non trouvé: ${abonnementError?.message}`);
    }

    console.log('✅ Abonnement créé !');
    console.log(`   → Statut: ${abonnement.statut}`);
    console.log(`   → Date début: ${abonnement.date_debut}`);
    console.log(`   → Montant mensuel: ${abonnement.montant_mensuel}€\n`);

    // 8. Vérifier l'espace membre client
    console.log('👤 ÉTAPE 8: Vérification de l\'espace membre client...');
    const { data: espace, error: espaceError } = await supabase
      .from('espaces_membres_clients')
      .select('*')
      .eq('id', validationResult.espace_membre_id)
      .single();

    if (espaceError || !espace) {
      throw new Error(`Espace membre non trouvé: ${espaceError?.message}`);
    }

    console.log('✅ Espace membre créé !');
    console.log(`   → Statut compte: ${espace.statut_compte}`);
    console.log(`   → Actif: ${espace.actif}\n`);

    // 9. Résumé final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ WORKFLOW COMPLET RÉUSSI !');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Entreprise créée: ${result.entreprise_id}`);
    console.log(`   ✅ Client créé: ${result.client_id}`);
    console.log(`   ✅ Paiement créé: ${result.paiement_id}`);
    console.log(`   ✅ Facture créée: ${validationResult.facture_id}`);
    console.log(`   ✅ Abonnement créé: ${validationResult.abonnement_id}`);
    console.log(`   ✅ Espace membre créé: ${validationResult.espace_membre_id}\n`);

    // Nettoyage (optionnel)
    console.log('🧹 Nettoyage des données de test...');
    console.log('   (Laissez les données pour vérification manuelle)\n');

    return {
      success: true,
      entreprise_id: result.entreprise_id,
      paiement_id: result.paiement_id,
      facture_id: validationResult.facture_id,
      abonnement_id: validationResult.abonnement_id
    };

  } catch (error) {
    console.error('\n❌ ERREUR LORS DU TEST:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Exécuter le test
testCreateEntrepriseWorkflow().then(() => {
  console.log('✅ Test terminé avec succès !\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test échoué:', error);
  process.exit(1);
});

