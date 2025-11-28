import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testWorkflow() {
  console.log('');
  console.log('====================================================');
  console.log('  🔍 DIAGNOSTIC WORKFLOW 40%');
  console.log('====================================================');
  console.log('');
  
  // 1. Vérifier que les fonctions existent
  console.log('📋 VÉRIFICATION DES FONCTIONS :');
  console.log('');
  
  const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname IN ('valider_paiement_carte_immediat', 'creer_facture_et_abonnement_apres_paiement')
      ORDER BY proname;
    `
  }).catch(() => ({ data: null, error: 'RPC non disponible' }));
  
  if (funcError) {
    console.log('⚠️  Impossible de vérifier les fonctions via RPC');
    console.log('   Vérification manuelle nécessaire dans le dashboard Supabase');
  } else {
    console.log('✅ Fonctions vérifiées');
  }
  
  // 2. Récupérer les paiements récents en attente
  console.log('');
  console.log('📋 PAIEMENTS RÉCENTS EN ATTENTE :');
  console.log('');
  
  const { data: paiements, error: paiementsError } = await supabase
    .from('paiements')
    .select('id, statut, montant_ttc, entreprise_id, notes, created_at')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (paiementsError) {
    console.error('❌ Erreur récupération paiements:', paiementsError.message);
  } else if (paiements && paiements.length > 0) {
    console.log(`✅ ${paiements.length} paiement(s) en attente trouvé(s) :`);
    paiements.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p.id.substring(0, 8)}... | Statut: ${p.statut} | Montant: ${p.montant_ttc}€`);
      console.log(`      Entreprise: ${p.entreprise_id ? p.entreprise_id.substring(0, 8) + '...' : 'NULL'}`);
    });
  } else {
    console.log('ℹ️  Aucun paiement en attente trouvé');
  }
  
  // 3. Récupérer les paiements récents validés
  console.log('');
  console.log('📋 PAIEMENTS RÉCENTS VALIDÉS (dernières 24h) :');
  console.log('');
  
  const { data: paiementsValides, error: paiementsValidesError } = await supabase
    .from('paiements')
    .select('id, statut, montant_ttc, entreprise_id, notes, created_at')
    .eq('statut', 'paye')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: false })
    .limit(5);
  
  if (paiementsValidesError) {
    console.error('❌ Erreur récupération paiements validés:', paiementsValidesError.message);
  } else if (paiementsValides && paiementsValides.length > 0) {
    console.log(`✅ ${paiementsValides.length} paiement(s) validé(s) récemment :`);
    
    for (const p of paiementsValides) {
      console.log(`   → ID: ${p.id.substring(0, 8)}... | Montant: ${p.montant_ttc}€`);
      
      // Vérifier si facture créée
      const { data: factures } = await supabase
        .from('factures')
        .select('id, numero, statut')
        .contains('notes', { paiement_id: p.id })
        .limit(1);
      
      if (factures && factures.length > 0) {
        console.log(`      ✅ Facture créée: ${factures[0].numero}`);
      } else {
        console.log(`      ❌ AUCUNE FACTURE créée`);
      }
      
      // Vérifier si abonnement créé
      if (p.entreprise_id) {
        const { data: abonnements } = await supabase
          .from('abonnements')
          .select('id, statut, plan_id')
          .eq('entreprise_id', p.entreprise_id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (abonnements && abonnements.length > 0) {
          console.log(`      ✅ Abonnement créé: ${abonnements[0].id.substring(0, 8)}...`);
        } else {
          console.log(`      ❌ AUCUN ABONNEMENT créé`);
        }
        
        // Vérifier si espace membre créé
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('entreprise_id', p.entreprise_id)
          .limit(1);
        
        if (clients && clients.length > 0) {
          const { data: espaces } = await supabase
            .from('espaces_membres_clients')
            .select('id, role, actif')
            .eq('client_id', clients[0].id)
            .eq('entreprise_id', p.entreprise_id)
            .limit(1);
          
          if (espaces && espaces.length > 0) {
            console.log(`      ✅ Espace membre créé: ${espaces[0].role || 'N/A'}`);
          } else {
            console.log(`      ❌ AUCUN ESPACE MEMBRE créé`);
          }
        }
      }
      
      console.log('');
    }
  } else {
    console.log('ℹ️  Aucun paiement validé récemment');
  }
  
  console.log('');
  console.log('====================================================');
  console.log('  FIN DU DIAGNOSTIC');
  console.log('====================================================');
  console.log('');
  console.log('💡 RECOMMANDATIONS :');
  console.log('   1. Si des paiements en attente : tester valider_paiement_carte_immediat');
  console.log('   2. Si factures/abonnements manquants : vérifier les logs PostgreSQL');
  console.log('   3. Vérifier que les fonctions sont bien créées dans le dashboard Supabase');
  console.log('');
}

testWorkflow();

