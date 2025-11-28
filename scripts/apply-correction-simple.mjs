import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAIEMENT_ID = 'eee79728-5520-4220-984d-a577614a67f3';

console.log('🚀 APPLICATION AUTOMATIQUE DE LA CORRECTION\n');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variable SUPABASE_SERVICE_ROLE_KEY requise');
  console.error('   Utilisez: export SUPABASE_SERVICE_ROLE_KEY=xxx');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('📋 Appel de valider_paiement_carte_immediat...\n');

const { data, error } = await supabase.rpc('valider_paiement_carte_immediat', {
  p_paiement_id: PAIEMENT_ID,
  p_stripe_payment_id: null
});

if (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}

console.log('✅ Résultat:', JSON.stringify(data, null, 2));
