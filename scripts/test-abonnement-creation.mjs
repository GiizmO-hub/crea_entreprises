#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function test() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    
    // Trouver le paiement
    const paiement = await client.query(`
      SELECT p.id, p.entreprise_id, p.notes, p.statut
      FROM paiements p
      WHERE p.statut = 'paye'
        AND p.entreprise_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM abonnements a
          WHERE a.entreprise_id = p.entreprise_id
            AND a.statut = 'actif'
        )
      LIMIT 1
    `);
    
    if (paiement.rows.length === 0) {
      console.log('Aucun paiement à traiter');
      await client.end();
      return;
    }
    
    const p = paiement.rows[0];
    console.log('Paiement:', p.id);
    console.log('Entreprise:', p.entreprise_id);
    console.log('Notes:', p.notes);
    
    // Vérifier si le client existe
    const clientCheck = await client.query(`
      SELECT id, nom, email
      FROM clients
      WHERE entreprise_id = $1
      LIMIT 1
    `, [p.entreprise_id]);
    
    console.log('\nClient trouvé:', clientCheck.rows.length > 0 ? 'Oui' : 'Non');
    if (clientCheck.rows.length > 0) {
      console.log('  ID:', clientCheck.rows[0].id);
      console.log('  Nom:', clientCheck.rows[0].nom);
    }
    
    // Vérifier si le plan existe
    const notesJson = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
    const planId = notesJson?.plan_id;
    
    if (planId) {
      const planCheck = await client.query(`
        SELECT id, nom, prix_mensuel
        FROM plans_abonnement
        WHERE id = $1
      `, [planId]);
      
      console.log('\nPlan trouvé:', planCheck.rows.length > 0 ? 'Oui' : 'Non');
      if (planCheck.rows.length > 0) {
        console.log('  ID:', planCheck.rows[0].id);
        console.log('  Nom:', planCheck.rows[0].nom);
        console.log('  Prix:', planCheck.rows[0].prix_mensuel);
      }
    }
    
    // Appeler la fonction
    console.log('\n🚀 Appel de creer_facture_et_abonnement_apres_paiement...');
    const result = await client.query(`
      SELECT creer_facture_et_abonnement_apres_paiement($1::uuid) as result
    `, [p.id]);
    
    console.log('\nRésultat:');
    console.log(JSON.stringify(result.rows[0].result, null, 2));
    
    await client.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.detail) console.error('Détail:', error.detail);
    if (error.hint) console.error('Indication:', error.hint);
    process.exit(1);
  }
}

test().catch(console.error);

