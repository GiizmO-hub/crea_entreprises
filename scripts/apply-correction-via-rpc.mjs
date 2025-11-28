import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        SUPABASE_SERVICE_ROLE_KEY = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 APPLICATION AUTOMATIQUE DE LA CORRECTION VIA RPC\n');
console.log('='.repeat(80));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const PAIEMENT_ID = 'eee79728-5520-4220-984d-a577614a67f3';

console.log(`📋 Paiement ID: ${PAIEMENT_ID}\n`);

// Vérifier l'état actuel
console.log('📊 Vérification de l\'état actuel...\n');

const { data: etatActuel, error: errorEtat } = await supabase.rpc('diagnostic_workflow_paiement', {
  p_paiement_id: PAIEMENT_ID
});

if (errorEtat) {
  console.error('❌ Erreur lors de la vérification:', errorEtat.message);
  console.log('⚠️  La fonction diagnostic_workflow_paiement n\'existe peut-être pas encore.\n');
  console.log('📋 Passage à la validation directe...\n');
} else {
  console.log('📊 État actuel:', JSON.stringify(etatActuel, null, 2));
  console.log('');
}

// Appeler valider_paiement_carte_immediat
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
  console.log('   → Facture ID:', resultat.facture_id);
  console.log('   → Abonnement ID:', resultat.abonnement_id);
  console.log('   → Espace membre ID:', resultat.espace_membre_id);
} else {
  console.error('❌ La validation a échoué:', resultat?.error || 'Erreur inconnue');
  
  if (resultat?.paiement_valide) {
    console.log('⚠️  Le paiement est marqué comme payé mais la création automatique a échoué.');
    console.log('   Détails:', resultat.details);
  }
}

// Vérifier l'état final
console.log('\n📊 Vérification de l\'état final...\n');

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
} else {
  console.log('⚠️  Impossible de vérifier l\'état final (fonction diagnostic non disponible)');
}

console.log('\n✅ CORRECTION TERMINÉE !');
console.log('   Rafraîchissez votre page pour voir les changements.\n');

