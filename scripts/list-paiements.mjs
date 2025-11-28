/**
 * LISTE LES PAIEMENTS DISPONIBLES POUR TESTER
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY non configuré');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listPaiements() {
  try {
    console.log('🔍 Recherche des paiements récents...\n');
    
    // Récupérer les paiements récents
    const { data: paiements, error } = await supabase
      .from('paiements')
      .select('id, statut, montant_ttc, entreprise_id, created_at, notes')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    if (!paiements || paiements.length === 0) {
      console.log('⚠️  Aucun paiement trouvé');
      return;
    }
    
    console.log(`✅ ${paiements.length} paiement(s) trouvé(s):\n`);
    
    paiements.forEach((p, index) => {
      console.log(`${index + 1}. Paiement ID: ${p.id}`);
      console.log(`   → Statut: ${p.statut}`);
      console.log(`   → Montant: ${p.montant_ttc}€`);
      console.log(`   → Entreprise ID: ${p.entreprise_id || 'N/A'}`);
      console.log(`   → Date: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
      console.log(`   → Notes: ${p.notes ? LEFT(p.notes, 50) + '...' : 'NULL'}`);
      console.log('');
    });
    
    // Trouver un paiement en attente pour tester
    const paiementEnAttente = paiements.find(p => p.statut === 'en_attente');
    if (paiementEnAttente) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('  💡 PAIEMENT EN ATTENTE TROUVÉ');
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log(`\nPour tester le workflow avec ce paiement :`);
      console.log(`node scripts/test-payment-workflow.mjs ${paiementEnAttente.id}\n`);
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

function LEFT(str, len) {
  if (!str) return '';
  return str.substring(0, len);
}

listPaiements();

