#!/usr/bin/env node
/**
 * Script de test complet pour la création d'abonnement
 * 
 * Ce script :
 * 1. Vérifie la structure de la table abonnements
 * 2. Récupère un paiement récent
 * 3. Vérifie les données nécessaires (entreprise_id, plan_id, auth_user_id)
 * 4. Teste la création d'abonnement manuellement
 * 5. Vérifie que l'abonnement est bien créé
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour lire les variables d'environnement
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const env = {};
  
  if (existsSync(envPath)) {
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
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   → VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   → VITE_SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAbonnementCreation() {
  console.log('\n🔍 TEST COMPLET : Création d\'abonnement\n');
  
  try {
    // 1. Vérifier la structure de la table abonnements
    console.log('📋 ÉTAPE 1 : Vérification structure table abonnements...');
    const structureQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'abonnements'
      ORDER BY ordinal_position;
    `;
    
    const { rows: columns } = await pool.query(structureQuery);
    console.log('✅ Colonnes de la table abonnements :');
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
    });
    
    // 2. Récupérer un paiement récent avec statut 'paye'
    console.log('\n📋 ÉTAPE 2 : Récupération d\'un paiement récent...');
    const paiementQuery = `
      SELECT 
        id,
        entreprise_id,
        statut,
        montant_ttc,
        notes,
        created_at
      FROM paiements
      WHERE statut = 'paye'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    const { rows: paiements } = await pool.query(paiementQuery);
    
    if (paiements.length === 0) {
      console.error('❌ Aucun paiement avec statut "paye" trouvé');
      return;
    }
    
    const paiement = paiements[0];
    console.log('✅ Paiement trouvé :', {
      id: paiement.id,
      entreprise_id: paiement.entreprise_id,
      statut: paiement.statut,
      montant: paiement.montant_ttc,
    });
    
    // 3. Parser les notes du paiement
    console.log('\n📋 ÉTAPE 3 : Analyse des notes du paiement...');
    let notes = {};
    try {
      if (paiement.notes) {
        if (typeof paiement.notes === 'string') {
          notes = JSON.parse(paiement.notes);
        } else {
          notes = paiement.notes;
        }
      }
    } catch (e) {
      console.warn('⚠️ Erreur parsing notes:', e.message);
    }
    
    console.log('✅ Notes parsées :', JSON.stringify(notes, null, 2));
    
    const entreprise_id = paiement.entreprise_id || notes.entreprise_id;
    const plan_id = notes.plan_id;
    const client_id = notes.client_id;
    const auth_user_id = notes.auth_user_id;
    
    console.log('\n📊 Données extraites :');
    console.log(`   - entreprise_id: ${entreprise_id}`);
    console.log(`   - plan_id: ${plan_id}`);
    console.log(`   - client_id: ${client_id}`);
    console.log(`   - auth_user_id: ${auth_user_id}`);
    
    // 4. Vérifier si entreprise_id existe
    if (!entreprise_id) {
      console.error('❌ entreprise_id manquant');
      return;
    }
    
    const { rows: entreprises } = await pool.query(
      'SELECT id, nom FROM entreprises WHERE id = $1',
      [entreprise_id]
    );
    
    if (entreprises.length === 0) {
      console.error(`❌ Entreprise ${entreprise_id} non trouvée`);
      return;
    }
    
    console.log(`✅ Entreprise trouvée: ${entreprises[0].nom}`);
    
    // 5. Vérifier si plan_id existe
    let plan_id_final = plan_id;
    if (!plan_id_final) {
      console.log('\n📋 Recherche plan_id dans abonnements existants...');
      const { rows: abonnements_existants } = await pool.query(
        'SELECT plan_id FROM abonnements WHERE entreprise_id = $1 ORDER BY created_at DESC LIMIT 1',
        [entreprise_id]
      );
      
      if (abonnements_existants.length > 0) {
        plan_id_final = abonnements_existants[0].plan_id;
        console.log(`✅ Plan ID trouvé dans abonnements existants: ${plan_id_final}`);
      } else {
        console.error('❌ plan_id non trouvé');
        return;
      }
    }
    
    const { rows: plans } = await pool.query(
      'SELECT id, nom FROM plans_abonnement WHERE id = $1',
      [plan_id_final]
    );
    
    if (plans.length === 0) {
      console.error(`❌ Plan ${plan_id_final} non trouvé`);
      return;
    }
    
    console.log(`✅ Plan trouvé: ${plans[0].nom}`);
    
    // 6. Vérifier si auth_user_id existe
    let auth_user_id_final = auth_user_id;
    if (!auth_user_id_final && client_id) {
      console.log('\n📋 Recherche auth_user_id...');
      
      // Méthode 1 : Depuis espaces_membres_clients
      const { rows: emc } = await pool.query(
        'SELECT user_id FROM espaces_membres_clients WHERE client_id = $1 LIMIT 1',
        [client_id]
      );
      
      if (emc.length > 0) {
        auth_user_id_final = emc[0].user_id;
        console.log(`✅ Auth User ID trouvé via espaces_membres_clients: ${auth_user_id_final}`);
      } else {
        // Méthode 2 : Depuis clients email
        const { rows: clients } = await pool.query(
          'SELECT email FROM clients WHERE id = $1',
          [client_id]
        );
        
        if (clients.length > 0 && clients[0].email) {
          const { rows: auth_users } = await pool.query(
            'SELECT id FROM auth.users WHERE email = $1 LIMIT 1',
            [clients[0].email]
          );
          
          if (auth_users.length > 0) {
            auth_user_id_final = auth_users[0].id;
            console.log(`✅ Auth User ID trouvé via email: ${auth_user_id_final}`);
          }
        }
      }
    }
    
    if (!auth_user_id_final) {
      console.error('❌ auth_user_id non trouvé');
      return;
    }
    
    // 7. Vérifier si une facture existe pour ce paiement
    console.log('\n📋 ÉTAPE 4 : Vérification facture...');
    const { rows: factures } = await pool.query(
      'SELECT id, numero FROM factures WHERE paiement_id = $1 LIMIT 1',
      [paiement.id]
    );
    
    if (factures.length === 0) {
      console.error('❌ Aucune facture trouvée pour ce paiement');
      return;
    }
    
    const facture_id = factures[0].id;
    console.log(`✅ Facture trouvée: ${factures[0].numero}`);
    
    // 8. Vérifier si facture_id existe dans abonnements
    console.log('\n📋 ÉTAPE 5 : Vérification colonne facture_id dans abonnements...');
    const { rows: factureIdCol } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'facture_id'
      ) as exists;
    `);
    
    const facture_id_exists = factureIdCol[0].exists;
    console.log(`✅ Colonne facture_id existe: ${facture_id_exists}`);
    
    // 9. Vérifier si client_id ou user_id existe dans abonnements
    const { rows: clientIdCol } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'client_id'
      ) as exists;
    `);
    
    const { rows: userIdCol } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'abonnements' AND column_name = 'user_id'
      ) as exists;
    `);
    
    const client_id_exists = clientIdCol[0].exists;
    const user_id_exists = userIdCol[0].exists;
    
    console.log(`✅ Colonne client_id existe: ${client_id_exists}`);
    console.log(`✅ Colonne user_id existe: ${user_id_exists}`);
    
    // 10. Vérifier si un abonnement existe déjà
    console.log('\n📋 ÉTAPE 6 : Vérification abonnement existant...');
    let abonnementQuery = '';
    if (facture_id_exists) {
      abonnementQuery = 'SELECT id, statut FROM abonnements WHERE facture_id = $1 LIMIT 1';
    } else {
      abonnementQuery = 'SELECT id, statut FROM abonnements WHERE entreprise_id = $1 AND plan_id = $2 ORDER BY created_at DESC LIMIT 1';
    }
    
    const { rows: abonnements_existants_final } = await pool.query(
      facture_id_exists 
        ? abonnementQuery 
        : abonnementQuery,
      facture_id_exists ? [facture_id] : [entreprise_id, plan_id_final]
    );
    
    if (abonnements_existants_final.length > 0) {
      console.log(`✅ Abonnement existant trouvé: ${abonnements_existants_final[0].id} (statut: ${abonnements_existants_final[0].statut})`);
    } else {
      console.log('ℹ️ Aucun abonnement existant trouvé');
    }
    
    // 11. Tester la création d'abonnement
    console.log('\n📋 ÉTAPE 7 : Test création abonnement...');
    
    const insertColumns = ['entreprise_id', 'plan_id', 'date_debut', 'date_fin', 'statut'];
    const insertValues = [entreprise_id, plan_id_final, 'CURRENT_DATE', 'CURRENT_DATE + INTERVAL \'1 month\'', '\'actif\''];
    
    if (client_id_exists) {
      insertColumns.push('client_id');
      insertValues.push(auth_user_id_final);
    } else if (user_id_exists) {
      insertColumns.push('user_id');
      insertValues.push(auth_user_id_final);
    }
    
    if (facture_id_exists) {
      insertColumns.push('facture_id');
      insertValues.push(facture_id);
    }
    
    const insertQuery = `
      INSERT INTO abonnements (${insertColumns.join(', ')})
      VALUES (${insertValues.map((_, i) => `$${i + 1}`).join(', ')})
      ON CONFLICT DO NOTHING
      RETURNING id;
    `;
    
    console.log('\n🔧 Requête SQL :');
    console.log(insertQuery);
    console.log('\n📊 Valeurs :');
    insertColumns.forEach((col, i) => {
      console.log(`   ${col}: ${insertValues[i]}`);
    });
    
    // Exécuter la requête
    try {
      const values = [entreprise_id, plan_id_final];
      if (client_id_exists) {
        values.push(auth_user_id_final);
      } else if (user_id_exists) {
        values.push(auth_user_id_final);
      }
      if (facture_id_exists) {
        values.push(facture_id);
      }
      
      const { rows: newAbonnement } = await pool.query(insertQuery, values);
      
      if (newAbonnement.length > 0) {
        console.log(`\n✅ Abonnement créé avec succès ! ID: ${newAbonnement[0].id}`);
      } else {
        console.log('\n⚠️ Aucun abonnement créé (probablement conflit)');
      }
    } catch (error) {
      console.error('\n❌ Erreur lors de la création de l\'abonnement:', error.message);
      console.error('   Détails:', error);
    }
    
    // 12. Vérifier l'abonnement final
    console.log('\n📋 ÉTAPE 8 : Vérification abonnement final...');
    const { rows: abonnementFinal } = await pool.query(
      'SELECT * FROM abonnements WHERE entreprise_id = $1 AND plan_id = $2 ORDER BY created_at DESC LIMIT 1',
      [entreprise_id, plan_id_final]
    );
    
    if (abonnementFinal.length > 0) {
      console.log('\n✅ Abonnement final :');
      console.log(JSON.stringify(abonnementFinal[0], null, 2));
    } else {
      console.log('\n❌ Aucun abonnement trouvé après création');
    }
    
    console.log('\n✅ TEST TERMINÉ\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testAbonnementCreation().catch(console.error);

