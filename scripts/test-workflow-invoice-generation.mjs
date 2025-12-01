#!/usr/bin/env node

/**
 * SCRIPT DE TEST - VÉRIFICATION DU WORKFLOW DE GÉNÉRATION DE FACTURES
 * 
 * Ce script vérifie que le workflow génère correctement les factures après un paiement
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

async function testWorkflow() {
  console.log('🧪 TEST DU WORKFLOW DE GÉNÉRATION DE FACTURES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Vérifier que la fonction existe
    console.log('1️⃣  Vérification de la fonction creer_facture_et_abonnement_apres_paiement...');
    const { data: funcCheck, error: funcError } = await supabase.rpc('creer_facture_et_abonnement_apres_paiement', {
      p_paiement_id: '00000000-0000-0000-0000-000000000000' // ID fictif pour tester l'existence
    });
    
    if (funcError && funcError.message.includes('non trouvé')) {
      console.log('   ✅ Fonction existe (erreur attendue pour ID fictif)');
    } else if (funcError && !funcError.message.includes('non trouvé')) {
      console.log('   ⚠️  Fonction existe mais erreur:', funcError.message);
    } else {
      console.log('   ✅ Fonction existe et répond');
    }

    // 2. Vérifier la structure de la table factures
    console.log('\n2️⃣  Vérification de la structure de la table factures...');
    const { data: facturesTest, error: facturesError } = await supabase
      .from('factures')
      .select('*')
      .limit(1);
    
    if (facturesError) {
      console.error('   ❌ Erreur accès factures:', facturesError.message);
    } else {
      console.log('   ✅ Table factures accessible');
      if (facturesTest && facturesTest.length > 0) {
        const sample = facturesTest[0];
        const hasSource = 'source' in sample;
        const hasPaiementId = 'paiement_id' in sample;
        console.log(`   ✅ Colonne 'source': ${hasSource ? '✅ présente' : '❌ absente'}`);
        console.log(`   ✅ Colonne 'paiement_id': ${hasPaiementId ? '✅ présente' : '❌ absente'}`);
      }
    }

    // 3. Vérifier les factures récentes créées par le workflow
    console.log('\n3️⃣  Vérification des factures récentes créées par le workflow...');
    const { data: recentFactures, error: recentError } = await supabase
      .from('factures')
      .select('id, numero, source, paiement_id, created_at, statut')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('   ❌ Erreur:', recentError.message);
    } else {
      console.log(`   📊 ${recentFactures?.length || 0} facture(s) récente(s) trouvée(s)`);
      if (recentFactures && recentFactures.length > 0) {
        const withSource = recentFactures.filter(f => f.source);
        const withPaiementId = recentFactures.filter(f => f.paiement_id);
        const sourcePlateforme = recentFactures.filter(f => f.source === 'plateforme');
        console.log(`   ✅ Factures avec 'source': ${withSource.length}/${recentFactures.length}`);
        console.log(`   ✅ Factures avec 'paiement_id': ${withPaiementId.length}/${recentFactures.length}`);
        console.log(`   ✅ Factures source='plateforme': ${sourcePlateforme.length}/${recentFactures.length}`);
        
        console.log('\n   📋 Détail des 5 dernières factures:');
        recentFactures.slice(0, 5).forEach((f, i) => {
          console.log(`      ${i + 1}. ${f.numero} - source: ${f.source || 'non défini'} - paiement_id: ${f.paiement_id ? 'oui' : 'non'} - statut: ${f.statut}`);
        });
      }
    }

    // 4. Vérifier les paiements récents
    console.log('\n4️⃣  Vérification des paiements récents...');
    const { data: recentPaiements, error: paiementsError } = await supabase
      .from('paiements')
      .select('id, statut, entreprise_id, montant_ttc, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (paiementsError) {
      console.error('   ❌ Erreur:', paiementsError.message);
    } else {
      console.log(`   📊 ${recentPaiements?.length || 0} paiement(s) récent(s) trouvé(s)`);
      if (recentPaiements && recentPaiements.length > 0) {
        const payes = recentPaiements.filter(p => p.statut === 'paye');
        console.log(`   ✅ Paiements avec statut='paye': ${payes.length}/${recentPaiements.length}`);
        
        // Vérifier si des factures existent pour ces paiements
        if (payes.length > 0) {
          console.log('\n   🔍 Vérification des factures pour les paiements payés...');
          for (const paiement of payes.slice(0, 5)) {
            const { data: facturesForPaiement } = await supabase
              .from('factures')
              .select('id, numero, source')
              .eq('paiement_id', paiement.id)
              .limit(1);
            
            if (facturesForPaiement && facturesForPaiement.length > 0) {
              const facture = facturesForPaiement[0];
              console.log(`      ✅ Paiement ${paiement.id.substring(0, 8)}... → Facture ${facture.numero} (source: ${facture.source || 'non défini'})`);
            } else {
              console.log(`      ❌ Paiement ${paiement.id.substring(0, 8)}... → AUCUNE FACTURE TROUVÉE`);
            }
          }
        }
      }
    }

    // 5. Résumé
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DU TEST\n');
    console.log('✅ Vérifications effectuées:');
    console.log('   1. Fonction creer_facture_et_abonnement_apres_paiement');
    console.log('   2. Structure de la table factures');
    console.log('   3. Factures récentes et leur source');
    console.log('   4. Paiements récents et leurs factures associées');
    console.log('\n💡 Si des paiements payés n\'ont pas de facture, le workflow ne fonctionne pas.');
    console.log('   Vérifiez les logs Supabase pour voir les erreurs du trigger.');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testWorkflow();

