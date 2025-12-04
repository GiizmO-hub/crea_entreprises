import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Essayer plusieurs fichiers d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEntreprise() {
  console.log('🔍 Vérification de l\'entreprise de test "SAS TEST"...\n');

  try {
    // 1. Vérifier l'entreprise
    const { data: entreprise, error: errEnt } = await supabase
      .from('entreprises')
      .select('id, nom, statut, statut_paiement, email')
      .eq('nom', 'SAS TEST')
      .single();

    if (errEnt || !entreprise) {
      console.log('❌ Entreprise "SAS TEST" non trouvée');
      return;
    }

    console.log('✅ Entreprise trouvée:');
    console.log(`   - ID: ${entreprise.id}`);
    console.log(`   - Nom: ${entreprise.nom}`);
    console.log(`   - Statut: ${entreprise.statut}`);
    console.log(`   - Statut paiement: ${entreprise.statut_paiement}`);
    console.log(`   - Email: ${entreprise.email}\n`);

    // 2. Vérifier le client
    const { data: client, error: errClient } = await supabase
      .from('clients')
      .select(`
        id, nom, prenom, email, statut, crm_actif,
        roles!inner(code, nom)
      `)
      .eq('entreprise_id', entreprise.id)
      .eq('email', 'jean.dupont@sastest.fr')
      .single();

    if (errClient || !client) {
      console.log('❌ Client "jean.dupont@sastest.fr" non trouvé');
    } else {
      console.log('✅ Client trouvé:');
      console.log(`   - Nom: ${client.nom} ${client.prenom}`);
      console.log(`   - Email: ${client.email}`);
      console.log(`   - Statut: ${client.statut}`);
      console.log(`   - CRM Actif: ${client.crm_actif}`);
      console.log(`   - Rôle: ${client.roles?.code || 'N/A'}\n`);
    }

    // 3. Vérifier l'espace membre
    const { data: espace, error: errEspace } = await supabase
      .from('espaces_membres_clients')
      .select('id, actif, email')
      .eq('entreprise_id', entreprise.id)
      .eq('email', 'jean.dupont@sastest.fr')
      .single();

    if (errEspace || !espace) {
      console.log('⚠️  Espace membre non trouvé');
    } else {
      console.log('✅ Espace membre trouvé:');
      console.log(`   - ID: ${espace.id}`);
      console.log(`   - Actif: ${espace.actif}\n`);
    }

    // 4. Vérifier l'abonnement
    const { data: abonnement, error: errAbonnement } = await supabase
      .from('abonnements')
      .select('id, statut, montant_mensuel, date_debut, date_fin')
      .eq('entreprise_id', entreprise.id)
      .single();

    if (errAbonnement || !abonnement) {
      console.log('⚠️  Abonnement non trouvé');
    } else {
      console.log('✅ Abonnement trouvé:');
      console.log(`   - ID: ${abonnement.id}`);
      console.log(`   - Statut: ${abonnement.statut}`);
      console.log(`   - Montant mensuel: ${abonnement.montant_mensuel}€\n`);
    }

    // 5. Vérifier les collaborateurs
    const { data: collaborateurs, error: errCollab } = await supabase
      .from('collaborateurs_entreprise')
      .select('id, nom, prenom, email, role, actif')
      .eq('entreprise_id', entreprise.id);

    if (errCollab) {
      console.log('⚠️  Erreur lors de la récupération des collaborateurs');
    } else {
      console.log(`✅ Collaborateurs trouvés: ${collaborateurs?.length || 0}`);
      collaborateurs?.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.nom} ${c.prenom} - ${c.email} (${c.role})`);
      });
      console.log('');
    }

    // 6. Vérifier les factures
    const { data: factures, error: errFactures } = await supabase
      .from('factures')
      .select('id, numero, statut, montant_ht, montant_ttc')
      .eq('entreprise_id', entreprise.id);

    if (errFactures) {
      console.log('⚠️  Erreur lors de la récupération des factures');
    } else {
      console.log(`✅ Factures trouvées: ${factures?.length || 0}`);
      factures?.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.numero} - ${f.statut} - ${f.montant_ttc}€ TTC`);
      });
      console.log('');
    }

    // 7. Vérifier les articles de stock
    const { data: stock, error: errStock } = await supabase
      .from('stock_items')
      .select('id, reference, nom, quantite_stock')
      .eq('entreprise_id', entreprise.id)
      .limit(5);

    if (errStock) {
      console.log('⚠️  Erreur lors de la récupération du stock');
    } else {
      console.log(`✅ Articles de stock trouvés: ${stock?.length || 0}`);
      stock?.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.reference} - ${s.nom} (Stock: ${s.quantite_stock})`);
      });
      console.log('');
    }

    // 8. Vérifier les opportunités CRM
    const { data: opportunites, error: errOpp } = await supabase
      .from('crm_opportunites')
      .select('id, nom, montant_estime, statut')
      .eq('entreprise_id', entreprise.id);

    if (errOpp) {
      console.log('⚠️  Erreur lors de la récupération des opportunités CRM');
    } else {
      console.log(`✅ Opportunités CRM trouvées: ${opportunites?.length || 0}`);
      opportunites?.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.nom} - ${o.montant_estime}€ - ${o.statut}`);
      });
      console.log('');
    }

    // 9. Vérifier les projets
    const { data: projets, error: errProjets } = await supabase
      .from('projets')
      .select('id, nom, statut, budget_previstoire')
      .eq('entreprise_id', entreprise.id);

    if (errProjets) {
      console.log('⚠️  Erreur lors de la récupération des projets');
    } else {
      console.log(`✅ Projets trouvés: ${projets?.length || 0}`);
      projets?.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.nom} - ${p.statut} - Budget: ${p.budget_previstoire}€`);
      });
      console.log('');
    }

    // 10. Vérifier les écritures comptables
    const { data: ecritures, error: errEcritures } = await supabase
      .from('ecritures_comptables')
      .select('id, numero_piece, montant, type_ecriture')
      .eq('entreprise_id', entreprise.id)
      .limit(5);

    if (errEcritures) {
      console.log('⚠️  Erreur lors de la récupération des écritures comptables');
    } else {
      console.log(`✅ Écritures comptables trouvées: ${ecritures?.length || 0}`);
      ecritures?.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.numero_piece} - ${e.montant}€ - ${e.type_ecriture}`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log('✅ VÉRIFICATION TERMINÉE');
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

testEntreprise();

