/**
 * TEST DU WORKFLOW COMPLET
 * 
 * Ce script vérifie que le workflow de paiement fonctionne à 100%
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAIEMENT_ID = 'eee79728-5520-4220-984d-a577614a67f3';

console.log('🧪 TEST DU WORKFLOW COMPLET\n');
console.log('='.repeat(80));
console.log(`📋 Paiement ID: ${PAIEMENT_ID}\n`);

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY requise');
  console.error('   Utilisez: export SUPABASE_SERVICE_ROLE_KEY="votre_cle"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testWorkflow() {
  try {
    // Test 1 : Vérifier l'état du workflow
    console.log('📊 Test 1 : Vérification de l\'état du workflow...\n');

    const { data: diagnostic, error: errorDiag } = await supabase.rpc('diagnostic_workflow_paiement', {
      p_paiement_id: PAIEMENT_ID
    });

    if (errorDiag) {
      console.error('❌ Erreur diagnostic:', errorDiag.message);
      console.log('\n⚠️  La fonction diagnostic n\'existe peut-être pas encore.\n');
    } else {
      console.log('📊 Résultat du diagnostic:');
      console.log(JSON.stringify(diagnostic, null, 2));
      console.log('');

      if (diagnostic && diagnostic.workflow_complet) {
        console.log('✅ WORKFLOW COMPLET (100%) !');
        console.log('   → Paiement:', diagnostic.paiement?.statut || 'N/A');
        console.log('   → Facture:', diagnostic.facture?.existe ? '✅ Créée' : '❌ Manquante');
        console.log('   → Abonnement:', diagnostic.abonnement?.existe ? '✅ Créé' : '❌ Manquant');
        console.log('   → Espace membre:', diagnostic.espace_membre?.existe ? '✅ Créé' : '❌ Manquant');
      } else {
        console.log('⚠️  WORKFLOW INCOMPLET');
        if (!diagnostic.paiement || diagnostic.paiement.statut !== 'paye') {
          console.log('   ❌ Paiement non marqué comme payé');
        }
        if (!diagnostic.facture?.existe) {
          console.log('   ❌ Facture non créée');
        }
        if (!diagnostic.abonnement?.existe) {
          console.log('   ❌ Abonnement non créé');
        }
        if (!diagnostic.espace_membre?.existe) {
          console.log('   ❌ Espace membre non créé');
        }
      }
      console.log('');
    }

    // Test 2 : Vérifier directement dans les tables
    console.log('📊 Test 2 : Vérification directe dans les tables...\n');

    const { data: paiement, error: errorPaiement } = await supabase
      .from('paiements')
      .select('*')
      .eq('id', PAIEMENT_ID)
      .single();

    if (errorPaiement) {
      console.error('❌ Erreur récupération paiement:', errorPaiement.message);
    } else {
      console.log('✅ Paiement trouvé:');
      console.log(`   → Statut: ${paiement.statut}`);
      console.log(`   → Montant: ${paiement.montant_ttc}€`);
      console.log(`   → Date paiement: ${paiement.date_paiement || 'N/A'}`);
      console.log('');

      if (paiement.entreprise_id) {
        // Vérifier facture
        const { data: factures, error: errorFactures } = await supabase
          .from('factures')
          .select('*')
          .eq('entreprise_id', paiement.entreprise_id)
          .contains('notes', { paiement_id: PAIEMENT_ID });

        console.log(`📄 Factures: ${factures?.length || 0} trouvée(s)`);
        if (factures && factures.length > 0) {
          console.log(`   ✅ Facture créée: ${factures[0].numero}`);
        } else {
          console.log('   ❌ Aucune facture trouvée');
        }

        // Vérifier abonnement
        const { data: abonnements, error: errorAbonnements } = await supabase
          .from('abonnements')
          .select('*')
          .eq('entreprise_id', paiement.entreprise_id);

        console.log(`📦 Abonnements: ${abonnements?.length || 0} trouvé(s)`);
        if (abonnements && abonnements.length > 0) {
          console.log(`   ✅ Abonnement créé: ${abonnements[0].id}`);
          console.log(`   → Statut: ${abonnements[0].statut}`);
        } else {
          console.log('   ❌ Aucun abonnement trouvé');
        }

        // Vérifier espace membre
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('entreprise_id', paiement.entreprise_id)
          .limit(1);

        if (clients && clients.length > 0) {
          const clientId = clients[0].id;
          
          const { data: espaces, error: errorEspaces } = await supabase
            .from('espaces_membres_clients')
            .select('*')
            .eq('client_id', clientId)
            .eq('entreprise_id', paiement.entreprise_id);

          console.log(`👤 Espaces membres: ${espaces?.length || 0} trouvé(s)`);
          if (espaces && espaces.length > 0) {
            console.log(`   ✅ Espace créé: ${espaces[0].id}`);
            console.log(`   → Role: ${espaces[0].role}`);
            console.log(`   → Actif: ${espaces[0].actif}`);
          } else {
            console.log('   ❌ Aucun espace membre trouvé');
          }
        }

        // Vérifier entreprise
        const { data: entreprise, error: errorEntreprise } = await supabase
          .from('entreprises')
          .select('*')
          .eq('id', paiement.entreprise_id)
          .single();

        if (!errorEntreprise && entreprise) {
          console.log(`🏢 Entreprise: ${entreprise.nom}`);
          console.log(`   → Statut: ${entreprise.statut}`);
          console.log(`   → Statut paiement: ${entreprise.statut_paiement || 'N/A'}`);
        }
      }
    }

    console.log('\n✅ TEST TERMINÉ !\n');

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

testWorkflow();

