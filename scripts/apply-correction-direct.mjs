import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (valeurs du projet)
const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Paiement ID à corriger
const PAIEMENT_ID = 'eee79728-5520-4220-984d-a577614a67f3';

console.log('🚀 APPLICATION AUTOMATIQUE DE LA CORRECTION\n');
console.log('='.repeat(80));

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY requise');
  console.error('   Utilisez: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/apply-correction-direct.mjs');
  console.error('   Ou ajoutez-la dans votre fichier .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log(`📋 Paiement ID: ${PAIEMENT_ID}\n`);

async function main() {
  try {
    // ÉTAPE 1 : Vérifier l'état actuel (si la fonction existe)
    console.log('📊 Vérification de l\'état actuel...\n');
    
    try {
      const { data: etatActuel, error: errorEtat } = await supabase.rpc('diagnostic_workflow_paiement', {
        p_paiement_id: PAIEMENT_ID
      });

      if (!errorEtat && etatActuel) {
        console.log('📊 État actuel:', JSON.stringify(etatActuel, null, 2));
        console.log('');
      }
    } catch (e) {
      console.log('⚠️  Fonction diagnostic non disponible, passage à la validation directe...\n');
    }

    // ÉTAPE 2 : Appeler valider_paiement_carte_immediat
    console.log('🚀 Appel de valider_paiement_carte_immediat...\n');

    const { data: resultat, error } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: PAIEMENT_ID,
      p_stripe_payment_id: null
    });

    if (error) {
      console.error('❌ Erreur lors de la validation:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      console.log('\n⚠️  La fonction valider_paiement_carte_immediat n\'existe peut-être pas.');
      console.log('   Veuillez appliquer la migration 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql\n');
      process.exit(1);
    }

    console.log('📋 Résultat de la validation:', JSON.stringify(resultat, null, 2));
    console.log('');

    if (resultat && resultat.success) {
      console.log('✅ SUCCÈS ! Workflow complété automatiquement.');
      if (resultat.facture_id) console.log('   → Facture ID:', resultat.facture_id);
      if (resultat.abonnement_id) console.log('   → Abonnement ID:', resultat.abonnement_id);
      if (resultat.espace_membre_id) console.log('   → Espace membre ID:', resultat.espace_membre_id);
    } else {
      console.error('❌ La validation a échoué:', resultat?.error || 'Erreur inconnue');
      
      if (resultat?.paiement_valide) {
        console.log('⚠️  Le paiement est marqué comme payé mais la création automatique a échoué.');
        console.log('   Détails:', resultat.details);
      }
    }

    // ÉTAPE 3 : Vérifier l'état final
    console.log('\n📊 Vérification de l\'état final...\n');

    try {
      const { data: etatFinal, error: errorFinal } = await supabase.rpc('diagnostic_workflow_paiement', {
        p_paiement_id: PAIEMENT_ID
      });

      if (!errorFinal && etatFinal) {
        console.log('📊 État final:', JSON.stringify(etatFinal, null, 2));
        console.log('');
        
        if (etatFinal.workflow_complet) {
          console.log('🎉 WORKFLOW COMPLET (100%) !');
        } else {
          console.log('⚠️  WORKFLOW INCOMPLET');
          console.log('   Vérifiez les éléments manquants dans le diagnostic ci-dessus.');
        }
      }
    } catch (e) {
      console.log('⚠️  Impossible de vérifier l\'état final (fonction diagnostic non disponible)');
    }

    console.log('\n✅ CORRECTION TERMINÉE !');
    console.log('   Rafraîchissez votre page pour voir les changements.\n');

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

main();

