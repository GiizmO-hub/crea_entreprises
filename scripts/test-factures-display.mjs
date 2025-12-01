#!/usr/bin/env node

/**
 * SCRIPT DE TEST - CRÉATION DE DONNÉES FICTIVES POUR TESTER L'AFFICHAGE DES FACTURES
 * 
 * Ce script crée des données de test pour vérifier que les factures s'affichent correctement
 * sur la plateforme et dans l'espace client.
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

async function createTestData() {
  console.log('🧪 CRÉATION DE DONNÉES DE TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Créer un utilisateur de test (plateforme)
    console.log('1️⃣  Création utilisateur plateforme...');
    const { data: userPlateforme, error: userError } = await supabase.auth.admin.createUser({
      email: 'test-plateforme@example.com',
      password: 'Test123456!',
      email_confirm: true,
      user_metadata: {
        role: 'super_admin',
      },
    });

    if (userError && !userError.message.includes('already registered')) {
      console.error('   ❌ Erreur création utilisateur:', userError.message);
    } else {
      console.log('   ✅ Utilisateur plateforme créé/trouvé');
    }

    // 2. Créer une entreprise
    console.log('\n2️⃣  Création entreprise...');
    let entreprise;
    const { data: entrepriseData, error: entrepriseError } = await supabase
      .from('entreprises')
      .insert({
        user_id: userPlateforme?.user?.id || userPlateforme?.id, // Utiliser l'ID de l'utilisateur créé
        nom: 'Entreprise Test Factures',
        email: 'entreprise-test@example.com',
        telephone: '0123456789',
        adresse: '123 Rue Test',
        code_postal: '75001',
        ville: 'Paris',
        siret: '12345678901234',
      })
      .select()
      .single();

    if (entrepriseError) {
      if (entrepriseError.code === '23505') {
        // Entreprise existe déjà, la récupérer
        const { data: existing } = await supabase
          .from('entreprises')
          .select('*')
          .eq('nom', 'Entreprise Test Factures')
          .single();
        console.log('   ✅ Entreprise existe déjà, récupération...');
        entreprise = existing;
      } else {
        throw entrepriseError;
      }
    } else {
      entreprise = entrepriseData;
      console.log('   ✅ Entreprise créée:', entreprise.id);
    }

    // 3. Créer un client
    console.log('\n3️⃣  Création client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        entreprise_id: entreprise.id,
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.dupont@example.com',
        telephone: '0987654321',
        adresse: '456 Avenue Client',
        code_postal: '75002',
        ville: 'Paris',
      })
      .select()
      .single();

    if (clientError) {
      if (clientError.code === '23505') {
        const { data: existing } = await supabase
          .from('clients')
          .select('*')
          .eq('email', 'jean.dupont@example.com')
          .single();
        console.log('   ✅ Client existe déjà, récupération...');
        client = existing;
      } else {
        throw clientError;
      }
    } else {
      console.log('   ✅ Client créé:', client.id);
    }

    // 4. Créer des factures de test (PLATEFORME)
    console.log('\n4️⃣  Création factures PLATEFORME...');
    const facturesPlateforme = [
      {
        entreprise_id: entreprise.id,
        client_id: client.id,
        numero: `FACT-${new Date().getFullYear()}-0001`,
        type: 'facture',
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        montant_ht: 1000,
        tva: 200,
        montant_ttc: 1200,
        statut: 'envoyee',
        source: 'plateforme', // ✅ IMPORTANT
        notes: 'Facture de test créée par la plateforme',
      },
      {
        entreprise_id: entreprise.id,
        client_id: client.id,
        numero: `FACT-${new Date().getFullYear()}-0002`,
        type: 'facture',
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        montant_ht: 2000,
        tva: 400,
        montant_ttc: 2400,
        statut: 'payee',
        source: 'plateforme', // ✅ IMPORTANT
        notes: 'Facture payée de test',
      },
      {
        entreprise_id: entreprise.id,
        client_id: client.id,
        numero: `PROFORMA-${new Date().getFullYear()}-0001`,
        type: 'proforma',
        date_emission: new Date().toISOString().split('T')[0],
        montant_ht: 500,
        tva: 100,
        montant_ttc: 600,
        statut: 'brouillon',
        source: 'plateforme', // ✅ IMPORTANT
        notes: 'Proforma de test',
      },
    ];

    const { data: facturesCreated, error: facturesError } = await supabase
      .from('factures')
      .insert(facturesPlateforme)
      .select();

    if (facturesError) {
      console.error('   ⚠️  Erreur création factures:', facturesError.message);
      // Vérifier si elles existent déjà
      const { data: existing } = await supabase
        .from('factures')
        .select('*')
        .eq('entreprise_id', entreprise.id)
        .eq('source', 'plateforme');
      console.log(`   📊 Factures existantes avec source='plateforme': ${existing?.length || 0}`);
    } else {
      console.log(`   ✅ ${facturesCreated.length} facture(s) PLATEFORME créée(s)`);
    }

    // 5. Créer des factures de test (CLIENT)
    console.log('\n5️⃣  Création factures CLIENT...');
    const facturesClient = [
      {
        entreprise_id: entreprise.id,
        client_id: client.id,
        numero: `FACT-${new Date().getFullYear()}-0003`,
        type: 'facture',
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        montant_ht: 1500,
        tva: 300,
        montant_ttc: 1800,
        statut: 'envoyee',
        source: 'client', // ✅ IMPORTANT
        notes: 'Facture de test créée par le client',
      },
    ];

    const { data: facturesClientCreated, error: facturesClientError } = await supabase
      .from('factures')
      .insert(facturesClient)
      .select();

    if (facturesClientError) {
      console.error('   ⚠️  Erreur création factures client:', facturesClientError.message);
    } else {
      console.log(`   ✅ ${facturesClientCreated.length} facture(s) CLIENT créée(s)`);
    }

    // 6. Vérifier les factures créées
    console.log('\n6️⃣  Vérification des factures...');
    const { data: allFactures, error: checkError } = await supabase
      .from('factures')
      .select('id, numero, source, statut, montant_ttc')
      .eq('entreprise_id', entreprise.id);

    if (checkError) {
      console.error('   ❌ Erreur vérification:', checkError.message);
    } else {
      console.log(`   📊 Total factures pour l'entreprise: ${allFactures.length}`);
      const bySource = allFactures.reduce((acc, f) => {
        acc[f.source || 'non défini'] = (acc[f.source || 'non défini'] || 0) + 1;
        return acc;
      }, {});
      console.log('   📊 Répartition par source:', JSON.stringify(bySource, null, 2));
    }

    // 7. Résumé
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ DONNÉES DE TEST CRÉÉES\n');
    console.log('📋 RÉSUMÉ:');
    console.log(`   - Entreprise: ${entreprise.nom} (${entreprise.id})`);
    console.log(`   - Client: ${client.prenom} ${client.nom} (${client.id})`);
    console.log(`   - Factures créées: ${allFactures?.length || 0}`);
    console.log('\n🔍 TESTEZ MAINTENANT:');
    console.log('   1. Connectez-vous en tant que plateforme');
    console.log('   2. Allez dans l\'onglet Factures');
    console.log('   3. Sélectionnez l\'entreprise "Entreprise Test Factures"');
    console.log('   4. Vérifiez que les factures avec source="plateforme" s\'affichent');
    console.log('   5. Vérifiez que les factures avec source="client" NE s\'affichent PAS');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTestData();

