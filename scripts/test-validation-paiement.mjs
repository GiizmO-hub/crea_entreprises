#!/usr/bin/env node
/**
 * Script pour tester la validation d'un paiement et voir où ça bloque
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST VALIDATION PAIEMENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver un paiement récent en attente ou payé
    console.log('📋 Recherche d\'un paiement récent...\n');
    const { data: paiements, error: paiementsError } = await supabase
      .from('paiements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (paiementsError) {
      console.error('❌ Erreur récupération paiements:', paiementsError);
      return;
    }

    if (!paiements || paiements.length === 0) {
      console.log('⚠️  Aucun paiement trouvé');
      return;
    }

    // Prendre le premier paiement qui a un plan_id dans les notes
    let paiementTest = null;
    for (const p of paiements) {
      if (p.notes) {
        try {
          const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
          if (notes.plan_id && notes.entreprise_id) {
            paiementTest = p;
            break;
          }
        } catch (e) {
          // Ignorer
        }
      }
    }

    if (!paiementTest) {
      console.log('⚠️  Aucun paiement avec plan_id trouvé');
      return;
    }

    console.log(`✅ Paiement sélectionné: ${paiementTest.id}`);
    console.log(`   Statut: ${paiementTest.statut}`);
    console.log(`   Montant: ${paiementTest.montant_ttc}€`);
    console.log('');

    // Analyser les notes
    let notesParsed = null;
    if (paiementTest.notes) {
      try {
        notesParsed = typeof paiementTest.notes === 'string' 
          ? JSON.parse(paiementTest.notes) 
          : paiementTest.notes;
        console.log('📝 Notes du paiement:');
        console.log(JSON.stringify(notesParsed, null, 2));
        console.log('');
      } catch (e) {
        console.log('⚠️  Erreur parsing notes:', e.message);
      }
    }

    // 2. Vérifier l'état actuel
    console.log('📊 État actuel:');
    
    if (notesParsed?.entreprise_id) {
      const { data: entreprise, error: entError } = await supabase
        .from('entreprises')
        .select('id, nom, statut')
        .eq('id', notesParsed.entreprise_id)
        .maybeSingle();
      
      console.log(`   Entreprise: ${entreprise ? `${entreprise.nom} (${entreprise.statut})` : '❌ NON TROUVÉE'}`);
    }

    if (notesParsed?.client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, nom, prenom, email')
        .eq('id', notesParsed.client_id)
        .maybeSingle();
      
      const clientName = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : null;
      console.log(`   Client: ${client ? `${clientName} (${client.email})` : '❌ NON TROUVÉ'}`);
    }

    // Vérifier facture
    if (notesParsed?.entreprise_id) {
      const { data: factures, error: facturesError } = await supabase
        .from('factures')
        .select('id, numero, statut')
        .eq('entreprise_id', notesParsed.entreprise_id)
        .limit(1);
      
      if (facturesError) {
        console.log(`   Facture: ❌ Erreur: ${facturesError.message}`);
      } else {
        console.log(`   Facture: ${factures && factures.length > 0 ? `${factures[0].numero} (${factures[0].statut})` : '❌ NON TROUVÉE'}`);
      }
    }

    // Vérifier abonnement
    if (notesParsed?.auth_user_id) {
      const { data: abonnements, error: abonnementsError } = await supabase
        .from('abonnements')
        .select('id, statut, plan_id')
        .eq('client_id', notesParsed.auth_user_id)
        .limit(1);
      
      if (abonnementsError) {
        console.log(`   Abonnement: ❌ Erreur: ${abonnementsError.message}`);
      } else {
        console.log(`   Abonnement: ${abonnements && abonnements.length > 0 ? `${abonnements[0].id} (${abonnements[0].statut})` : '❌ NON TROUVÉ'}`);
      }
    }

    // Vérifier espace membre
    if (notesParsed?.client_id) {
      const { data: espaces, error: espacesError } = await supabase
        .from('espaces_membres_clients')
        .select('id, statut_compte, actif')
        .eq('client_id', notesParsed.client_id)
        .limit(1);
      
      if (espacesError) {
        console.log(`   Espace membre: ❌ Erreur: ${espacesError.message}`);
      } else {
        console.log(`   Espace membre: ${espaces && espaces.length > 0 ? `${espaces[0].id} (${espaces[0].statut_compte})` : '❌ NON TROUVÉ'}`);
      }
    }

    console.log('');

    // 3. Tester la validation
    console.log('🔄 Appel de valider_paiement_carte_immediat...\n');
    const { data: result, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
      p_paiement_id: paiementTest.id,
      p_stripe_payment_id: null
    });

    if (validationError) {
      console.error('❌ ERREUR lors de la validation:');
      console.error(`   Code: ${validationError.code}`);
      console.error(`   Message: ${validationError.message}`);
      console.error(`   Détails: ${validationError.details || 'N/A'}`);
      console.error(`   Hint: ${validationError.hint || 'N/A'}`);
    } else {
      console.log('✅ Résultat de la validation:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');

      if (result && result.success) {
        console.log('🎉 ✅ WORKFLOW COMPLET RÉUSSI !');
        console.log(`   → Facture ID: ${result.facture_id || 'N/A'}`);
        console.log(`   → Abonnement ID: ${result.abonnement_id || 'N/A'}`);
        console.log(`   → Espace membre ID: ${result.espace_membre_id || 'N/A'}`);
      } else {
        console.log('⚠️  WORKFLOW PARTIEL OU ERREUR:');
        console.log(`   → Erreur: ${result?.error || 'N/A'}`);
        console.log(`   → Paiement validé: ${result?.paiement_valide || false}`);
      }
    }

    console.log('\n✅ Test terminé !\n');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
}

testValidation();

