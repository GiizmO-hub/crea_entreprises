#!/usr/bin/env node
/**
 * Script pour vérifier les données des paiements en attente
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPayments() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION DES PAIEMENTS EN ATTENTE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: paiements } = await supabase
    .from('paiements')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!paiements || paiements.length === 0) {
    console.log('✅ Aucun paiement en attente\n');
    return;
  }

  console.log(`📊 ${paiements.length} paiement(s) en attente:\n`);

  for (const p of paiements) {
    console.log(`─`.repeat(60));
    console.log(`💳 Paiement ID: ${p.id}`);
    console.log(`   → Entreprise ID: ${p.entreprise_id || 'NULL'}`);
    console.log(`   → Client ID: ${p.client_id || 'NULL'}`);
    console.log(`   → User ID: ${p.user_id || 'NULL'}`);
    console.log(`   → Notes: ${p.notes ? (typeof p.notes === 'string' ? p.notes.substring(0, 200) : JSON.stringify(p.notes).substring(0, 200)) : 'NULL'}`);
    
    // Parser les notes
    if (p.notes) {
      try {
        const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
        console.log(`   → Plan ID (notes): ${notes.plan_id || 'NULL'}`);
        console.log(`   → Entreprise ID (notes): ${notes.entreprise_id || 'NULL'}`);
        console.log(`   → Client ID (notes): ${notes.client_id || 'NULL'}`);
      } catch (e) {
        console.log(`   ⚠️ Erreur parsing notes: ${e.message}`);
      }
    }
    console.log('');
  }
}

checkPayments().then(() => process.exit(0)).catch((e) => {
  console.error('Erreur:', e);
  process.exit(1);
});

