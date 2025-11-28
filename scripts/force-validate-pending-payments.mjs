#!/usr/bin/env node
/**
 * Script pour forcer la validation de tous les paiements en attente
 * 
 * Utile si le webhook Stripe n'a pas fonctionné ou si la page PaymentSuccess n'a pas été appelée
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function forceValidatePayments() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 VALIDATION FORCÉE DES PAIEMENTS EN ATTENTE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer tous les paiements en attente
    console.log('📋 Recherche des paiements en attente...\n');
    
    const { data: paiements, error: paiementsError } = await supabase
      .from('paiements')
      .select('*')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false });

    if (paiementsError) {
      throw new Error(`Erreur récupération paiements: ${paiementsError.message}`);
    }

    if (!paiements || paiements.length === 0) {
      console.log('✅ Aucun paiement en attente trouvé\n');
      return;
    }

    console.log(`✅ ${paiements.length} paiement(s) en attente trouvé(s)\n`);

    let successCount = 0;
    let errorCount = 0;

    // 2. Valider chaque paiement
    for (const paiement of paiements) {
      console.log(`─`.repeat(60));
      console.log(`💳 Traitement paiement: ${paiement.id}`);
      console.log(`   → Entreprise ID: ${paiement.entreprise_id || 'NULL'}`);
      console.log(`   → Montant: ${paiement.montant_ttc}€`);
      console.log(`   → Créé le: ${new Date(paiement.created_at).toLocaleString('fr-FR')}`);
      
      try {
        // Appeler valider_paiement_carte_immediat
        console.log(`   🔄 Appel de valider_paiement_carte_immediat...`);
        
        const { data: result, error: validationError } = await supabase.rpc('valider_paiement_carte_immediat', {
          p_paiement_id: paiement.id,
          p_stripe_payment_id: paiement.stripe_payment_id || `manual_${Date.now()}`
        });

        if (validationError) {
          console.error(`   ❌ Erreur validation: ${validationError.message}`);
          console.error(`      Code: ${validationError.code}`);
          console.error(`      Détails: ${validationError.details || 'N/A'}`);
          errorCount++;
          continue;
        }

        if (result && result.success) {
          console.log(`   ✅ Paiement validé avec succès !`);
          if (result.facture_id) {
            console.log(`      → Facture: ${result.facture_id}`);
          }
          if (result.abonnement_id) {
            console.log(`      → Abonnement: ${result.abonnement_id}`);
          }
          if (result.espace_membre_id) {
            console.log(`      → Espace membre: ${result.espace_membre_id}`);
          }
          successCount++;
        } else {
          console.error(`   ❌ Validation échouée: ${result?.error || 'Erreur inconnue'}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`   ❌ Erreur fatale: ${error.message}`);
        errorCount++;
      }
      
      console.log('');
      
      // Attendre un peu entre chaque paiement
      if (paiements.indexOf(paiement) < paiements.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 3. Résumé
    console.log('═'.repeat(60));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Paiements validés: ${successCount}/${paiements.length}`);
    console.log(`   ❌ Erreurs: ${errorCount}/${paiements.length}`);
    console.log('═'.repeat(60));
    console.log('');

  } catch (error) {
    console.error('\n❌ ERREUR lors de la validation:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

forceValidatePayments().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

