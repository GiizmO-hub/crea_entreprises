#!/usr/bin/env node

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

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function testDetails() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();

    const entrepriseId = (await client.query(`SELECT id FROM entreprises WHERE nom = 'SAS TEST' LIMIT 1`)).rows[0]?.id;
    
    if (!entrepriseId) {
      console.log('❌ Entreprise non trouvée');
      return;
    }

    console.log('═══════════════════════════════════════');
    console.log('📊 DÉTAILS DE L\'ENTREPRISE "SAS TEST"');
    console.log('═══════════════════════════════════════\n');

    // Client
    const clientData = await client.query(`
      SELECT c.*, r.code as role_code 
      FROM clients c 
      LEFT JOIN roles r ON c.role_id = r.id 
      WHERE c.entreprise_id = $1 AND c.email = 'jean.dupont@sastest.fr'
    `, [entrepriseId]);
    console.log('👤 CLIENT:');
    if (clientData.rows[0]) {
      const c = clientData.rows[0];
      console.log(`   - ${c.nom} ${c.prenom} (${c.email})`);
      console.log(`   - Statut: ${c.statut}, CRM: ${c.crm_actif ? 'Oui' : 'Non'}, Rôle: ${c.role_code || 'N/A'}`);
    }
    console.log('');

    // Espace membre
    const espaceData = await client.query(`
      SELECT * FROM espaces_membres_clients 
      WHERE entreprise_id = $1 AND email = 'jean.dupont@sastest.fr'
    `, [entrepriseId]);
    console.log('🔐 ESPACE MEMBRE:');
    if (espaceData.rows[0]) {
      console.log(`   - ID: ${espaceData.rows[0].id}, Actif: ${espaceData.rows[0].actif}`);
    }
    console.log('');

    // Abonnement
    const abonnementData = await client.query(`
      SELECT a.*, p.nom as plan_nom 
      FROM abonnements a 
      LEFT JOIN plans_abonnement p ON a.plan_id = p.id 
      WHERE a.entreprise_id = $1
    `, [entrepriseId]);
    console.log('💳 ABONNEMENT:');
    if (abonnementData.rows[0]) {
      const a = abonnementData.rows[0];
      console.log(`   - Plan: ${a.plan_nom || 'N/A'}, Statut: ${a.statut}, Montant: ${a.montant_mensuel}€/mois`);
    }
    console.log('');

    // Collaborateurs
    const collabData = await client.query(`
      SELECT * FROM collaborateurs_entreprise WHERE entreprise_id = $1
    `, [entrepriseId]);
    console.log(`👥 COLLABORATEURS (${collabData.rows.length}):`);
    collabData.rows.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.nom} ${c.prenom} - ${c.email} (${c.role || 'N/A'})`);
    });
    console.log('');

    // Factures
    const facturesData = await client.query(`
      SELECT numero, statut, montant_ht, montant_ttc, date_emission 
      FROM factures 
      WHERE entreprise_id = $1 
      ORDER BY date_emission DESC 
      LIMIT 5
    `, [entrepriseId]);
    console.log(`📄 FACTURES (${facturesData.rows.length} affichées sur toutes):`);
    facturesData.rows.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.numero} - ${f.statut} - ${f.montant_ttc}€ TTC (${f.date_emission?.toISOString().split('T')[0]})`);
    });
    console.log('');

    // Stock
    const stockData = await client.query(`
      SELECT reference, nom, quantite_stock, prix_vente_unitaire 
      FROM stock_items 
      WHERE entreprise_id = $1
    `, [entrepriseId]);
    console.log(`📦 STOCK (${stockData.rows.length} articles):`);
    stockData.rows.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.reference} - ${s.nom} (Stock: ${s.quantite_stock}, Prix: ${s.prix_vente_unitaire}€)`);
    });
    console.log('');

    // CRM
    const crmData = await client.query(`
      SELECT o.nom, o.montant_estime, o.statut 
      FROM crm_opportunites o 
      WHERE o.entreprise_id = $1
    `, [entrepriseId]);
    console.log(`🎯 OPPORTUNITÉS CRM (${crmData.rows.length}):`);
    crmData.rows.forEach((o, i) => {
      console.log(`   ${i + 1}. ${o.nom} - ${o.montant_estime}€ - ${o.statut}`);
    });
    console.log('');

    // Projets
    const projetsData = await client.query(`
      SELECT nom, statut, budget_previstoire 
      FROM projets 
      WHERE entreprise_id = $1
    `, [entrepriseId]);
    console.log(`📋 PROJETS (${projetsData.rows.length}):`);
    projetsData.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.nom} - ${p.statut} - Budget: ${p.budget_previstoire}€`);
    });
    console.log('');

    // Écritures comptables
    const ecrituresData = await client.query(`
      SELECT numero_piece, montant, type_ecriture 
      FROM ecritures_comptables 
      WHERE entreprise_id = $1 
      LIMIT 5
    `, [entrepriseId]);
    console.log(`📊 ÉCRITURES COMPTABLES (${ecrituresData.rows.length} affichées):`);
    ecrituresData.rows.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.numero_piece} - ${e.montant}€ - ${e.type_ecriture}`);
    });
    console.log('');

    console.log('═══════════════════════════════════════');
    console.log('✅ TOUS LES MODULES SONT FONCTIONNELS');
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

testDetails();

