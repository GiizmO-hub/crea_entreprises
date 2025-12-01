#!/usr/bin/env node

/**
 * SCRIPT POUR CRÉER LES FACTURES MANQUANTES
 * 
 * Ce script crée les factures manquantes pour les paiements payés qui n'ont pas de facture
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erreur: VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurés');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createMissingInvoices() {
  console.log('🔧 CRÉATION DES FACTURES MANQUANTES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver les paiements payés sans facture
    console.log('1️⃣  Recherche des paiements payés sans facture...');
    
    const { data: paiementsPayes, error: paiementsError } = await supabase
      .from('paiements')
      .select('id, entreprise_id, montant_ht, montant_ttc, user_id, notes')
      .eq('statut', 'paye')
      .order('created_at', { ascending: false })
      .limit(50);

    if (paiementsError) {
      console.error('   ❌ Erreur:', paiementsError.message);
      return;
    }

    console.log(`   📊 ${paiementsPayes?.length || 0} paiement(s) payé(s) trouvé(s)\n`);

    // 2. Vérifier lesquels n'ont pas de facture
    const paiementsSansFacture = [];
    
    for (const paiement of paiementsPayes || []) {
      const { data: factures } = await supabase
        .from('factures')
        .select('id')
        .eq('paiement_id', paiement.id)
        .limit(1);
      
      if (!factures || factures.length === 0) {
        paiementsSansFacture.push(paiement);
      }
    }

    console.log(`2️⃣  ${paiementsSansFacture.length} paiement(s) sans facture trouvé(s)\n`);

    if (paiementsSansFacture.length === 0) {
      console.log('✅ Tous les paiements ont déjà une facture !');
      return;
    }

    // 3. Créer les factures manquantes
    console.log('3️⃣  Création des factures manquantes...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const paiement of paiementsSansFacture) {
      try {
        console.log(`   🔄 Traitement paiement ${paiement.id.substring(0, 8)}...`);
        
        // Appeler la fonction RPC pour créer la facture
        const { data: result, error: rpcError } = await supabase.rpc(
          'creer_facture_et_abonnement_apres_paiement',
          { p_paiement_id: paiement.id }
        );

        if (rpcError) {
          console.error(`      ❌ Erreur: ${rpcError.message}`);
          errorCount++;
        } else if (result && result.success) {
          console.log(`      ✅ Facture créée: ${result.numero_facture || result.facture_id}`);
          successCount++;
        } else {
          console.error(`      ❌ Échec: ${result?.error || 'Erreur inconnue'}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`      ❌ Exception: ${error.message}`);
        errorCount++;
      }
    }

    // 4. Résumé
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ\n');
    console.log(`   ✅ Factures créées: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log(`   📋 Total traité: ${paiementsSansFacture.length}`);

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createMissingInvoices();

