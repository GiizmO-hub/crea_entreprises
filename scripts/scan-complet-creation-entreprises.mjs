import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function scanComplet() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 SCAN COMPLET - CRÉATION D\'ENTREPRISES');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Scan des entreprises
  console.log('1️⃣ ENTREPRISES');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (entreprisesError) {
    console.error('❌ Erreur chargement entreprises:', entreprisesError);
  } else {
    console.log(`✅ ${entreprises?.length || 0} entreprise(s) trouvée(s)\n`);
    
    if (entreprises && entreprises.length > 0) {
      for (const entreprise of entreprises) {
        console.log(`📦 Entreprise: ${entreprise.nom}`);
        console.log(`   ID: ${entreprise.id}`);
        console.log(`   User ID: ${entreprise.user_id}`);
        console.log(`   Statut: ${entreprise.statut}`);
        console.log(`   Créée le: ${new Date(entreprise.created_at).toLocaleString('fr-FR')}`);
        
        // 2. Vérifier le client associé
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .eq('entreprise_id', entreprise.id)
          .limit(5);

        console.log(`   👥 Clients associés: ${clients?.length || 0}`);
        if (clients && clients.length > 0) {
          clients.forEach(client => {
            console.log(`      - ${client.nom || ''} ${client.prenom || ''} (${client.email})`);
            console.log(`        ID: ${client.id}`);
          });
        } else {
          console.log(`      ⚠️  Aucun client trouvé pour cette entreprise`);
        }

        // 3. Vérifier les paiements
        const { data: paiements } = await supabase
          .from('paiements')
          .select('*')
          .eq('entreprise_id', entreprise.id)
          .order('created_at', { ascending: false })
          .limit(5);

        console.log(`   💳 Paiements associés: ${paiements?.length || 0}`);
        if (paiements && paiements.length > 0) {
          paiements.forEach(paiement => {
            console.log(`      - ${paiement.statut} | ${paiement.montant}€ | ${new Date(paiement.created_at).toLocaleString('fr-FR')}`);
            console.log(`        ID: ${paiement.id}`);
            if (paiement.notes) {
              try {
                const notes = typeof paiement.notes === 'string' ? JSON.parse(paiement.notes) : paiement.notes;
                console.log(`        Notes:`, JSON.stringify(notes, null, 2));
              } catch (e) {
                console.log(`        Notes (raw): ${paiement.notes}`);
              }
            }
          });
        } else {
          console.log(`      ⚠️  Aucun paiement trouvé pour cette entreprise`);
        }

        // 4. Vérifier les factures
        const { data: factures } = await supabase
          .from('factures')
          .select('*')
          .eq('entreprise_id', entreprise.id)
          .order('created_at', { ascending: false })
          .limit(5);

        console.log(`   📄 Factures associées: ${factures?.length || 0}`);
        if (factures && factures.length > 0) {
          factures.forEach(facture => {
            console.log(`      - ${facture.numero} | ${facture.statut} | ${facture.montant_ttc}€ TTC`);
            console.log(`        ID: ${facture.id}`);
          });
        } else {
          console.log(`      ⚠️  Aucune facture trouvée pour cette entreprise`);
        }

        // 5. Vérifier les abonnements
        const { data: abonnements } = await supabase
          .from('abonnements')
          .select('*')
          .eq('entreprise_id', entreprise.id)
          .order('created_at', { ascending: false })
          .limit(5);

        console.log(`   🔔 Abonnements associés: ${abonnements?.length || 0}`);
        if (abonnements && abonnements.length > 0) {
          abonnements.forEach(abonnement => {
            console.log(`      - Plan: ${abonnement.plan_id} | Statut: ${abonnement.statut}`);
            console.log(`        ID: ${abonnement.id}`);
            console.log(`        Date début: ${abonnement.date_debut ? new Date(abonnement.date_debut).toLocaleString('fr-FR') : 'N/A'}`);
            console.log(`        Client ID: ${abonnement.client_id || 'N/A'}`);
          });
        } else {
          console.log(`      ⚠️  Aucun abonnement trouvé pour cette entreprise`);
        }

        // 6. Vérifier les espaces membres clients
        if (clients && clients.length > 0) {
          for (const client of clients) {
            const { data: espaces } = await supabase
              .from('espaces_membres_clients')
              .select('*')
              .eq('client_id', client.id)
              .limit(5);

            if (espaces && espaces.length > 0) {
              console.log(`   🏠 Espaces membres pour client ${client.email}: ${espaces.length}`);
              espaces.forEach(espace => {
                console.log(`      - Statut: ${espace.statut_compte} | Actif: ${espace.actif}`);
                console.log(`        ID: ${espace.id}`);
                console.log(`        User ID: ${espace.user_id}`);
                if (espace.modules_actifs) {
                  const modules = typeof espace.modules_actifs === 'string' 
                    ? JSON.parse(espace.modules_actifs) 
                    : espace.modules_actifs;
                  const moduleKeys = Object.keys(modules || {});
                  console.log(`        Modules actifs: ${moduleKeys.length} (${moduleKeys.slice(0, 5).join(', ')}...)`);
                }
              });
            }
          }
        }

        console.log('');
      }
    } else {
      console.log('⚠️  Aucune entreprise trouvée dans la base de données\n');
    }
  }

  // 7. Statistiques globales
  console.log('\n2️⃣ STATISTIQUES GLOBALES');
  console.log('─────────────────────────────────────────────────────────────');

  const { count: countEntreprises } = await supabase
    .from('entreprises')
    .select('*', { count: 'exact', head: true });

  const { count: countClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });

  const { count: countPaiements } = await supabase
    .from('paiements')
    .select('*', { count: 'exact', head: true });

  const { count: countFactures } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true });

  const { count: countAbonnements } = await supabase
    .from('abonnements')
    .select('*', { count: 'exact', head: true });

  const { count: countEspaces } = await supabase
    .from('espaces_membres_clients')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total entreprises: ${countEntreprises || 0}`);
  console.log(`📊 Total clients: ${countClients || 0}`);
  console.log(`📊 Total paiements: ${countPaiements || 0}`);
  console.log(`📊 Total factures: ${countFactures || 0}`);
  console.log(`📊 Total abonnements: ${countAbonnements || 0}`);
  console.log(`📊 Total espaces membres: ${countEspaces || 0}`);

  // 8. Vérifier les incohérences
  console.log('\n3️⃣ VÉRIFICATION DES INCOHÉRENCES');
  console.log('─────────────────────────────────────────────────────────────');

  // Entreprises sans clients
  const { data: entreprisesSansClients } = await supabase
    .from('entreprises')
    .select('id, nom')
    .not('id', 'in', 
      supabase.from('clients').select('entreprise_id')
    );

  if (entreprisesSansClients && entreprisesSansClients.length > 0) {
    console.log(`⚠️  Entreprises sans clients: ${entreprisesSansClients.length}`);
    entreprisesSansClients.forEach(e => console.log(`   - ${e.nom} (${e.id})`));
  } else {
    console.log(`✅ Toutes les entreprises ont des clients`);
  }

  // Paiements "en attente"
  const { data: paiementsEnAttente } = await supabase
    .from('paiements')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(10);

  if (paiementsEnAttente && paiementsEnAttente.length > 0) {
    console.log(`\n⚠️  Paiements "en attente": ${paiementsEnAttente.length}`);
    paiementsEnAttente.forEach(p => {
      console.log(`   - ${p.id} | ${p.montant}€ | ${new Date(p.created_at).toLocaleString('fr-FR')}`);
      console.log(`     Entreprise ID: ${p.entreprise_id || 'N/A'}`);
    });
  } else {
    console.log(`✅ Aucun paiement "en attente"`);
  }

  // Clients sans espaces membres
  const { data: clientsSansEspaces } = await supabase
    .from('clients')
    .select('id, nom, prenom, email, entreprise_id')
    .not('id', 'in',
      supabase.from('espaces_membres_clients').select('client_id')
    );

  if (clientsSansEspaces && clientsSansEspaces.length > 0) {
    console.log(`\n⚠️  Clients sans espaces membres: ${clientsSansEspaces.length}`);
    clientsSansEspaces.forEach(c => {
      console.log(`   - ${c.nom} ${c.prenom} (${c.email})`);
      console.log(`     Entreprise ID: ${c.entreprise_id}`);
    });
  } else {
    console.log(`✅ Tous les clients ont des espaces membres`);
  }

  console.log('\n✅ Scan terminé !\n');
}

scanComplet().catch(console.error);

