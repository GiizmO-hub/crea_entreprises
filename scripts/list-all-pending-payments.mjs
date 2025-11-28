#!/usr/bin/env node

/**
 * Liste tous les paiements en attente avec leurs informations
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listAllPendingPayments() {
  console.log('🔍 Liste de tous les paiements en attente...\n');
  
  const { data: paiements, error } = await supabase
    .from('paiements')
    .select('id, entreprise_id, user_id, statut, montant_ttc, notes, created_at')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  if (!paiements || paiements.length === 0) {
    console.log('✅ Aucun paiement en attente\n');
    return;
  }
  
  console.log(`📋 ${paiements.length} paiement(s) en attente:\n`);
  
  for (const p of paiements) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${p.id}`);
    console.log(`Montant: ${p.montant_ttc}€`);
    console.log(`Statut: ${p.statut}`);
    console.log(`Entreprise ID (table): ${p.entreprise_id || 'NULL'}`);
    console.log(`User ID: ${p.user_id || 'NULL'}`);
    console.log(`Date: ${p.created_at?.substring(0, 10) || 'N/A'}`);
    
    if (p.notes) {
      try {
        const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
        console.log(`Entreprise ID (notes): ${notes.entreprise_id || 'NULL'}`);
        console.log(`Client ID (notes): ${notes.client_id || 'NULL'}`);
        console.log(`Plan ID (notes): ${notes.plan_id || 'NULL'}`);
        console.log(`Description: ${notes.description || 'N/A'}`);
        
        // Vérifier si l'entreprise existe
        if (notes.entreprise_id) {
          const { data: entreprise } = await supabase
            .from('entreprises')
            .select('id, nom, statut')
            .eq('id', notes.entreprise_id)
            .single();
          
          if (entreprise) {
            console.log(`✅ Entreprise existe: ${entreprise.nom} (${entreprise.statut})`);
          } else {
            console.log(`❌ Entreprise n'existe PAS`);
          }
        }
      } catch (e) {
        console.log(`Notes: ${p.notes}`);
      }
    }
    console.log('');
  }
}

listAllPendingPayments();

