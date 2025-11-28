#!/usr/bin/env node

/**
 * Script de nettoyage des paiements orphelins
 * Identifie et marque comme annulés les paiements liés à des entreprises inexistantes
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupOrphanedPayments() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧹 NETTOYAGE DES PAIEMENTS ORPHELINS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Récupérer tous les paiements en attente
  console.log('🔍 Étape 1: Identification des paiements en attente...\n');
  
  const { data: paiements, error: paiementsError } = await supabase
    .from('paiements')
    .select('id, entreprise_id, statut, montant_ttc, notes, created_at')
    .eq('statut', 'en_attente');
  
  if (paiementsError) {
    console.error('❌ Erreur:', paiementsError.message);
    return;
  }
  
  if (!paiements || paiements.length === 0) {
    console.log('✅ Aucun paiement en attente trouvé\n');
    return;
  }
  
  console.log(`📋 ${paiements.length} paiement(s) en attente trouvé(s)\n`);
  
  // 2. Identifier les paiements orphelins
  console.log('🔍 Étape 2: Identification des paiements orphelins...\n');
  
  const orphanedPayments = [];
  
  for (const p of paiements) {
    let entrepriseId = p.entreprise_id;
    
    // Si entreprise_id est NULL, chercher dans les notes
    if (!entrepriseId && p.notes) {
      try {
        const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
        entrepriseId = notes.entreprise_id;
      } catch (e) {
        // Ignorer si les notes ne sont pas parsables
      }
    }
    
    // Vérifier si l'entreprise existe
    if (entrepriseId) {
      const { data: entreprise, error: entrepriseError } = await supabase
        .from('entreprises')
        .select('id')
        .eq('id', entrepriseId)
        .single();
      
      if (entrepriseError || !entreprise) {
        orphanedPayments.push({
          ...p,
          entrepriseId,
          reason: 'Entreprise n\'existe pas'
        });
      }
    } else {
      orphanedPayments.push({
        ...p,
        entrepriseId: null,
        reason: 'Aucune entreprise ID trouvée'
      });
    }
  }
  
  console.log(`⚠️  ${orphanedPayments.length} paiement(s) orphelin(s) identifié(s)\n`);
  
  if (orphanedPayments.length === 0) {
    console.log('✅ Aucun paiement orphelin à nettoyer\n');
    return;
  }
  
  // 3. Afficher les détails
  console.log('📋 Détails des paiements orphelins:\n');
  orphanedPayments.forEach((p, index) => {
    console.log(`${index + 1}. ID: ${p.id.substring(0, 8)}...`);
    console.log(`   Montant: ${p.montant_ttc}€`);
    console.log(`   Entreprise ID: ${p.entrepriseId || 'NULL'}`);
    console.log(`   Raison: ${p.reason}`);
    console.log(`   Date: ${p.created_at?.substring(0, 10) || 'N/A'}`);
    console.log('');
  });
  
  // 4. Confirmation
  console.log('⚠️  Ces paiements seront marqués comme "annule" (pas supprimés)');
  console.log('   pour conserver l\'historique.\n');
  
  // 5. Nettoyer (marquer comme annulés)
  console.log('🧹 Étape 3: Nettoyage en cours...\n');
  
  let cleanedCount = 0;
  
  for (const p of orphanedPayments) {
    try {
      const notes = typeof p.notes === 'string' ? JSON.parse(p.notes || '{}') : (p.notes || {});
      
      notes.annulation_reason = 'Entreprise associée n\'existe plus';
      notes.annulation_date = new Date().toISOString();
      notes.cleaned_by = 'cleanup-orphaned-payments.mjs';
      
      const { error: updateError } = await supabase
        .from('paiements')
        .update({
          statut: 'annule',
          notes: JSON.stringify(notes),
          updated_at: new Date().toISOString()
        })
        .eq('id', p.id);
      
      if (updateError) {
        console.error(`❌ Erreur pour ${p.id.substring(0, 8)}...:`, updateError.message);
      } else {
        cleanedCount++;
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${p.id.substring(0, 8)}...:`, error.message);
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ ${cleanedCount}/${orphanedPayments.length} paiement(s) nettoyé(s)`);
  console.log(`📋 Total identifiés: ${orphanedPayments.length}`);
  console.log('');
  
  // 6. Vérification finale
  console.log('🔍 Vérification finale...\n');
  
  const { data: remainingPaiements } = await supabase
    .from('paiements')
    .select('id', { count: 'exact' })
    .eq('statut', 'en_attente');
  
  console.log(`📊 Paiements en attente restants: ${remainingPaiements?.length || 0}\n`);
  
  console.log('✅ Nettoyage terminé !\n');
}

async function main() {
  await cleanupOrphanedPayments();
}

main();

