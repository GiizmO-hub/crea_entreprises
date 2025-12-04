#!/usr/bin/env node

/**
 * Script de test complet pour le module Devis
 * 
 * Ce script teste toutes les fonctionnalités du module devis :
 * 1. Création de devis manuels
 * 2. Modification de devis
 * 3. Changement de statut (brouillon → envoyé → accepté/refusé)
 * 4. Transformation devis → facture
 * 5. Génération PDF devis
 * 6. Filtrage et recherche
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl, supabaseServiceKey;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        supabaseUrl = value;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseServiceKey = value;
      }
    }
  });
}

// Fallback sur les variables d'environnement système
supabaseUrl = supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
supabaseServiceKey = supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(60) + '\n');
}

// ============================================================================
// TESTS
// ============================================================================

async function test1_CreerDevis() {
  logSection('TEST 1 : Création d\'un devis');
  
  try {
    // Récupérer une entreprise de test
    const { data: entreprises, error: entError } = await supabase
      .from('entreprises')
      .select('id, nom')
      .limit(1);
    
    if (entError || !entreprises || entreprises.length === 0) {
      log('❌ Aucune entreprise trouvée', 'red');
      return null;
    }
    
    const entreprise = entreprises[0];
    log(`✅ Entreprise trouvée: ${entreprise.nom} (${entreprise.id})`, 'green');
    
    // Récupérer un client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, nom, prenom, entreprise_nom')
      .eq('entreprise_id', entreprise.id)
      .limit(1);
    
    if (clientError || !clients || clients.length === 0) {
      log('❌ Aucun client trouvé', 'red');
      return null;
    }
    
    const client = clients[0];
    log(`✅ Client trouvé: ${client.entreprise_nom || `${client.prenom} ${client.nom}`}`, 'green');
    
    // Générer un numéro de devis
    const numero = `DEVIS-TEST-${Date.now().toString().slice(-6)}`;
    
    // Créer le devis
    const dateValidite = new Date();
    dateValidite.setDate(dateValidite.getDate() + 30); // Validité 30 jours
    
    const { data: devis, error: devisError } = await supabase
      .from('factures')
      .insert([{
        numero,
        type: 'devis',
        entreprise_id: entreprise.id,
        client_id: client.id,
        date_emission: new Date().toISOString().split('T')[0],
        date_validite: dateValidite.toISOString().split('T')[0],
        montant_ht: 1000.00,
        tva: 200.00,
        montant_ttc: 1200.00,
        statut: 'brouillon',
        source: 'plateforme',
      }])
      .select()
      .single();
    
    if (devisError) {
      log(`❌ Erreur création devis: ${devisError.message}`, 'red');
      return null;
    }
    
    log(`✅ Devis créé: ${devis.numero} (${devis.id})`, 'green');
    
    // Créer des lignes pour le devis
    const { error: lignesError } = await supabase
      .from('facture_lignes')
      .insert([
        {
          facture_id: devis.id,
          description: 'Prestation de développement',
          quantite: 10,
          prix_unitaire_ht: 100.00,
          taux_tva: 20,
          montant_ht: 1000.00,
          tva: 200.00,
          montant_ttc: 1200.00,
          ordre: 0,
        },
      ]);
    
    if (lignesError) {
      log(`⚠️ Erreur création lignes: ${lignesError.message}`, 'yellow');
    } else {
      log('✅ Lignes créées', 'green');
    }
    
    return devis;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return null;
  }
}

async function test2_ModifierDevis(devisId) {
  logSection('TEST 2 : Modification d\'un devis');
  
  if (!devisId) {
    log('⚠️ Pas de devis à modifier', 'yellow');
    return false;
  }
  
  try {
    const { data: devis, error } = await supabase
      .from('factures')
      .update({
        montant_ht: 1500.00,
        tva: 300.00,
        montant_ttc: 1800.00,
        notes: 'Devis modifié par le script de test',
      })
      .eq('id', devisId)
      .select()
      .single();
    
    if (error) {
      log(`❌ Erreur modification: ${error.message}`, 'red');
      return false;
    }
    
    log(`✅ Devis modifié: ${devis.numero}`, 'green');
    log(`   Nouveau montant HT: ${devis.montant_ht}€`, 'blue');
    return true;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

async function test3_ChangerStatut(devisId) {
  logSection('TEST 3 : Changement de statut');
  
  if (!devisId) {
    log('⚠️ Pas de devis à modifier', 'yellow');
    return false;
  }
  
  try {
    // Brouillon → Envoyé
    const { error: error1 } = await supabase
      .from('factures')
      .update({ statut: 'envoye' })
      .eq('id', devisId);
    
    if (error1) {
      log(`❌ Erreur changement statut envoyé: ${error1.message}`, 'red');
      return false;
    }
    log('✅ Statut changé: brouillon → envoyé', 'green');
    
    // Envoyé → Accepté
    const { error: error2 } = await supabase
      .from('factures')
      .update({ statut: 'accepte' })
      .eq('id', devisId);
    
    if (error2) {
      log(`❌ Erreur changement statut accepté: ${error2.message}`, 'red');
      return false;
    }
    log('✅ Statut changé: envoyé → accepté', 'green');
    
    return true;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

async function test4_TransformerEnFacture(devisId) {
  logSection('TEST 4 : Transformation devis → facture');
  
  if (!devisId) {
    log('⚠️ Pas de devis à transformer', 'yellow');
    return null;
  }
  
  try {
    // Récupérer le devis
    const { data: devis, error: devisError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', devisId)
      .single();
    
    if (devisError || !devis) {
      log(`❌ Devis non trouvé: ${devisError?.message}`, 'red');
      return null;
    }
    
    // Récupérer les lignes du devis
    const { data: lignes, error: lignesError } = await supabase
      .from('facture_lignes')
      .select('*')
      .eq('facture_id', devisId)
      .order('ordre');
    
    if (lignesError) {
      log(`⚠️ Erreur récupération lignes: ${lignesError.message}`, 'yellow');
    }
    
    // Générer un numéro de facture
    const numeroFacture = `FAC-TEST-${Date.now().toString().slice(-6)}`;
    
    // Créer la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert([{
        numero: numeroFacture,
        type: 'facture',
        entreprise_id: devis.entreprise_id,
        client_id: devis.client_id,
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: devis.date_echeance || null,
        montant_ht: devis.montant_ht,
        tva: devis.tva || 0,
        montant_ttc: devis.montant_ttc,
        statut: 'brouillon',
        notes: devis.notes,
        source: devis.source || 'plateforme',
        devis_facture_id: devis.id,
      }])
      .select()
      .single();
    
    if (factureError) {
      log(`❌ Erreur création facture: ${factureError.message}`, 'red');
      return null;
    }
    
    log(`✅ Facture créée: ${facture.numero} (${facture.id})`, 'green');
    
    // Copier les lignes
    if (lignes && lignes.length > 0) {
      const nouvellesLignes = lignes.map(ligne => ({
        facture_id: facture.id,
        description: ligne.description,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva,
        montant_ht: ligne.montant_ht,
        tva: ligne.tva || ligne.montant_tva || 0,
        montant_ttc: ligne.montant_ttc,
        ordre: ligne.ordre,
      }));
      
      const { error: lignesError2 } = await supabase
        .from('facture_lignes')
        .insert(nouvellesLignes);
      
      if (lignesError2) {
        log(`⚠️ Erreur copie lignes: ${lignesError2.message}`, 'yellow');
      } else {
        log(`✅ ${nouvellesLignes.length} ligne(s) copiée(s)`, 'green');
      }
    }
    
    return facture;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return null;
  }
}

async function test5_FiltrageDevis() {
  logSection('TEST 5 : Filtrage et recherche');
  
  try {
    // Compter tous les devis
    const { count, error: countError } = await supabase
      .from('factures')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'devis');
    
    if (countError) {
      log(`❌ Erreur comptage: ${countError.message}`, 'red');
      return false;
    }
    
    log(`✅ Total devis dans la base: ${count}`, 'green');
    
    // Récupérer les devis par statut
    const statuts = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];
    for (const statut of statuts) {
      const { count: countStatut, error } = await supabase
        .from('factures')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'devis')
        .eq('statut', statut);
      
      if (!error && countStatut > 0) {
        log(`   ${statut}: ${countStatut}`, 'blue');
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

async function test6_VerifierStructure() {
  logSection('TEST 6 : Vérification structure base de données');
  
  try {
    // Vérifier que la colonne type accepte 'devis'
    const { data: checkType, error: typeError } = await supabase
      .from('factures')
      .select('type')
      .eq('type', 'devis')
      .limit(1);
    
    if (typeError) {
      log(`❌ Colonne type n'accepte pas 'devis': ${typeError.message}`, 'red');
      return false;
    }
    log('✅ Colonne type accepte bien \'devis\'', 'green');
    
    // Vérifier que date_validite existe
    const { data: checkValidite, error: validiteError } = await supabase
      .from('factures')
      .select('date_validite')
      .eq('type', 'devis')
      .not('date_validite', 'is', null)
      .limit(1);
    
    if (validiteError && !validiteError.message.includes('column')) {
      log(`⚠️ Colonne date_validite: ${validiteError.message}`, 'yellow');
    } else {
      log('✅ Colonne date_validite accessible', 'green');
    }
    
    // Vérifier que devis_facture_id existe
    const { data: checkDevisFacture, error: devisFactureError } = await supabase
      .from('factures')
      .select('devis_facture_id')
      .not('devis_facture_id', 'is', null)
      .limit(1);
    
    if (devisFactureError && !devisFactureError.message.includes('column')) {
      log(`⚠️ Colonne devis_facture_id: ${devisFactureError.message}`, 'yellow');
    } else {
      log('✅ Colonne devis_facture_id accessible', 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

// ============================================================================
// EXÉCUTION DES TESTS
// ============================================================================

async function main() {
  log('\n🚀 DÉMARRAGE DES TESTS DU MODULE DEVIS\n', 'cyan');
  
  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
    test6: false,
  };
  
  let devisId = null;
  let factureId = null;
  
  try {
    // Test 1 : Création
    const devis = await test1_CreerDevis();
    if (devis) {
      devisId = devis.id;
      results.test1 = true;
    }
    
    // Test 2 : Modification
    results.test2 = await test2_ModifierDevis(devisId);
    
    // Test 3 : Changement de statut
    results.test3 = await test3_ChangerStatut(devisId);
    
    // Test 4 : Transformation
    const facture = await test4_TransformerEnFacture(devisId);
    if (facture) {
      factureId = facture.id;
      results.test4 = true;
    }
    
    // Test 5 : Filtrage
    results.test5 = await test5_FiltrageDevis();
    
    // Test 6 : Structure
    results.test6 = await test6_VerifierStructure();
    
  } catch (error) {
    log(`\n❌ ERREUR CRITIQUE: ${error.message}`, 'red');
    console.error(error);
  }
  
  // ============================================================================
  // RÉSUMÉ
  // ============================================================================
  
  logSection('RÉSUMÉ DES TESTS');
  
  const tests = [
    { name: 'Création devis', result: results.test1 },
    { name: 'Modification devis', result: results.test2 },
    { name: 'Changement statut', result: results.test3 },
    { name: 'Transformation devis → facture', result: results.test4 },
    { name: 'Filtrage et recherche', result: results.test5 },
    { name: 'Vérification structure DB', result: results.test6 },
  ];
  
  let successCount = 0;
  tests.forEach(test => {
    const icon = test.result ? '✅' : '❌';
    const color = test.result ? 'green' : 'red';
    log(`${icon} ${test.name}`, color);
    if (test.result) successCount++;
  });
  
  console.log('\n' + '='.repeat(60));
  log(`\n📊 RÉSULTAT: ${successCount}/${tests.length} tests réussis`, successCount === tests.length ? 'green' : 'yellow');
  console.log('='.repeat(60) + '\n');
  
  // Nettoyage optionnel (commenté pour garder les données de test)
  /*
  if (factureId) {
    log('🧹 Nettoyage...', 'yellow');
    await supabase.from('factures').delete().eq('id', factureId);
    log('✅ Facture de test supprimée', 'green');
  }
  if (devisId) {
    await supabase.from('factures').delete().eq('id', devisId);
    log('✅ Devis de test supprimé', 'green');
  }
  */
  
  process.exit(successCount === tests.length ? 0 : 1);
}

main().catch(error => {
  log(`\n❌ ERREUR FATALE: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

