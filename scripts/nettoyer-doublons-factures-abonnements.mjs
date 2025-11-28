#!/usr/bin/env node
/**
 * Script pour nettoyer les doublons de factures et abonnements
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

async function nettoyerDoublons() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧹 NETTOYAGE DES DOUBLONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Identifier les factures en doublon (même paiement_id dans notes)
    console.log('📋 ÉTAPE 1: Recherche des factures en doublon...\n');
    
    // Récupérer toutes les factures avec leur paiement_id dans notes
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('*')
      .not('notes', 'is', null)
      .order('created_at', { ascending: true });
    
    if (facturesError) {
      throw new Error(`Erreur récupération factures: ${facturesError.message}`);
    }
    
    const facturesParPaiement = {};
    const facturesADelete = [];
    
    if (factures && factures.length > 0) {
      factures.forEach(f => {
        try {
          const notes = typeof f.notes === 'string' ? JSON.parse(f.notes) : f.notes;
          const paiementId = notes?.paiement_id;
          
          if (paiementId) {
            if (!facturesParPaiement[paiementId]) {
              facturesParPaiement[paiementId] = [];
            }
            facturesParPaiement[paiementId].push(f);
          }
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      });
      
      // Pour chaque paiement, garder seulement la première facture
      Object.keys(facturesParPaiement).forEach(paiementId => {
        const factures = facturesParPaiement[paiementId];
        if (factures.length > 1) {
          console.log(`   ⚠️  Paiement ${paiementId}: ${factures.length} factures trouvées`);
          // Trier par date de création et garder la première
          factures.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const facturesADeletePourCePaiement = factures.slice(1);
          facturesADelete.push(...facturesADeletePourCePaiement);
          console.log(`      → Conservation: ${factures[0].numero} (${factures[0].id})`);
          facturesADeletePourCePaiement.forEach(f => {
            console.log(`      → Suppression: ${f.numero} (${f.id})`);
          });
        }
      });
      
      if (facturesADelete.length > 0) {
        console.log(`\n   📊 Total: ${facturesADelete.length} facture(s) à supprimer\n`);
      } else {
        console.log('   ✅ Aucune facture en doublon trouvée\n');
      }
    }
    
    // 2. Identifier les abonnements en doublon (même entreprise_id + plan_id)
    console.log('📋 ÉTAPE 2: Recherche des abonnements en doublon...\n');
    
    const { data: abonnements, error: abonnementsError } = await supabase
      .from('abonnements')
      .select('*')
      .eq('statut', 'actif')
      .order('created_at', { ascending: true });
    
    if (abonnementsError) {
      throw new Error(`Erreur récupération abonnements: ${abonnementsError.message}`);
    }
    
    const abonnementsParEntreprisePlan = {};
    const abonnementsADelete = [];
    
    if (abonnements && abonnements.length > 0) {
      abonnements.forEach(a => {
        const key = `${a.entreprise_id}-${a.plan_id}`;
        if (!abonnementsParEntreprisePlan[key]) {
          abonnementsParEntreprisePlan[key] = [];
        }
        abonnementsParEntreprisePlan[key].push(a);
      });
      
      // Pour chaque entreprise/plan, garder seulement le premier abonnement
      Object.keys(abonnementsParEntreprisePlan).forEach(key => {
        const abonnements = abonnementsParEntreprisePlan[key];
        if (abonnements.length > 1) {
          const [entrepriseId, planId] = key.split('-');
          console.log(`   ⚠️  Entreprise ${entrepriseId} / Plan ${planId}: ${abonnements.length} abonnements trouvés`);
          // Trier par date de création et garder le premier
          abonnements.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const abonnementsADeletePourCetteCombo = abonnements.slice(1);
          abonnementsADelete.push(...abonnementsADeletePourCetteCombo);
          console.log(`      → Conservation: ${abonnements[0].id}`);
          abonnementsADeletePourCetteCombo.forEach(a => {
            console.log(`      → Suppression: ${a.id}`);
          });
        }
      });
      
      if (abonnementsADelete.length > 0) {
        console.log(`\n   📊 Total: ${abonnementsADelete.length} abonnement(s) à supprimer\n`);
      } else {
        console.log('   ✅ Aucun abonnement en doublon trouvé\n');
      }
    }
    
    // 3. Demander confirmation avant suppression
    if (facturesADelete.length > 0 || abonnementsADelete.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  🗑️  SUPPRESSION DES DOUBLONS');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      let deletedCount = 0;
      
      // Supprimer les factures en doublon
      if (facturesADelete.length > 0) {
        console.log('🗑️  Suppression des factures en doublon...');
        for (const facture of facturesADelete) {
          const { error } = await supabase
            .from('factures')
            .delete()
            .eq('id', facture.id);
          
          if (error) {
            console.error(`   ❌ Erreur suppression facture ${facture.id}: ${error.message}`);
          } else {
            console.log(`   ✅ Facture ${facture.numero} supprimée`);
            deletedCount++;
          }
        }
        console.log('');
      }
      
      // Supprimer les abonnements en doublon
      if (abonnementsADelete.length > 0) {
        console.log('🗑️  Suppression des abonnements en doublon...');
        for (const abonnement of abonnementsADelete) {
          const { error } = await supabase
            .from('abonnements')
            .delete()
            .eq('id', abonnement.id);
          
          if (error) {
            console.error(`   ❌ Erreur suppression abonnement ${abonnement.id}: ${error.message}`);
          } else {
            console.log(`   ✅ Abonnement ${abonnement.id} supprimé`);
            deletedCount++;
          }
        }
        console.log('');
      }
      
      console.log(`✅ ${deletedCount} doublon(s) supprimé(s)\n`);
    } else {
      console.log('✅ Aucun doublon à supprimer\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ NETTOYAGE TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR lors du nettoyage:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

nettoyerDoublons().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

