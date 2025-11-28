#!/usr/bin/env node

/**
 * TEST DU WORKFLOW DE PAIEMENT
 * Teste la validation d'un paiement en attente
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testPaymentWorkflow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST DU WORKFLOW DE PAIEMENT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Trouver un paiement en attente
  console.log('🔍 Étape 1: Recherche d\'un paiement en attente...\n');
  
  const { data: paiements, error: paiementsError } = await supabase
    .from('paiements')
    .select('id, statut, entreprise_id, montant_ttc, notes, created_at')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (paiementsError) {
    console.error('❌ Erreur:', paiementsError.message);
    return;
  }
  
  if (!paiements || paiements.length === 0) {
    console.log('✅ Aucun paiement en attente trouvé - Tout est à jour !\n');
    return;
  }
  
  const paiement = paiements[0];
  console.log(`📋 Paiement trouvé:`);
  console.log(`   ID: ${paiement.id}`);
  console.log(`   Montant: ${paiement.montant_ttc}€`);
  console.log(`   Entreprise ID: ${paiement.entreprise_id || 'NULL'}`);
  console.log(`   Date: ${paiement.created_at?.substring(0, 10) || 'N/A'}`);
  console.log('');
  
  // 2. Tester la validation du paiement
  console.log('🔧 Étape 2: Test de validation du paiement...\n');
  console.log('⚠️  Cette action va déclencher le workflow complet.');
  console.log('   - Création de la facture');
  console.log('   - Création de l\'abonnement');
  console.log('   - Création de l\'espace membre client');
  console.log('   - Activation de l\'entreprise\n');
  
  try {
    const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiement.id
    });
    
    if (error) {
      console.error('❌ Erreur lors de la validation:', error.message);
      console.log('\n💡 Vérifiez les logs ci-dessus pour plus de détails.\n');
      return;
    }
    
    console.log('✅ Paiement validé !\n');
    console.log('📊 Résultat:', JSON.stringify(data, null, 2));
    console.log('');
    
    // 3. Vérifier que la facture a été créée
    console.log('🔍 Étape 3: Vérification de la facture...\n');
    
    const { data: factures } = await supabase
      .from('factures')
      .select('id, numero, statut, montant_ttc')
      .eq('entreprise_id', paiement.entreprise_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (factures && factures.length > 0) {
      console.log('✅ Facture créée:');
      console.log(`   Numéro: ${factures[0].numero}`);
      console.log(`   Montant: ${factures[0].montant_ttc}€`);
      console.log(`   Statut: ${factures[0].statut}`);
      console.log('');
    } else {
      console.log('⚠️  Aucune facture trouvée\n');
    }
    
    // 4. Vérifier l'abonnement
    console.log('🔍 Étape 4: Vérification de l\'abonnement...\n');
    
    const { data: abonnements } = await supabase
      .from('abonnements')
      .select('id, statut, date_debut')
      .eq('entreprise_id', paiement.entreprise_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (abonnements && abonnements.length > 0) {
      console.log('✅ Abonnement créé:');
      console.log(`   Statut: ${abonnements[0].statut}`);
      console.log(`   Date début: ${abonnements[0].date_debut}`);
      console.log('');
    } else {
      console.log('⚠️  Aucun abonnement trouvé\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ TEST TERMINÉ !');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function main() {
  await testPaymentWorkflow();
}

main();
