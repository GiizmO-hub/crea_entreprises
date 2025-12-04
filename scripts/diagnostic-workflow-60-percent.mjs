#!/usr/bin/env node

/**
 * DIAGNOSTIC : Pourquoi le workflow s'arrête à 60% ?
 * 
 * Vérifie :
 * 1. Où sont stockées les données de création d'entreprise
 * 2. Si workflow_data est créé correctement
 * 3. Si le paiement est bien créé
 * 4. Si valider_paiement_carte_immediat est appelé
 * 5. Si creer_facture_et_abonnement_apres_paiement est appelé
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL doit être configuré');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const dbClient = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function diagnostic60Percent() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC : Workflow s\'arrête à 60%');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    await dbClient.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Trouver la dernière entreprise créée (moins de 1 heure)
    console.log('📋 ÉTAPE 1: Dernière entreprise créée');
    console.log('─────────────────────────────────────────────────────────');
    
    const derniereEntreprise = await dbClient.query(`
      SELECT 
        id, nom, statut, statut_paiement, created_at, user_id
      FROM entreprises
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    if (derniereEntreprise.rows.length === 0) {
      console.log('⚠️  Aucune entreprise créée dans la dernière heure');
      console.log('   Crée une nouvelle entreprise maintenant, puis relance ce script\n');
      return;
    }

    const entreprise = derniereEntreprise.rows[0];
    console.log(`✅ Entreprise trouvée: ${entreprise.nom} (${entreprise.id.substring(0, 8)}...)`);
    console.log(`   Statut: ${entreprise.statut}`);
    console.log(`   Statut paiement: ${entreprise.statut_paiement}`);
    console.log(`   Créée le: ${entreprise.created_at}\n`);

    // 2. Vérifier le client associé
    console.log('📋 ÉTAPE 2: Client associé');
    console.log('─────────────────────────────────────────────────────────');
    
    const client = await dbClient.query(`
      SELECT 
        id, nom, prenom, email, statut, entreprise_id
      FROM clients
      WHERE entreprise_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `, [entreprise.id]);

    if (client.rows.length === 0) {
      console.log('❌ PROBLÈME: Aucun client trouvé pour cette entreprise');
    } else {
      const c = client.rows[0];
      console.log(`✅ Client trouvé: ${c.nom} ${c.prenom} (${c.email})`);
      console.log(`   Statut: ${c.statut}`);
      console.log(`   Client ID: ${c.id.substring(0, 8)}...\n`);
    }

    // 3. Vérifier le paiement
    console.log('📋 ÉTAPE 3: Paiement créé');
    console.log('─────────────────────────────────────────────────────────');
    
    const paiement = await dbClient.query(`
      SELECT 
        id, statut, montant_ttc, entreprise_id, created_at, notes
      FROM paiements
      WHERE entreprise_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `, [entreprise.id]);

    if (paiement.rows.length === 0) {
      console.log('❌ PROBLÈME: Aucun paiement trouvé pour cette entreprise');
      console.log('   → Le workflow s\'arrête ici (pas de paiement créé)\n');
    } else {
      const p = paiement.rows[0];
      console.log(`✅ Paiement trouvé: ${p.id.substring(0, 8)}...`);
      console.log(`   Statut: ${p.statut}`);
      console.log(`   Montant: ${p.montant_ttc}€`);
      console.log(`   Créé le: ${p.created_at}`);
      
      // Vérifier les notes
      if (p.notes) {
        try {
          const notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
          console.log(`   Plan ID dans notes: ${notes.plan_id || 'NON TROUVÉ'}`);
        } catch (e) {
          console.log(`   Notes: ${p.notes.substring(0, 100)}...`);
        }
      }
      console.log('');

      // 4. ✅ CRITIQUE : Vérifier workflow_data
      console.log('📋 ÉTAPE 4: workflow_data (CRITIQUE)');
      console.log('─────────────────────────────────────────────────────────');
      
      const workflowData = await dbClient.query(`
        SELECT 
          id, paiement_id, entreprise_id, client_id, auth_user_id, plan_id, traite, created_at
        FROM workflow_data
        WHERE paiement_id = $1
        LIMIT 1;
      `, [p.id]);

      if (workflowData.rows.length === 0) {
        console.log('❌ PROBLÈME CRITIQUE: workflow_data N\'EXISTE PAS pour ce paiement !');
        console.log('   → C\'est pour ça que le workflow s\'arrête à 60%');
        console.log('   → creer_facture_et_abonnement_apres_paiement ne peut pas fonctionner sans workflow_data');
        console.log('');
        console.log('💡 SOLUTION: La fonction create_complete_entreprise_automated');
        console.log('   n\'a peut-être pas été mise à jour. Vérifie qu\'elle crée workflow_data.\n');
      } else {
        const wd = workflowData.rows[0];
        console.log(`✅ workflow_data trouvé: ${wd.id.substring(0, 8)}...`);
        console.log(`   Entreprise ID: ${wd.entreprise_id ? wd.entreprise_id.substring(0, 8) + '...' : '❌ NULL'}`);
        console.log(`   Client ID: ${wd.client_id ? wd.client_id.substring(0, 8) + '...' : '❌ NULL'}`);
        console.log(`   Auth User ID: ${wd.auth_user_id ? wd.auth_user_id.substring(0, 8) + '...' : '❌ NULL'}`);
        console.log(`   Plan ID: ${wd.plan_id ? wd.plan_id.substring(0, 8) + '...' : '❌ NULL'}`);
        console.log(`   Traité: ${wd.traite ? '✅ OUI' : '❌ NON (c\'est pour ça que ça s\'arrête à 60%)'}`);
        console.log('');

        // 5. Vérifier si facture/abonnement/espace client existent
        if (!wd.traite) {
          console.log('📋 ÉTAPE 5: Éléments manquants (workflow non traité)');
          console.log('─────────────────────────────────────────────────────────');
          
          // Facture
          const facture = await dbClient.query(`
            SELECT id, numero, statut FROM factures WHERE paiement_id = $1 LIMIT 1;
          `, [p.id]);
          
          if (facture.rows.length === 0) {
            console.log('❌ Facture: N\'EXISTE PAS');
          } else {
            console.log(`✅ Facture: ${facture.rows[0].numero} (${facture.rows[0].statut})`);
          }
          
          // Abonnement
          const abonnement = await dbClient.query(`
            SELECT id, statut, plan_id FROM abonnements 
            WHERE entreprise_id = $1 AND plan_id = $2 
            LIMIT 1;
          `, [entreprise.id, wd.plan_id]);
          
          if (abonnement.rows.length === 0) {
            console.log('❌ Abonnement: N\'EXISTE PAS');
          } else {
            console.log(`✅ Abonnement: ${abonnement.rows[0].id.substring(0, 8)}... (${abonnement.rows[0].statut})`);
          }
          
          // Espace membre
          const espaceMembre = await dbClient.query(`
            SELECT id, actif, statut_compte FROM espaces_membres_clients
            WHERE entreprise_id = $1 AND client_id = $2
            LIMIT 1;
          `, [entreprise.id, wd.client_id]);
          
          if (espaceMembre.rows.length === 0) {
            console.log('❌ Espace membre client: N\'EXISTE PAS');
          } else {
            console.log(`✅ Espace membre: ${espaceMembre.rows[0].id.substring(0, 8)}... (actif: ${espaceMembre.rows[0].actif})`);
          }
          
          console.log('');
          console.log('💡 DIAGNOSTIC: Le workflow s\'arrête à 60% car:');
          console.log('   1. workflow_data existe mais traite = false');
          console.log('   2. creer_facture_et_abonnement_apres_paiement n\'a pas été appelée');
          console.log('   3. OU elle a été appelée mais a échoué silencieusement');
          console.log('');
          console.log('🔧 SOLUTION: Appeler manuellement creer_facture_et_abonnement_apres_paiement');
          console.log(`   avec le paiement_id: ${p.id.substring(0, 8)}...`);
        }
      }
    }

    // 6. Résumé des données stockées
    console.log('\n\n📊 RÉSUMÉ: Où sont stockées les données ?');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Entreprise → Table: entreprises');
    console.log('✅ Client → Table: clients');
    console.log('✅ Paiement → Table: paiements');
    console.log('✅ Données workflow → Table: workflow_data (CRITIQUE)');
    console.log('✅ Facture → Table: factures (si workflow continue)');
    console.log('✅ Abonnement → Table: abonnements (si workflow continue)');
    console.log('✅ Espace client → Table: espaces_membres_clients (si workflow continue)');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await dbClient.end();
    console.log('\n🔌 Connexion fermée');
  }
}

diagnostic60Percent().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});

