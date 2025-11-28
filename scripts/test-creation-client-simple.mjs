#!/usr/bin/env node
/**
 * Script de test simple pour la création de client
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCreationClient() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 TEST CRÉATION CLIENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Tenter de se connecter avec un utilisateur
  const email = process.env.TEST_EMAIL || 'meddecyril@icloud.com';
  const password = process.env.TEST_PASSWORD || '21052024_Aa!';

  console.log(`🔐 Tentative de connexion avec: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Erreur de connexion:', authError.message);
    process.exit(1);
  }

  console.log('✅ Connexion réussie !');
  console.log(`   User ID: ${authData.user.id}\n`);

  // 2. Récupérer les entreprises de l'utilisateur
  console.log('📋 Récupération des entreprises...');
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('id, nom, user_id')
    .eq('user_id', authData.user.id);

  if (entreprisesError) {
    console.error('❌ Erreur lors de la récupération des entreprises:', entreprisesError);
    process.exit(1);
  }

  if (!entreprises || entreprises.length === 0) {
    console.log('⚠️  Aucune entreprise trouvée pour cet utilisateur');
    console.log('   → L\'utilisateur doit créer une entreprise avant de créer un client');
    process.exit(0);
  }

  console.log(`✅ ${entreprises.length} entreprise(s) trouvée(s):`);
  entreprises.forEach(ent => {
    console.log(`   - ${ent.nom} (ID: ${ent.id})`);
  });
  console.log('');

  // 3. Tester la création d'un client
  const testEntreprise = entreprises[0];
  const testClientData = {
    entreprise_id: testEntreprise.id,
    nom: 'TEST',
    prenom: 'Diagnostic',
    email: `test-diagnostic-${Date.now()}@example.com`,
    telephone: '0100000000',
    adresse: '123 Rue Test',
    code_postal: '75001',
    ville: 'Paris',
    entreprise_nom: null,
    siret: null,
    updated_at: new Date().toISOString(),
  };

  console.log('📝 Tentative de création d\'un client...');
  console.log(`   Entreprise: ${testEntreprise.nom} (${testEntreprise.id})`);
  console.log(`   Email: ${testClientData.email}\n`);

  const { data: insertResult, error: insertError } = await supabase
    .from('clients')
    .insert([testClientData])
    .select();

  if (insertError) {
    console.error('❌ ERREUR lors de la création du client:');
    console.error(`   Code: ${insertError.code}`);
    console.error(`   Message: ${insertError.message}`);
    console.error(`   Détails: ${insertError.details || 'N/A'}`);
    console.error(`   Hint: ${insertError.hint || 'N/A'}`);
    console.log('');
    console.log('🔍 Analyse de l\'erreur:');
    
    if (insertError.code === '42501') {
      console.log('   → Problème de permissions RLS (Row Level Security)');
      console.log('   → L\'utilisateur n\'a pas les droits pour créer un client');
      console.log('   → Vérifiez que l\'entreprise appartient bien à l\'utilisateur');
    } else if (insertError.code === '23503') {
      console.log('   → Problème de clé étrangère (foreign key)');
      console.log('   → L\'entreprise_id n\'existe pas ou n\'est pas accessible');
    } else if (insertError.code === '23505') {
      console.log('   → Violation de contrainte unique');
      console.log('   → L\'email existe déjà');
    } else if (insertError.code === '23502') {
      console.log('   → Champ requis manquant (NOT NULL)');
    }
  } else {
    console.log('✅ Client créé avec succès !');
    console.log(`   ID: ${insertResult?.[0]?.id}`);
    console.log('');
    
    // Supprimer le client de test
    if (insertResult?.[0]?.id) {
      console.log('🧹 Suppression du client de test...');
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', insertResult[0].id);
      
      if (deleteError) {
        console.log('⚠️  Erreur lors de la suppression:', deleteError.message);
      } else {
        console.log('✅ Client de test supprimé');
      }
    }
  }

  console.log('\n✅ Test terminé !\n');
}

testCreationClient().catch(console.error);

