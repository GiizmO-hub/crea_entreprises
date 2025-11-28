/**
 * TEST DIRECT DU WORKFLOW VIA SQL/RPC
 * Utilise la service_role_key pour tester directement
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_PROJECT_REF = 'ewlozuwvrteopotfizcr';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;

console.log('🧪 TEST DU WORKFLOW DE PAIEMENT\n');
console.log('='.repeat(80));

if (!DB_PASSWORD) {
  console.error('❌ Mot de passe PostgreSQL requis');
  console.error('\n💡 Configurez: export SUPABASE_DB_PASSWORD="votre_mot_de_passe"');
  console.error('   Ou: export DATABASE_PASSWORD="votre_mot_de_passe"');
  console.error('\n📍 Pour obtenir le mot de passe:');
  console.error('   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/database\n');
  process.exit(1);
}

// Connexion PostgreSQL directe
const connectionString = `postgresql://postgres.${SUPABASE_PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

async function testWorkflow() {
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté\n');

    // 1. Lister les paiements récents
    console.log('1️⃣ Liste des paiements récents:\n');
    const { rows: paiements } = await client.query(`
      SELECT id, statut, montant_ttc, entreprise_id, created_at, 
             LEFT(notes, 100) as notes_preview
      FROM paiements
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (paiements.length === 0) {
      console.log('⚠️  Aucun paiement trouvé');
      await client.end();
      return;
    }

    paiements.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id}`);
      console.log(`   → Statut: ${p.statut}`);
      console.log(`   → Montant: ${p.montant_ttc}€`);
      console.log(`   → Date: ${new Date(p.created_at).toLocaleString('fr-FR')}`);
      console.log(`   → Notes: ${p.notes_preview || 'NULL'}`);
      console.log('');
    });

    // Trouver un paiement en attente ou payé pour tester
    const paiementTest = paiements.find(p => p.statut === 'en_attente' || p.statut === 'paye') || paiements[0];
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  🧪 TEST DU WORKFLOW AVEC LE PAIEMENT`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`\nPaiement ID: ${paiementTest.id}`);
    console.log(`Statut actuel: ${paiementTest.statut}\n`);

    // 2. Tester get_paiement_info_for_stripe
    console.log('2️⃣ Test de get_paiement_info_for_stripe...');
    const { rows: infoRows } = await client.query(`
      SELECT get_paiement_info_for_stripe($1::uuid) as result
    `, [paiementTest.id]);

    const info = infoRows[0]?.result;
    if (!info || !info.success) {
      console.error('❌ Erreur get_paiement_info_for_stripe:', info?.error);
      await client.end();
      return;
    }

    console.log('✅ Informations récupérées:');
    console.log(`   → Plan ID: ${info.plan_id || 'NON TROUVÉ'}`);
    console.log(`   → Entreprise: ${info.entreprise_nom || 'N/A'}`);
    console.log(`   → Montant TTC: ${info.montant_ttc}€\n`);

    // 3. Tester test_payment_workflow si la fonction existe
    console.log('3️⃣ Test du workflow complet...');
    
    try {
      const { rows: testRows } = await client.query(`
        SELECT test_payment_workflow($1::uuid) as result
      `, [paiementTest.id]);

      const testResult = testRows[0]?.result;
      console.log('✅ Résultat du test:');
      console.log(JSON.stringify(testResult, null, 2));
      console.log('');

      if (testResult?.success) {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ✅ WORKFLOW FONCTIONNE CORRECTEMENT');
        console.log('═══════════════════════════════════════════════════════════════════');
      } else {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('  ⚠️  PROBLÈMES DÉTECTÉS');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('Erreur:', testResult?.error || 'Erreur inconnue');
      }
    } catch (err) {
      console.log('⚠️  Fonction test_payment_workflow non disponible, test direct...\n');
      
      // Test direct de valider_paiement_carte_immediat
      console.log('4️⃣ Test direct de valider_paiement_carte_immediat...');
      const { rows: validationRows } = await client.query(`
        SELECT valider_paiement_carte_immediat($1::uuid, 'test_stripe_payment_id') as result
      `, [paiementTest.id]);

      const validationResult = validationRows[0]?.result;
      console.log('✅ Résultat de validation:');
      console.log(JSON.stringify(validationResult, null, 2));
      console.log('');

      if (validationResult?.success) {
        console.log('✅ Paiement validé avec succès !');
        console.log(`   → Facture ID: ${validationResult.facture_id || 'N/A'}`);
        console.log(`   → Abonnement ID: ${validationResult.abonnement_id || 'N/A'}`);
        console.log(`   → Espace membre ID: ${validationResult.espace_membre_id || 'N/A'}`);
      } else {
        console.error('❌ Erreur lors de la validation:', validationResult?.error);
      }
    }

    await client.end();
    console.log('\n✅ Test terminé !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

testWorkflow();

