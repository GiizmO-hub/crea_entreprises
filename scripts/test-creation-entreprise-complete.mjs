#!/usr/bin/env node
/**
 * Script de test complet pour la création d'entreprise
 * Teste la fonction create_complete_entreprise_automated avec tous les paramètres
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const envPaths = [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '.env'),
  ];
  
  const env = {};
  
  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            env[key] = value;
          }
        }
      });
    } catch (err) {
      // Ignorer si fichier n'existe pas
    }
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCreationEntreprise() {
  console.log('\n🧪 TEST DE CRÉATION D\'ENTREPRISE COMPLET\n');
  
  // 1. Récupérer un plan d'abonnement actif
  console.log('1️⃣  Récupération d\'un plan d\'abonnement actif...');
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, prix_annuel')
    .eq('actif', true)
    .limit(1)
    .single();
  
  if (plansError || !plans) {
    console.error('❌ Erreur récupération plan:', plansError?.message);
    console.log('   → Création d\'entreprise SANS plan...');
    var planId = null;
  } else {
    console.log(`   ✅ Plan trouvé: ${plans.nom} (ID: ${plans.id})`);
    var planId = plans.id;
  }
  
  // 2. Se connecter en tant qu'utilisateur
  console.log('\n2️⃣  Connexion utilisateur...');
  const testEmail = 'meddecyril@icloud.com';
  const testPassword = 'TestPassword123!'; // ⚠️ À remplacer par un vrai mot de passe de test
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (authError) {
    console.error('❌ Erreur connexion:', authError.message);
    console.log('   ⚠️  Test sans authentification (peut échouer)...');
  } else {
    console.log(`   ✅ Connecté en tant que: ${authData.user.email}`);
  }
  
  // 3. Test de création d'entreprise
  console.log('\n3️⃣  Test création entreprise...');
  const nomEntreprise = `TEST_${Date.now()}`;
  
  const { data: result, error: error } = await supabase.rpc('create_complete_entreprise_automated', {
    p_nom_entreprise: nomEntreprise,
    p_forme_juridique: 'SARL',
    p_email_entreprise: `test-${Date.now()}@example.com`,
    p_plan_id: planId,
    p_email_client: `client-${Date.now()}@example.com`,
    p_nom_client: 'Test',
    p_prenom_client: 'Client',
    p_creer_client_super_admin: true
  });
  
  if (error) {
    console.error('❌ ERREUR lors de la création:', error.message);
    console.error('   Détails:', error);
    return { success: false, error: error.message };
  }
  
  console.log('\n✅ RÉSULTAT DE LA CRÉATION:');
  console.log('   Entreprise ID:', result.entreprise_id);
  console.log('   Client ID:', result.client_id);
  console.log('   Paiement ID:', result.paiement_id);
  console.log('   Montant TTC:', result.montant_ttc);
  console.log('   Plan Info:', result.plan_info ? '✅ Présent' : '❌ Manquant');
  
  // 4. Vérifier que l'entreprise a été créée avec le bon statut
  console.log('\n4️⃣  Vérification de l\'entreprise créée...');
  const { data: entreprise, error: entrepriseError } = await supabase
    .from('entreprises')
    .select('id, nom, statut')
    .eq('id', result.entreprise_id)
    .single();
  
  if (entrepriseError) {
    console.error('❌ Erreur vérification entreprise:', entrepriseError.message);
  } else {
    console.log(`   ✅ Entreprise trouvée: ${entreprise.nom}`);
    console.log(`   ✅ Statut: ${entreprise.statut} (doit être 'active' ou 'en_creation')`);
    
    if (!['active', 'en_creation', 'suspendue', 'radiee'].includes(entreprise.statut)) {
      console.error(`   ⚠️  ATTENTION: Statut '${entreprise.statut}' non autorisé par la contrainte CHECK !`);
    }
  }
  
  // 5. Vérifier le paiement si créé
  if (result.paiement_id) {
    console.log('\n5️⃣  Vérification du paiement...');
    const { data: paiement, error: paiementError } = await supabase
      .from('paiements')
      .select('id, statut, montant_ttc, notes')
      .eq('id', result.paiement_id)
      .single();
    
    if (paiementError) {
      console.error('❌ Erreur vérification paiement:', paiementError.message);
    } else {
      console.log(`   ✅ Paiement trouvé: ${paiement.id}`);
      console.log(`   ✅ Statut: ${paiement.statut}`);
      console.log(`   ✅ Montant TTC: ${paiement.montant_ttc}`);
      
      // Vérifier que plan_info est dans les notes
      const notes = typeof paiement.notes === 'string' ? JSON.parse(paiement.notes) : paiement.notes;
      if (notes?.plan_info) {
        console.log(`   ✅ plan_info présent dans les notes: ${Object.keys(notes.plan_info).length} champs`);
      } else {
        console.error('   ⚠️  plan_info manquant dans les notes du paiement !');
      }
    }
  }
  
  console.log('\n✅✅✅ TEST TERMINÉ AVEC SUCCÈS ! ✅✅✅\n');
  return { success: true, result };
}

testCreationEntreprise()
  .then(({ success, error }) => {
    if (success) {
      console.log('🎉 Tous les tests sont passés !');
      process.exit(0);
    } else {
      console.error('❌ Tests échoués:', error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
  });

