/**
 * APPLICATION AUTOMATIQUE DE LA CORRECTION
 * 
 * Ce script essaie d'appliquer automatiquement la correction du paiement
 * via l'API Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const PAIEMENT_ID = 'eee79728-5520-4220-984d-a577614a67f3';

// Récupérer la clé depuis l'environnement ou demander
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 APPLICATION AUTOMATIQUE DE LA CORRECTION\n');
console.log('='.repeat(80));
console.log(`📋 Paiement ID: ${PAIEMENT_ID}\n`);

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY requise');
  console.error('\n📖 Pour obtenir la clé:');
  console.error('   1. Allez sur: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/api');
  console.error('   2. Copiez "service_role key" (secret)');
  console.error('   3. Exécutez: export SUPABASE_SERVICE_ROLE_KEY="votre_cle"');
  console.error('   4. Relancez ce script\n');
  console.error('💡 ALTERNATIVE: Appliquez directement via Dashboard SQL Editor');
  console.error('   → Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
  console.error('   → Copiez le contenu de APPLY_THIS_SQL.sql');
  console.error('   → Collez et exécutez\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Connexion Supabase établie\n');

// Étape 1 : Appeler valider_paiement_carte_immediat
console.log('🚀 Appel de valider_paiement_carte_immediat...\n');

try {
  const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
    p_paiement_id: PAIEMENT_ID,
    p_stripe_payment_id: null
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    
    if (error.code === '42883' || error.message.includes('does not exist')) {
      console.error('\n⚠️  La fonction valider_paiement_carte_immediat n\'existe pas encore.');
      console.error('   Vous devez d\'abord appliquer les migrations:\n');
      console.error('   1. 20250123000062_fix_valider_paiement_carte_automatisation_complete.sql');
      console.error('   2. Puis réexécutez ce script\n');
      console.error('   📖 Ou appliquez directement APPLY_THIS_SQL.sql via Dashboard SQL Editor');
    }
    
    process.exit(1);
  }

  console.log('✅ Résultat:', JSON.stringify(data, null, 2));
  console.log('');

  if (data && data.success) {
    console.log('🎉 SUCCÈS ! Workflow complété automatiquement.');
    if (data.facture_id) console.log('   → Facture ID:', data.facture_id);
    if (data.abonnement_id) console.log('   → Abonnement ID:', data.abonnement_id);
    if (data.espace_membre_id) console.log('   → Espace membre ID:', data.espace_membre_id);
    console.log('\n✅ Le paiement devrait maintenant être à 100% !');
    console.log('   Rafraîchissez votre page pour voir les changements.\n');
  } else {
    console.error('❌ La validation a échoué:', data?.error || 'Erreur inconnue');
    if (data?.details) {
      console.error('   Détails:', JSON.stringify(data.details, null, 2));
    }
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Erreur fatale:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

