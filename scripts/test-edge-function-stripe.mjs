import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_ANON_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFunction() {
  try {
    console.log('🧪 TEST DE L\'EDGE FUNCTION create-stripe-checkout\n');
    console.log('='.repeat(80));
    
    // 1. Vérifier la connexion Supabase
    console.log('\n📝 Étape 1: Vérification de la connexion Supabase...');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Clé: ${supabaseKey.substring(0, 20)}...`);
    
    const { data: healthCheck, error: healthError } = await supabase
      .from('entreprises')
      .select('id')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Erreur de connexion:', healthError.message);
      return;
    }
    console.log('   ✅ Connexion Supabase OK');
    
    // 2. Obtenir un paiement existant pour tester
    console.log('\n📝 Étape 2: Recherche d\'un paiement existant...');
    const { data: paiements, error: err1 } = await supabase
      .from('paiements')
      .select('id, entreprise_id, montant_ttc, statut')
      .eq('statut', 'en_attente')
      .limit(1)
      .single();
    
    if (err1 || !paiements) {
      console.log('   ⚠️  Aucun paiement en attente trouvé');
      console.log('   💡 Création d\'un paiement de test...');
      
      // Créer un paiement de test
      const { data: entreprise } = await supabase
        .from('entreprises')
        .select('id')
        .limit(1)
        .single();
      
      if (!entreprise) {
        console.error('❌ Aucune entreprise trouvée pour créer un paiement de test');
        return;
      }
      
      const { data: nouveauPaiement, error: err2 } = await supabase
        .from('paiements')
        .insert({
          entreprise_id: entreprise.id,
          type_paiement: 'abonnement',
          montant_ht: 299.00,
          montant_tva: 59.80,
          montant_ttc: 358.80,
          methode_paiement: 'stripe',
          statut: 'en_attente'
        })
        .select()
        .single();
      
      if (err2 || !nouveauPaiement) {
        console.error('❌ Erreur création paiement de test:', err2);
        return;
      }
      
      console.log(`   ✅ Paiement de test créé: ${nouveauPaiement.id}`);
      
      // Utiliser ce paiement pour le test
      const paiementId = nouveauPaiement.id;
      
      // 3. Tester l'appel à l'Edge Function
      console.log('\n📝 Étape 3: Test de l\'appel à l\'Edge Function...');
      console.log(`   Paiement ID: ${paiementId}`);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          paiement_id: paiementId,
          success_url: `${supabaseUrl}/payment-success?paiement_id=${paiementId}`,
          cancel_url: `${supabaseUrl}/payment-cancel?paiement_id=${paiementId}`,
        },
      });
      
      if (error) {
        console.error('❌ Erreur Edge Function:', error);
        console.error('   Message:', error.message);
        console.error('   Status:', error.status);
        console.error('   Context:', error.context);
        
        // Analyser l'erreur
        if (error.message.includes('Function not found')) {
          console.error('\n💡 SOLUTION: L\'Edge Function n\'est pas déployée.');
          console.error('   Déployez-la avec: supabase functions deploy create-stripe-checkout');
        } else if (error.message.includes('Failed to fetch')) {
          console.error('\n💡 SOLUTION: Problème de réseau ou Edge Function non accessible.');
          console.error('   Vérifiez que l\'Edge Function est déployée et accessible.');
        }
        
        return;
      }
      
      if (!data || !data.url) {
        console.error('❌ Réponse invalide de l\'Edge Function:', data);
        return;
      }
      
      console.log('   ✅ Edge Function répond correctement!');
      console.log(`   Session ID: ${data.session_id}`);
      console.log(`   URL: ${data.url.substring(0, 50)}...`);
      
      console.log('\n✅ TEST RÉUSSI ! L\'Edge Function fonctionne correctement.\n');
      
    } else {
      console.log(`   ✅ Paiement trouvé: ${paiements.id}`);
      console.log('   ⚠️  Utilisez ce paiement pour tester manuellement dans l\'interface');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error(error.stack);
  }
}

testEdgeFunction();


