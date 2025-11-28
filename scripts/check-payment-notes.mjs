#!/usr/bin/env node

/**
 * Vérification des notes d'un paiement
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkPaymentNotes() {
  const paiementId = '2b2c93ae-8ac3-4831-bcca-9728d889014c';
  
  console.log('🔍 Vérification des notes du paiement...\n');
  console.log(`ID: ${paiementId}\n`);
  
  const { data: paiement, error } = await supabase
    .from('paiements')
    .select('id, entreprise_id, user_id, notes, statut, montant_ttc, montant_ht, montant_tva')
    .eq('id', paiementId)
    .single();
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  console.log('📋 Informations du paiement:');
  console.log(`   Entreprise ID: ${paiement.entreprise_id || 'NULL'}`);
  console.log(`   User ID: ${paiement.user_id || 'NULL'}`);
  console.log(`   Statut: ${paiement.statut}`);
  console.log(`   Montant: ${paiement.montant_ttc}€`);
  console.log('');
  
  console.log('📝 Notes (raw):');
  console.log(paiement.notes);
  console.log('');
  
  if (paiement.notes) {
    try {
      const notesJson = typeof paiement.notes === 'string' ? JSON.parse(paiement.notes) : paiement.notes;
      console.log('📝 Notes (parsed):');
      console.log(JSON.stringify(notesJson, null, 2));
      console.log('');
      
      if (notesJson.entreprise_id) {
        console.log(`✅ Entreprise ID trouvé dans notes: ${notesJson.entreprise_id}`);
      } else {
        console.log('❌ Entreprise ID non trouvé dans notes');
      }
      
      if (notesJson.client_id) {
        console.log(`✅ Client ID trouvé dans notes: ${notesJson.client_id}`);
      }
      
      if (notesJson.plan_id) {
        console.log(`✅ Plan ID trouvé dans notes: ${notesJson.plan_id}`);
      }
    } catch (e) {
      console.log('⚠️  Notes non parsables en JSON');
    }
  } else {
    console.log('❌ Aucune note trouvée');
  }
}

checkPaymentNotes();

