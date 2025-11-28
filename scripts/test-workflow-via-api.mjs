/**
 * TEST DU WORKFLOW VIA API SUPABASE
 * Utilise la service_role_key pour tester directement
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 TEST DU WORKFLOW DE PAIEMENT VIA API\n');
console.log('='.repeat(80));

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY non configuré');
  console.error('\n💡 Pour obtenir la clé:');
  console.error('   1. Allez sur: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/api');
  console.error('   2. Copiez "service_role key" (secret)');
  console.error('   3. Exécutez: export SUPABASE_SERVICE_ROLE_KEY="votre_cle"');
  console.error('   4. Relancez ce script\n');
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
    // 1. Lister les paiements récents
    console.log('1️⃣ Liste des paiements récents:\n');
    const { data: paiements, error: paiementsError } = await supabase
      .from('paiements')
      .select('id, statut, montant_ttc, entreprise_id, created_at, notes')
      .order('created_at', { ascending: false })
      .limit(5);

    if (paiementsError) {
      console.error('❌ Erreur:', paiementsError.message);
      return;
    }

    if (!paiements || paiements.length === 0) {
      console.log('⚠️  Aucun paiement trouvé');
      return;
    }

    paiements.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id}`);
      console.log(`   → Statut: ${p.statut}`);
      console.log(`   → Montant: ${p.montant_ttc}€`);
      console.log(`   → Date: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
      console.log(`   → Notes: ${p.notes ? LEFT(p.notes, 50) + '...' : 'NULL'}`);
      console.log('');
    });

    // Trouver un paiement pour tester
    const paiementTest = paiements.find(p => p.statut === 'en_attente' || p.statut === 'paye') || paiements[0];
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  🧪 TEST DU WORKFLOW AVEC LE PAIEMENT`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`\nPaiement ID: ${paiementTest.id}`);
    console.log(`Statut actuel: ${paiementTest.statut}\n`);

    // 2. Tester get_paiement_info_for_stripe
    console.log('2️⃣ Test de get_paiement_info_for_stripe...');
    const { data: info, error: infoError } = await supabase.rpc('get_paiement_info_for_stripe', {
      p_paiement_id: paiementTest.id
    });

    if (infoError) {
      console.error('❌ Erreur get_paiement_info_for_stripe:', infoError.message);
      return;
    }

    if (!info || !info.success) {
      console.error('❌ get_paiement_info_for_stripe retourne success: false');
      console.error('   Erreur:', info?.error);
      return;
    }

    console.log('✅ Informations récupérées:');
    console.log(`   → Plan ID: ${info.plan_id || 'NON TROUVÉ'}`);
    console.log(`   → Entreprise: ${info.entreprise_nom || 'N/A'}`);
    console.log(`   → Montant TTC: ${info.montant_ttc}€\n`);

    // 3. Tester test_payment_workflow si disponible
    console.log('3️⃣ Test du workflow complet...');
    const { data: testResult, error: testError } = await supabase.rpc('test_payment_workflow', {
      p_paiement_id: paiementTest.id
    });

    if (testError) {
      console.log('⚠️  Fonction test_payment_workflow non disponible, test direct...\n');
      
      // Test direct de valider_paiement_carte_immediat
      console.log('4️⃣ Test direct de valider_paiement_carte_immediat...');
      const { data: validationResult, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
        p_paiement_id: paiementTest.id,
        p_stripe_payment_id: 'test_stripe_payment_id'
      });

      if (validationError) {
        console.error('❌ Erreur validation:', validationError.message);
        console.error('   Code:', validationError.code);
        console.error('   Details:', validationError.details);
        return;
      }

      console.log('✅ Résultat de validation:');
      console.log(JSON.stringify(validationResult, null, 2));
      console.log('');

      if (validationResult?.success) {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ✅ WORKFLOW FONCTIONNE CORRECTEMENT');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('✅ Paiement validé avec succès !');
        console.log(`   → Facture ID: ${validationResult.facture_id || 'N/A'}`);
        console.log(`   → Abonnement ID: ${validationResult.abonnement_id || 'N/A'}`);
        console.log(`   → Espace membre ID: ${validationResult.espace_membre_id || 'N/A'}`);
      } else {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ⚠️  PROBLÈMES DÉTECTÉS');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('Erreur:', validationResult?.error || 'Erreur inconnue');
      }
    } else {
      console.log('✅ Résultat du test:');
      console.log(JSON.stringify(testResult, null, 2));
      console.log('');

      if (testResult?.success) {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ✅ WORKFLOW FONCTIONNE CORRECTEMENT');
        console.log('═══════════════════════════════════════════════════════════════════');
      } else {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ⚠️  PROBLÈMES DÉTECTÉS');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('Erreur:', testResult?.error || 'Erreur inconnue');
        if (testResult?.diagnostics) {
          console.log('\nDétails:', JSON.stringify(testResult.diagnostics, null, 2));
        }
      }
    }

    // 4. Vérifier l'état final
    console.log('\n5️⃣ Vérification de l\'état final...');
    const { data: finalState, error: finalError } = await supabase
      .from('paiements')
      .select(`
        id,
        statut,
        entreprise_id,
        entreprises!inner(nom, statut),
        factures(count),
        abonnements(count)
      `)
      .eq('id', paiementTest.id)
      .single();

    if (!finalError && finalState) {
      console.log('✅ État final:');
      console.log(`   → Statut paiement: ${finalState.statut}`);
      console.log(`   → Entreprise: ${finalState.entreprises?.nom || 'N/A'}`);
      console.log(`   → Statut entreprise: ${finalState.entreprises?.statut || 'N/A'}`);
    }

    console.log('\n✅ Test terminé !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

function LEFT(str, len) {
  if (!str) return '';
  return str.substring(0, len);
}

testWorkflow();

