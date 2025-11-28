import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function diagnosticComplet() {
  console.log('');
  console.log('====================================================');
  console.log('  🔍 DIAGNOSTIC WORKFLOW COMPLET');
  console.log('====================================================');
  console.log('');
  
  // 1. Vérifier que les fonctions existent
  console.log('📋 VÉRIFICATION DES FONCTIONS :');
  console.log('');
  
  const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN (
        'create_complete_entreprise_automated',
        'valider_paiement_carte_immediat',
        'creer_facture_et_abonnement_apres_paiement',
        'get_paiement_info_for_stripe'
      )
      ORDER BY proname;
    `
  }).catch(() => ({ data: null, error: 'RPC non disponible' }));
  
  if (funcError) {
    console.log('⚠️  Impossible de vérifier les fonctions via RPC');
  } else {
    console.log('✅ Fonctions vérifiées');
  }
  
  // 2. Vérifier l'Edge Function create-stripe-checkout
  console.log('');
  console.log('📋 VÉRIFICATION EDGE FUNCTION :');
  console.log('');
  
  try {
    // Tester l'existence de l'Edge Function
    const { data: funcTest, error: funcTestError } = await supabase.functions.invoke('create-stripe-checkout', {
      body: { test: true }
    });
    
    if (funcTestError) {
      if (funcTestError.message?.includes('404') || funcTestError.message?.includes('not found')) {
        console.log('❌ Edge Function "create-stripe-checkout" NON DÉPLOYÉE');
        console.log('   → Veuillez la déployer via Supabase Dashboard');
      } else {
        console.log('⚠️  Edge Function existe mais erreur:', funcTestError.message);
      }
    } else {
      console.log('✅ Edge Function "create-stripe-checkout" déployée');
    }
  } catch (e) {
    console.log('⚠️  Impossible de tester l\'Edge Function:', e.message);
  }
  
  // 3. Récupérer les entreprises récentes avec paiements
  console.log('');
  console.log('📋 ENTREPRISES RÉCENTES AVEC PAIEMENTS :');
  console.log('');
  
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('id, nom, statut, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (entreprisesError) {
    console.error('❌ Erreur récupération entreprises:', entreprisesError.message);
  } else if (entreprises && entreprises.length > 0) {
    console.log(`✅ ${entreprises.length} entreprise(s) récente(s) :`);
    
    for (const entreprise of entreprises) {
      console.log(`   → ${entreprise.nom} (${entreprise.statut})`);
      
      // Vérifier les paiements associés
      const { data: paiements } = await supabase
        .from('paiements')
        .select('id, statut, montant_ttc, notes')
        .eq('entreprise_id', entreprise.id)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (paiements && paiements.length > 0) {
        console.log(`      ${paiements.length} paiement(s) :`);
        paiements.forEach(p => {
          console.log(`        - ${p.statut} | ${p.montant_ttc}€`);
          if (p.notes) {
            try {
              const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
              if (notes.plan_id) {
                console.log(`          Plan ID: ${notes.plan_id}`);
              }
            } catch (e) {
              // Ignorer
            }
          }
        });
      } else {
        console.log(`      ❌ AUCUN PAIEMENT créé`);
      }
      
      // Vérifier les factures
      const { data: factures } = await supabase
        .from('factures')
        .select('id, numero, statut')
        .eq('entreprise_id', entreprise.id)
        .limit(1);
      
      if (factures && factures.length > 0) {
        console.log(`      ✅ Facture créée: ${factures[0].numero}`);
      } else {
        console.log(`      ❌ AUCUNE FACTURE créée`);
      }
      
      // Vérifier les abonnements
      const { data: abonnements } = await supabase
        .from('abonnements')
        .select('id, statut, plan_id')
        .eq('entreprise_id', entreprise.id)
        .limit(1);
      
      if (abonnements && abonnements.length > 0) {
        console.log(`      ✅ Abonnement créé: ${abonnements[0].statut}`);
      } else {
        console.log(`      ❌ AUCUN ABONNEMENT créé`);
      }
      
      console.log('');
    }
  } else {
    console.log('ℹ️  Aucune entreprise récente trouvée');
  }
  
  console.log('');
  console.log('====================================================');
  console.log('  FIN DU DIAGNOSTIC');
  console.log('====================================================');
  console.log('');
}

diagnosticComplet();
